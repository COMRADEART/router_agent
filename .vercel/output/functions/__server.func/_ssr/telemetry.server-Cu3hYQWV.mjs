import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region node_modules/.nitro/vite/services/ssr/assets/telemetry.server-Cu3hYQWV.js
var execFileAsync = promisify(execFile);
var previous = null;
function cpuTick() {
	const parts = (readFileSync("/proc/stat", "utf8").split("\n")[0] ?? "").trim().split(/\s+/).slice(1).map(Number);
	return {
		idle: (parts[3] ?? 0) + (parts[4] ?? 0),
		total: parts.reduce((sum, value) => sum + value, 0)
	};
}
function clockMhz() {
	try {
		const khz = Number(readFileSync("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "utf8").trim());
		if (!Number.isFinite(khz) || khz <= 0) return null;
		return Math.round(khz / 1e3);
	} catch {
		return null;
	}
}
function memory() {
	const text = readFileSync("/proc/meminfo", "utf8");
	const pick = (key) => {
		const line = text.split("\n").find((row) => row.startsWith(key));
		return Number(line?.split(/\s+/)[1] ?? 0) * 1024;
	};
	const totalBytes = pick("MemTotal:");
	const availableBytes = pick("MemAvailable:");
	return {
		totalBytes,
		availableBytes,
		usedBytes: Math.max(0, totalBytes - availableBytes)
	};
}
async function nvidia() {
	try {
		const { stdout } = await execFileAsync("nvidia-smi", ["--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw", "--format=csv,noheader,nounits"], { timeout: 1500 });
		const [name, util, used, total, temp, power] = stdout.trim().split(",").map((part) => part.trim());
		const num = (value) => {
			if (!value || value.toLowerCase() === "n/a" || value === "[not supported]") return null;
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		};
		return {
			name: name || "NVIDIA GPU",
			utilization: num(util),
			memoryUsedBytes: num(used) == null ? null : num(used) * 1024 * 1024,
			memoryTotalBytes: num(total) == null ? null : num(total) * 1024 * 1024,
			temperatureC: num(temp),
			powerW: num(power),
			note: null
		};
	} catch {
		return null;
	}
}
async function sampleHost() {
	const notes = [];
	const now = cpuTick();
	let utilization = null;
	if (previous && now.total > previous.total) {
		const total = now.total - previous.total;
		const idle = now.idle - previous.idle;
		utilization = Math.round((1 - idle / total) * 1e3) / 10;
	} else notes.push("CPU utilization appears on the next sample.");
	previous = now;
	const clock = clockMhz();
	if (clock == null) notes.push("CPU clock unavailable");
	notes.push("Temperature unavailable");
	const gpus = [];
	const nv = await nvidia();
	if (nv) gpus.push(nv);
	else notes.push("No NVIDIA GPU telemetry on this host. Intel Arc is not exposed here.");
	return {
		at: Date.now(),
		cpu: {
			utilization,
			clockMhz: clock,
			temperatureC: null
		},
		memory: memory(),
		gpus,
		notes
	};
}
//#endregion
export { sampleHost };
