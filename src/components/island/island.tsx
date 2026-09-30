import { useEffect, useState, type CSSProperties } from "react";
import { readHostTelemetry } from "@/lib/orch/telemetry";
import type { Availability, Mode, OrchTask, ProviderId, ProviderLive } from "@/lib/orch/types";
import { activeTasks, liveProviders, useIsland, type TaskFilter } from "@/store/use-island";
import { Phone } from "@/components/island/phone";

const STATUS: Record<Availability, string> = {
  ready: "Ready",
  busy: "Busy",
  offline: "Offline",
  unavailable: "Unavailable",
  rate_limited: "Rate limited",
  auth_required: "Authentication required",
};

const DOT: Record<Availability, string> = {
  ready: "#30d158",
  busy: "#ff9f0a",
  offline: "#8e8e93",
  unavailable: "#8e8e93",
  rate_limited: "#ff9f0a",
  auth_required: "#ff453a",
};

function elapsed(task: OrchTask, now: number) {
  const end = task.finishedAt ?? now;
  const start = task.startedAt ?? task.createdAt;
  const seconds = Math.max(0, Math.floor((end - start) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function gb(bytes: number) {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="text-[13px] text-[var(--muted)]">Waiting for samples.</p>;
  const w = 280;
  const h = 36;
  const max = Math.max(100, ...values);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * w;
      const y = h - (value / max) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-9 w-full text-[var(--accent)]" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points={points} />
    </svg>
  );
}

export function Island() {
  const hydrate = useIsland((state) => state.hydrate);
  const theme = useIsland((state) => state.theme);
  const sheet = useIsland((state) => state.sheet);
  const setSheet = useIsland((state) => state.setSheet);
  const tasks = useIsland((state) => state.tasks);
  const notice = useIsland((state) => state.notice);
  const dismissNotice = useIsland((state) => state.dismissNotice);
  const refreshOllama = useIsland((state) => state.refreshOllama);
  const pushSample = useIsland((state) => state.pushSample);
  const ollamaUp = useIsland((state) => state.ollamaUp);
  const ollamaModels = useIsland((state) => state.ollamaModels);
  const extensions = useIsland((state) => state.extensions);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    hydrate();
  }, [hydrate]);
  useEffect(() => {
    void refreshOllama();
    const id = window.setInterval(() => void refreshOllama(), 15000);
    return () => window.clearInterval(id);
  }, [refreshOllama]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const sample = await readHostTelemetry();
        if (!stop) pushSample(sample);
      } catch {
        /* host sample failed; the panel stays empty rather than inventing numbers */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [pushSample]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const providers = liveProviders({ tasks, ollamaUp, ollamaModels, extensions });
  const running = activeTasks(tasks);
  const open = sheet != null && sheet !== "phone";

  if (sheet === "phone") return <Phone />;

  return (
    <div
      className="fixed inset-0 overflow-auto"
      style={
        theme === "dark"
          ? ({
              "--glass": "#2c2c2e",
              "--glass-line": "rgba(255,255,255,0.14)",
              "--fg": "#f5f5f7",
              "--muted": "#98989d",
              "--accent": "#0a84ff",
              "--field": "rgba(255,255,255,0.06)",
              background: "#1c1c1e",
              color: "#f5f5f7",
            } as CSSProperties)
          : ({
              "--glass": "#ffffff",
              "--glass-line": "rgba(0,0,0,0.08)",
              "--fg": "#1d1d1f",
              "--muted": "#6e6e73",
              "--accent": "#007aff",
              "--field": "rgba(0,0,0,0.04)",
              background: "#d2d2d7",
              color: "#1d1d1f",
            } as CSSProperties)
      }
    >
      <div className="mx-auto w-[min(860px,calc(100%-20px))] pt-4">
        <div className={`glass ${open ? "rounded-[28px]" : "rounded-full"}`}>
          <Bar providers={providers} running={running} now={now} />
          {open ? (
            <div className="max-h-[min(70vh,640px)] overflow-auto border-t border-[var(--glass-line)] px-4 py-4">
              {sheet === "compose" ? <Composer /> : null}
              {sheet === "decision" ? <Decision /> : null}
              {sheet === "provider" ? <ProviderPanel providers={providers} /> : null}
              {sheet === "system" ? <SystemPanel /> : null}
              {sheet === "tasks" ? <Tasks now={now} /> : null}
              {sheet === "extensions" ? <Extensions providers={providers} /> : null}
              {sheet === "project" ? <Projects /> : null}
            </div>
          ) : null}
        </div>
        {!open && running.length === 0 ? (
          <p className="mt-4 text-center text-[13px] text-[var(--muted)]">JEV routes the task. It does not write the answer.</p>
        ) : null}
        {notice ? (
          <button type="button" onClick={dismissNotice} className="glass mx-auto mt-3 block max-w-md rounded-2xl px-4 py-3 text-left text-[13px]">
            {notice}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Bar({ providers, running, now }: { providers: ProviderLive[]; running: OrchTask[]; now: number }) {
  const setSheet = useIsland((state) => state.setSheet);
  const sheet = useIsland((state) => state.sheet);
  const setProviderFocus = useIsland((state) => state.setProviderFocus);
  const primary = providers.filter((provider) => !provider.extension);
  const one = running.length === 1 ? running[0] : null;

  return (
    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
      <button
        type="button"
        onClick={() => setSheet(sheet === "compose" ? null : "compose")}
        className="tap min-h-11 rounded-full px-3 text-[15px] font-semibold"
      >
        JEV
      </button>
      {one ? (
        <button type="button" onClick={() => setSheet("tasks")} className="tap flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 text-left">
          <span className="truncate text-[15px] font-medium">{one.title}</span>
          <span className="text-[13px] text-[var(--muted)]">{providers.find((provider) => provider.id === one.provider)?.name}</span>
          <span className="text-[13px] capitalize text-[var(--muted)]">{one.state.replaceAll("_", " ")}</span>
          <span className="ml-auto text-[13px] tabular-nums">{elapsed(one, now)}</span>
        </button>
      ) : running.length > 1 ? (
        <button type="button" onClick={() => setSheet("tasks")} className="tap min-h-11 flex-1 px-2 text-left text-[15px]">
          {running.length} tasks running
        </button>
      ) : (
        primary.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setProviderFocus(provider.id)}
            className="tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium"
          >
            <span className="size-1.5 rounded-full" style={{ background: DOT[provider.availability] }} />
            {provider.name}
          </button>
        ))
      )}
      {one && (one.state === "running" || one.state === "launching") ? (
        <div className="mx-2 h-1 w-full overflow-hidden rounded-full bg-[var(--field)] sm:order-last sm:w-28">
          <div className="indeterminate h-full bg-[var(--accent)]" />
        </div>
      ) : null}
      <span className="ml-auto flex items-center">
        <button type="button" aria-label="Extensions" onClick={() => setSheet(sheet === "extensions" ? null : "extensions")} className="tap min-h-11 min-w-11 rounded-full text-[20px] leading-none">
          +
        </button>
        <button type="button" onClick={() => setSheet(sheet === "system" ? null : "system")} className="tap min-h-11 rounded-full px-2.5 text-[14px]">
          System
        </button>
        <button type="button" onClick={() => setSheet("phone")} className="tap min-h-11 rounded-full px-2.5 text-[14px]">
          Phone
        </button>
      </span>
    </div>
  );
}

function Composer() {
  const prompt = useIsland((state) => state.prompt);
  const mode = useIsland((state) => state.mode);
  const autoRoute = useIsland((state) => state.autoRoute);
  const override = useIsland((state) => state.override);
  const projectId = useIsland((state) => state.projectId);
  const projects = useIsland((state) => state.projects);
  const setPrompt = useIsland((state) => state.setPrompt);
  const setMode = useIsland((state) => state.setMode);
  const setAutoRoute = useIsland((state) => state.setAutoRoute);
  const setOverride = useIsland((state) => state.setOverride);
  const setProjectId = useIsland((state) => state.setProjectId);
  const setSheet = useIsland((state) => state.setSheet);
  const submit = useIsland((state) => state.submit);
  const modes: Mode[] = ["fast", "balanced", "deep"];

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="flex flex-col gap-2 text-[13px] text-[var(--muted)]">
        What do you want done?
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          className="min-h-28 w-full resize-y rounded-2xl bg-[var(--field)] px-3 py-3 text-[17px] text-[var(--fg)] outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Mode">
        {modes.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={mode === item}
            onClick={() => setMode(item)}
            className="tap min-h-11 rounded-full px-4 text-[15px] capitalize"
            style={{ background: mode === item ? "var(--accent)" : "var(--field)", color: mode === item ? "#fff" : "var(--fg)" }}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center justify-between text-[15px]">
        Auto route
        <input type="checkbox" checked={autoRoute} onChange={(event) => setAutoRoute(event.target.checked)} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
        Provider override
        <select
          value={override}
          aria-label="Provider override"
          disabled={autoRoute}
          onChange={(event) => setOverride(event.target.value as ProviderId | "auto")}
          className="min-h-11 rounded-xl bg-[var(--field)] px-3 text-[15px] text-[var(--fg)] disabled:opacity-50"
        >
          <option value="auto">Auto</option>
          {(["codex", "claude", "ollama", "cline", "cursor"] as ProviderId[]).map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-[var(--muted)]">
        Project
        <select
          value={projectId ?? ""}
          aria-label="Project"
          onChange={(event) => setProjectId(event.target.value || null)}
          className="min-h-11 rounded-xl bg-[var(--field)] px-3 text-[15px] text-[var(--fg)]"
        >
          <option value="">None</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <button type="submit" className="tap min-h-11 flex-1 rounded-full bg-[var(--accent)] text-[15px] font-medium text-white">
          Route
        </button>
        <button type="button" onClick={() => setSheet("project")} className="tap min-h-11 rounded-full px-4 text-[15px] text-[var(--accent)]">
          Projects
        </button>
      </div>
    </form>
  );
}

function Decision() {
  const id = useIsland((state) => state.decisionTaskId);
  const task = useIsland((state) => state.tasks.find((item) => item.id === id));
  const run = useIsland((state) => state.run);
  const stop = useIsland((state) => state.stop);
  const retarget = useIsland((state) => state.retarget);
  const setSheet = useIsland((state) => state.setSheet);
  const [changing, setChanging] = useState(false);
  if (!task) return <p className="text-[15px] text-[var(--muted)]">No decision open.</p>;
  const decision = task.decision;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[17px] font-semibold">{task.title}</p>
      <p className="text-[13px] text-[var(--muted)]">JEV router</p>
      <p className="text-[15px]">
        {decision.task_type} · complexity {decision.complexity.toFixed(2)} · {task.mode}
      </p>
      <p className="text-[20px] font-semibold capitalize">{task.provider}</p>
      <p className="text-[15px] text-[var(--muted)]">{decision.reason}</p>
      <p className="text-[13px] tabular-nums text-[var(--muted)]">Confidence {Math.round(decision.confidence * 100)}%</p>
      <ul className="flex flex-col gap-2">
        {decision.alternatives.map((alt) => (
          <li key={alt.provider} className="text-[14px]">
            <span className="capitalize">{alt.provider}</span>
            <span className="text-[var(--muted)]"> — {alt.note}</span>
          </li>
        ))}
      </ul>
      {changing ? (
        <div className="flex flex-wrap gap-2">
          {(["codex", "claude", "ollama", "cline", "cursor"] as ProviderId[]).map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => {
                retarget(task.id, provider);
                setChanging(false);
              }}
              className="tap min-h-11 rounded-full bg-[var(--field)] px-3 text-[14px] capitalize"
            >
              {provider}
            </button>
          ))}
        </div>
      ) : null}
      {task.state === "waiting_for_approval" ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void run(task.id)} className="tap min-h-11 rounded-full bg-[var(--accent)] px-5 text-[15px] font-medium text-white">
            Run
          </button>
          <button type="button" onClick={() => setChanging((value) => !value)} className="tap min-h-11 rounded-full px-4 text-[15px] text-[var(--accent)]">
            Change
          </button>
          <button type="button" onClick={() => void stop(task.id)} className="tap min-h-11 rounded-full px-4 text-[15px] text-[var(--muted)]">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] capitalize">{task.state.replaceAll("_", " ")}</p>
          {task.error ? <p className="text-[15px] text-[var(--muted)]">{task.error}</p> : null}
          {task.output ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-[13px]">{task.output}</pre> : null}
          <button type="button" onClick={() => setSheet("tasks")} className="tap min-h-11 self-start text-[15px] text-[var(--accent)]">
            Tasks
          </button>
        </div>
      )}
    </div>
  );
}

