import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { GpuSample, HostSample } from "./types";

const execFileAsync = promisify(execFile);

type CpuTick = { idle: number; total: number };
let previous: CpuTick | null = null;

function cpuTick(): CpuTick {
  const line = readFileSync("/proc/stat", "utf8").split("\n")[0] ?? "";
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
  const total = parts.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

function clockMhz(): number | null {
  try {
    const khz = Number(readFileSync("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "utf8").trim());
    if (!Number.isFinite(khz) || khz <= 0) return null;
    return Math.round(khz / 1000);
  } catch {
    return null;
  }
}

function memory() {
  const text = readFileSync("/proc/meminfo", "utf8");
  const pick = (key: string) => {
    const line = text.split("\n").find((row) => row.startsWith(key));
    const kb = Number(line?.split(/\s+/)[1] ?? 0);
    return kb * 1024;
  };
  const totalBytes = pick("MemTotal:");
  const availableBytes = pick("MemAvailable:");
  return { totalBytes, availableBytes, usedBytes: Math.max(0, totalBytes - availableBytes) };
}

async function nvidia(): Promise<GpuSample | null> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw", "--format=csv,noheader,nounits"],
      { timeout: 1500 },
    );
    const [name, util, used, total, temp, power] = stdout.trim().split(",").map((part) => part.trim());
    const num = (value: string | undefined) => {
      if (!value || value.toLowerCase() === "n/a" || value === "[not supported]") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      name: name || "NVIDIA GPU",
      utilization: num(util),
      memoryUsedBytes: num(used) == null ? null : num(used)! * 1024 * 1024,
      memoryTotalBytes: num(total) == null ? null : num(total)! * 1024 * 1024,
      temperatureC: num(temp),
      powerW: num(power),
      note: null,
    };
  } catch {
    return null;
  }
}

export async function sampleHost(): Promise<HostSample> {
  const notes: string[] = [];
  const now = cpuTick();
  let utilization: number | null = null;
  if (previous && now.total > previous.total) {
    const total = now.total - previous.total;
    const idle = now.idle - previous.idle;
    utilization = Math.round((1 - idle / total) * 1000) / 10;
  } else {
    notes.push("CPU utilization appears on the next sample.");
  }
  previous = now;

  const clock = clockMhz();
  if (clock == null) notes.push("CPU clock unavailable");
  notes.push("Temperature unavailable");

  const gpus: GpuSample[] = [];
  const nv = await nvidia();
  if (nv) gpus.push(nv);
  else notes.push("No NVIDIA GPU telemetry on this host. Intel Arc is not exposed here.");

  return {
    at: Date.now(),
    cpu: { utilization, clockMhz: clock, temperatureC: null },
    memory: memory(),
    gpus,
    notes,
  };
}
