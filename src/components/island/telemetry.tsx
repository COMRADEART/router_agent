import {
  Activity,
  Cpu,
  Gauge,
  HardDrive,
  Monitor,
  Network,
  Square,
  Thermometer,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { useIsland } from "@/store/use-island";
import { bytes, percent, recentSamples, isLocalGeneration, thermalReadingFor } from "./ui-model";
import { NAMES } from "./ui";

export function Sparkline({
  data,
  label,
  height = 48,
}: {
  data: { at: number; value: number | null }[];
  label: string;
  height?: number;
}) {
  if (data.filter((d) => d.value != null).length < 2)
    return (
      <div className="sparkline-empty">
        {data.some((d) => d.value != null) ? "Collecting samples…" : "Sensor unavailable"}
      </div>
    );
  const last = data.at(-1)!.at;
  return (
    <div
      className="sparkline"
      role="img"
      aria-label={`${label}, last 120 seconds. Gaps indicate unavailable readings.`}
    >
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <XAxis type="number" dataKey="at" hide domain={[last - 120000, last]} />
          <YAxis hide domain={[0, 100]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--working)"
            strokeWidth={1.5}
            fill="var(--working-soft)"
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Telemetry({ compact = false }: { compact?: boolean }) {
  const store = useIsland();
  const sample = store.samples.at(-1);
  const history = recentSamples(store.samples);
  const ram =
    sample && sample.memory.totalBytes > 0
      ? (sample.memory.usedBytes / sample.memory.totalBytes) * 100
      : null;
  return (
    <section className={`telemetry ${compact ? "compact" : ""}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">System</p>
          <h2>{compact ? "This workstation" : "A little room to breathe."}</h2>
        </div>
        <span className="caption">
          {sample
            ? `${store.host !== "online" ? "Last reading · " : ""}${new Date(sample.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "Awaiting Host"}
        </span>
      </div>
      {store.host !== "online" ? (
        <p className="offline-note">Workstation unreachable. Saved readings are not live.</p>
      ) : null}
      <div className="telemetry-grid">
        <article
          className="metric glass"
          data-thermal={
            store.host === "online" &&
            sample &&
            Date.now() - sample.at < 15000 &&
            sample.cpu.temperatureC != null
              ? sample.cpu.temperatureC >= store.cpuWarn
                ? "warning"
                : sample.cpu.temperatureC >= store.cpuWarn - 10
                  ? "elevated"
                  : "normal"
              : "unavailable"
          }
        >
          <header>
            <Cpu size={16} />
            <h3>CPU</h3>
            <strong>{percent(sample?.cpu.utilization)}</strong>
          </header>
          <p>
            {sample?.cpu.clockMhz != null
              ? `${(sample.cpu.clockMhz / 1000).toFixed(2)} GHz · `
              : ""}
            {sample?.cpu.temperatureC == null
              ? "Temperature unavailable"
              : `${sample.cpu.temperatureC}°C`}
          </p>
          <Sparkline
            label="CPU utilization"
            data={history.map((s) => ({ at: s.at, value: s.cpu.utilization }))}
          />
        </article>
        <article className="metric glass">
          <header>
            <Activity size={16} />
            <h3>Memory</h3>
            <strong>{percent(ram)}</strong>
          </header>
          <p>
            {sample
              ? `${bytes(sample.memory.usedBytes)} / ${bytes(sample.memory.totalBytes)}`
              : "Memory unavailable"}
          </p>
          <Sparkline
            label="Memory utilization"
            data={history.map((s) => ({
              at: s.at,
              value:
                s.memory.totalBytes > 0 ? (s.memory.usedBytes / s.memory.totalBytes) * 100 : null,
            }))}
          />
        </article>
        {sample?.gpus.map((gpu) => (
          <article
            className="metric glass"
            key={gpu.name}
            data-thermal={
              store.host === "online" &&
              sample &&
              Date.now() - sample.at < 15000 &&
              gpu.temperatureC != null
                ? gpu.temperatureC >= store.gpuWarn
                  ? "warning"
                  : gpu.temperatureC >= store.gpuWarn - 10
                    ? "elevated"
                    : "normal"
                : "unavailable"
            }
          >
            <header>
              <Gauge size={16} />
              <h3>{gpu.name}</h3>
              <strong>{percent(gpu.utilization)}</strong>
            </header>
            <p>
              {gpu.temperatureC == null ? "Temperature unavailable" : `${gpu.temperatureC}°C`}
              {gpu.memoryUsedBytes != null && gpu.memoryTotalBytes != null
                ? ` · ${bytes(gpu.memoryUsedBytes)} / ${bytes(gpu.memoryTotalBytes)} VRAM`
                : ""}
            </p>
            <Sparkline
              label={`${gpu.name} utilization`}
              data={history.map((s) => ({
                at: s.at,
                value: s.gpus.find((g) => g.name === gpu.name)?.utilization ?? null,
              }))}
            />
            {gpu.note ? <p className="caption">{gpu.note}</p> : null}
          </article>
        ))}
      </div>
      {!sample?.gpus.length ? <p className="caption">GPU telemetry unavailable.</p> : null}
      {!compact ? (
        <>
          <div className="system-connections glass">
            <div>
              <Monitor size={18} />
              <span>
                Bunny Host
                <small>
                  {store.host === "online" ? "Connected · sessions owned by Host" : "Unreachable"}
                </small>
              </span>
            </div>
            <div>
              <Network size={18} />
              <span>
                Remote connection
                <small>
                  {store.remoteConfigured
                    ? store.remoteUrl
                      ? "Secure HTTPS path configured"
                      : "Configured · address unavailable"
                    : "Not configured"}
                </small>
              </span>
            </div>
            <div>
              <HardDrive size={18} />
              <span>
                Storage<small>Capacity sensor unavailable</small>
              </span>
            </div>
          </div>
          {sample?.notes.length ? (
            <details className="sensor-notes">
              <summary>Sensor availability</summary>
              {sample.notes.map((note) => (
                <p className="caption" key={note}>
                  {note}
                </p>
              ))}
            </details>
          ) : null}
          <p className="caption">
            120-second trends · Host sensor readings · warnings never stop a task automatically.
          </p>
        </>
      ) : (
        <p className="caption">Last 120 seconds · gaps mean unavailable.</p>
      )}
    </section>
  );
}
export function thermalReading() {
  const store = useIsland.getState();
  return thermalReadingFor(store.samples, store.host, store.cpuWarn, store.gpuWarn, Date.now());
}
export function ThermalWarning({
  reading,
  onContinue,
}: {
  reading: { name: string; temperature: number };
  onContinue: () => void;
}) {
  const store = useIsland();
  const local = store.tasks.filter(isLocalGeneration);
  return (
    <section className="thermal-warning">
      <div className="section-heading">
        <Thermometer size={20} />
        <p className="eyebrow">Thermal warning</p>
      </div>
      <h2>{reading.name}</h2>
      <strong className="thermal-value">{reading.temperature}°C</strong>
      {local.length ? (
        <p>
          {NAMES.ollama} · {local[0].model || "Model unavailable"}
          <small>Local Ollama generation is active</small>
        </p>
      ) : (
        <p>Temperature is above your warning threshold.</p>
      )}
      <div className="actions">
        <button className="btn secondary" onClick={onContinue}>
          Continue
        </button>
        {local.map((task) => (
          <button className="btn danger" key={task.id} onClick={() => void store.stop(task.id)}>
            <Square size={14} />
            Stop{local.length > 1 ? ` ${task.title}` : " task"}
          </button>
        ))}
      </div>
      <p className="caption">No task will be stopped without your action.</p>
    </section>
  );
}