function ProviderPanel({ providers }: { providers: ProviderLive[] }) {
  const id = useIsland((state) => state.providerFocus);
  const provider = providers.find((item) => item.id === id);
  const tasks = useIsland((state) => state.tasks.filter((task) => task.provider === id).slice(0, 5));
  const setSheet = useIsland((state) => state.setSheet);
  const setOverride = useIsland((state) => state.setOverride);
  if (!provider) return null;
  const blocks = provider.usage ? Math.round(provider.usage.percent / 12.5) : 0;

  return (
    <div className="flex flex-col gap-2 text-[15px]">
      <p className="text-[20px] font-semibold">{provider.name}</p>
      <p>
        <span className="mr-2 inline-block size-1.5 rounded-full align-middle" style={{ background: DOT[provider.availability] }} />
        {STATUS[provider.availability]}
      </p>
      <p className="text-[var(--muted)]">{provider.local_or_cloud === "local" ? "Local" : "Cloud"}</p>
      <p>Model: {provider.current_model ?? "Unavailable"}</p>
      <p>
        Usage: {provider.usage ? `${provider.usage.label} ${provider.usage.percent}%` : provider.usage_note}
        {provider.usage?.reset ? ` · resets ${provider.usage.reset}` : ""}
      </p>
      {provider.usage ? <p className="tracking-[0.2em]">{`${"■".repeat(blocks)}${"□".repeat(8 - blocks)}`}</p> : null}
      <p className="text-[var(--muted)]">{provider.detail}</p>
      {provider.id === "ollama" ? (
        <>
          <p>VRAM: {provider.vram ?? "Unavailable"}</p>
          <p>Tokens/sec: {provider.tokens_per_sec ?? "Unavailable"}</p>
          <p className="text-[13px] text-[var(--muted)]">Context size is not exposed by the tags endpoint.</p>
        </>
      ) : null}
      <p>Latency estimate: {provider.latency_estimate_ms == null ? "Unavailable" : `${provider.latency_estimate_ms} ms`}</p>
      <p className="text-[13px] text-[var(--muted)]">Recent</p>
      {tasks.length === 0 ? <p className="text-[var(--muted)]">No tasks yet.</p> : null}
      <ul>
        {tasks.map((task) => (
          <li key={task.id} className="flex justify-between gap-3 py-1">
            <span className="truncate">{task.title}</span>
            <span className="capitalize text-[var(--muted)]">{task.state.replaceAll("_", " ")}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setOverride(provider.id);
          setSheet("compose");
        }}
        className="tap min-h-11 self-start text-[15px] text-[var(--accent)]"
      >
        Start with {provider.name}
      </button>
    </div>
  );
}

function SystemPanel() {
  const samples = useIsland((state) => state.samples);
  const theme = useIsland((state) => state.theme);
  const setTheme = useIsland((state) => state.setTheme);
  const cpuWarn = useIsland((state) => state.cpuWarn);
  const gpuWarn = useIsland((state) => state.gpuWarn);
  const setCpuWarn = useIsland((state) => state.setCpuWarn);
  const setGpuWarn = useIsland((state) => state.setGpuWarn);
  const latest = samples[samples.length - 1];
  const cpu = samples.map((sample) => sample.cpu.utilization).filter((value): value is number => value != null);
  const ram = samples.map((sample) => (sample.memory.totalBytes ? (sample.memory.usedBytes / sample.memory.totalBytes) * 100 : 0));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-[var(--muted)]">This preview host is not your Windows PC. Missing sensors stay blank.</p>
      <section>
        <p className="text-[13px] text-[var(--muted)]">CPU</p>
        <p className="text-[22px] font-semibold tabular-nums">{latest?.cpu.utilization == null ? "—" : `${latest.cpu.utilization}%`}</p>
        <p className="text-[13px] text-[var(--muted)]">
          {latest?.cpu.clockMhz == null ? "Clock unavailable" : `${(latest.cpu.clockMhz / 1000).toFixed(2)} GHz`}
          {" · "}
          {latest?.cpu.temperatureC == null ? "Temperature unavailable" : `${latest.cpu.temperatureC}°C`}
        </p>
        <Spark values={cpu} />
      </section>
      <section>
        <p className="text-[13px] text-[var(--muted)]">RAM</p>
        <p className="text-[22px] font-semibold tabular-nums">
          {latest ? `${gb(latest.memory.usedBytes)} / ${gb(latest.memory.totalBytes)}` : "—"}
        </p>
        <Spark values={ram} />
      </section>
      {latest && latest.gpus.length === 0 ? (
        <p className="text-[15px]">No GPU telemetry. Intel Arc and RTX 4050 are not on this host.</p>
      ) : null}
      {latest?.gpus.map((gpu) => (
        <section key={gpu.name}>
          <p className="text-[13px] text-[var(--muted)]">{gpu.name}</p>
          <p className="text-[22px] font-semibold tabular-nums">{gpu.utilization == null ? "—" : `${gpu.utilization}%`}</p>
          <p className="text-[13px] text-[var(--muted)]">
            {gpu.memoryUsedBytes != null && gpu.memoryTotalBytes != null
              ? `${gb(gpu.memoryUsedBytes)} / ${gb(gpu.memoryTotalBytes)}`
              : "Memory unavailable"}
            {" · "}
            {gpu.temperatureC == null ? "Temperature unavailable" : `${gpu.temperatureC}°C`}
            {gpu.powerW == null ? "" : ` · ${gpu.powerW} W`}
          </p>
        </section>
      ))}
      <label className="flex items-center justify-between text-[15px]">
        CPU warning °C
        <input
          type="number"
          value={cpuWarn}
          min={40}
          max={110}
          onChange={(event) => setCpuWarn(Number(event.target.value))}
          className="min-h-11 w-20 rounded-xl bg-[var(--field)] px-2 text-right"
        />
      </label>
      <label className="flex items-center justify-between text-[15px]">
        NVIDIA warning °C
        <input
          type="number"
          value={gpuWarn}
          min={40}
          max={110}
          onChange={(event) => setGpuWarn(Number(event.target.value))}
          className="min-h-11 w-20 rounded-xl bg-[var(--field)] px-2 text-right"
        />
      </label>
      <p className="text-[13px] text-[var(--muted)]">Jobs are not stopped automatically.</p>
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="tap min-h-11 self-start text-[15px] text-[var(--accent)]">
        {theme === "dark" ? "Light theme" : "Dark theme"}
      </button>
    </div>
  );
}

function Tasks({ now }: { now: number }) {
  const tasks = useIsland((state) => state.tasks);
  const drafts = useIsland((state) => state.drafts);
  const filter = useIsland((state) => state.filter);
  const setFilter = useIsland((state) => state.setFilter);
  const openDecision = useIsland((state) => state.openDecision);
  const stop = useIsland((state) => state.stop);
  const pause = useIsland((state) => state.pause);
  const resume = useIsland((state) => state.resume);
  const restart = useIsland((state) => state.restart);
  const sendDrafts = useIsland((state) => state.sendDrafts);
  const host = useIsland((state) => state.host);
  const filters: TaskFilter[] = ["all", "running", "completed", "failed", "stopped"];
  const shown = tasks.filter((task) => {
    if (filter === "all") return true;
    if (filter === "running") return activeTasks([task]).length > 0;
    return task.state === filter;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className="tap min-h-11 rounded-full px-3 text-[13px] capitalize"
            style={{ background: filter === item ? "var(--accent)" : "var(--field)", color: filter === item ? "#fff" : "var(--fg)" }}
          >
            {item}
          </button>
        ))}
      </div>
      {drafts.length > 0 ? (
        <div className="rounded-2xl bg-[var(--field)] px-3 py-3">
          <p className="text-[15px]">{drafts.length} queued</p>
          <button type="button" disabled={host !== "online"} onClick={sendDrafts} className="tap mt-2 min-h-11 text-[15px] text-[var(--accent)] disabled:opacity-40">
            Send queued
          </button>
        </div>
      ) : null}
      {shown.length === 0 ? <p className="text-[15px] text-[var(--muted)]">No tasks in this filter.</p> : null}
      <ul className="flex flex-col">
        {shown.map((task) => (
          <li key={task.id} className="border-b border-[var(--glass-line)] py-3">
            <button type="button" onClick={() => openDecision(task.id)} className="tap block w-full text-left">
              <span className="block text-[17px] font-medium">{task.title}</span>
              <span className="text-[13px] capitalize text-[var(--muted)]">
                {task.provider} · {task.state.replaceAll("_", " ")} · {elapsed(task, now)}
              </span>
            </button>
            <div className="mt-1 flex flex-wrap gap-1">
              {task.state === "running" || task.state === "launching" ? (
                <>
                  <TextButton onClick={() => pause(task.id)}>Pause</TextButton>
                  <TextButton onClick={() => void stop(task.id)}>Stop</TextButton>
                </>
              ) : null}
              {task.state === "paused" ? <TextButton onClick={() => resume(task.id)}>Resume</TextButton> : null}
              {task.state === "waiting_for_approval" ? <TextButton onClick={() => openDecision(task.id)}>Open</TextButton> : null}
              {task.state === "completed" || task.state === "failed" || task.state === "stopped" ? (
                <TextButton onClick={() => restart(task.id)}>Restart</TextButton>
              ) : null}
            </div>
            {task.error ? <p className="mt-1 text-[13px] text-[var(--muted)]">{task.error}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="tap min-h-11 px-2 text-[15px] text-[var(--accent)]">
      {children}
    </button>
  );
}

function Extensions({ providers }: { providers: ProviderLive[] }) {
  const extensions = useIsland((state) => state.extensions);
  const setExtension = useIsland((state) => state.setExtension);
  const setProviderFocus = useIsland((state) => state.setProviderFocus);
  const extra = providers.filter((provider) => provider.extension);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-[var(--muted)]">Cline and Cursor stay off the bar. Enabling a slot does not install an adapter.</p>
      {extra.map((provider) => (
        <div key={provider.id} className="flex min-h-11 items-center justify-between gap-3">
          <button type="button" onClick={() => setProviderFocus(provider.id)} className="tap text-left text-[17px]">
            {provider.name}
            <span className="block text-[13px] text-[var(--muted)]">{provider.detail}</span>
          </button>
          <input
            type="checkbox"
            aria-label={`${provider.name} slot`}
            checked={provider.id === "cline" ? extensions.cline : extensions.cursor}
            onChange={(event) => setExtension(provider.id as "cline" | "cursor", event.target.checked)}
          />
        </div>
      ))}
      <p className="text-[15px] text-[var(--muted)]">Add provider — the adapter interface is in the orchestrator. No extra plugin is installed.</p>
    </div>
  );
}

function Projects() {
  const projects = useIsland((state) => state.projects);
  const addProject = useIsland((state) => state.addProject);
  const removeProject = useIsland((state) => state.removeProject);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        addProject(name, path);
        setName("");
        setPath("");
      }}
    >
      <p className="text-[13px] text-[var(--muted)]">Only paths you type are stored. The disk is not scanned.</p>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" aria-label="Project name" className="min-h-11 rounded-xl bg-[var(--field)] px-3" />
      <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="C:\Projects\app" aria-label="Project path" className="min-h-11 rounded-xl bg-[var(--field)] px-3" />
      <button type="submit" className="tap min-h-11 self-start text-[15px] text-[var(--accent)]">
        Register
      </button>
      <ul>
        {projects.map((project) => (
          <li key={project.id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="block text-[15px]">{project.name}</span>
              <span className="block text-[13px] text-[var(--muted)]">{project.path}</span>
            </span>
            <button type="button" onClick={() => removeProject(project.id)} className="tap min-h-11 text-[15px] text-[var(--muted)]">
              Remove
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}
