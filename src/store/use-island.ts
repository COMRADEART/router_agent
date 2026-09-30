import { create } from "zustand";
import { probeExecutors, runExecutor, stopExecutor } from "@/lib/orch/exec";
import { canTransition } from "@/lib/orch/machine";
import { routeTask } from "@/lib/orch/router";
import type {
  HostPresence,
  HostSample,
  Mode,
  OrchTask,
  Project,
  ProviderId,
  ProviderLive,
  TaskState,
} from "@/lib/orch/types";

const KEY = "jev.island.v1";

export type Sheet =
  | "compose"
  | "decision"
  | "provider"
  | "system"
  | "tasks"
  | "extensions"
  | "phone"
  | "project"
  | null;

export type TaskFilter = "all" | "running" | "completed" | "failed" | "stopped";

type Persisted = {
  theme: "dark" | "light";
  projects: Project[];
  tasks: OrchTask[];
  drafts: Draft[];
  extensions: { cline: boolean; cursor: boolean };
  autoSubmit: boolean;
  cpuWarn: number;
  gpuWarn: number;
  audit: { at: number; line: string }[];
};

export type Draft = {
  id: string;
  prompt: string;
  mode: Mode;
  projectId: string | null;
  createdAt: number;
};

type Island = Persisted & {
  sheet: Sheet;
  providerFocus: ProviderId | null;
  decisionTaskId: string | null;
  prompt: string;
  mode: Mode;
  autoRoute: boolean;
  override: ProviderId | "auto";
  projectId: string | null;
  host: HostPresence;
  samples: HostSample[];
  ollamaUp: boolean;
  ollamaModels: string[];
  notice: string | null;
  filter: TaskFilter;
  hydrated: boolean;
  hydrate: () => void;
  setSheet: (sheet: Sheet) => void;
  setTheme: (theme: "dark" | "light") => void;
  setPrompt: (prompt: string) => void;
  setMode: (mode: Mode) => void;
  setAutoRoute: (autoRoute: boolean) => void;
  setOverride: (override: ProviderId | "auto") => void;
  setProjectId: (projectId: string | null) => void;
  setProviderFocus: (id: ProviderId) => void;
  setFilter: (filter: TaskFilter) => void;
  setHost: (host: HostPresence) => void;
  setAutoSubmit: (autoSubmit: boolean) => void;
  setCpuWarn: (cpuWarn: number) => void;
  setGpuWarn: (gpuWarn: number) => void;
  setExtension: (id: "cline" | "cursor", on: boolean) => void;
  addProject: (name: string, path: string) => void;
  removeProject: (id: string) => void;
  dismissNotice: () => void;
  note: (line: string) => void;
  refreshOllama: () => Promise<void>;
  pushSample: (sample: HostSample) => void;
  submit: () => void;
  sendDrafts: () => void;
  run: (id: string) => Promise<void>;
  stop: (id: string) => Promise<void>;
  pause: (id: string) => void;
  resume: (id: string) => void;
  restart: (id: string) => void;
  retarget: (id: string, provider: ProviderId) => void;
  openDecision: (id: string) => void;
};

const ACTIVE: TaskState[] = [
  "queued",
  "routing",
  "waiting_for_approval",
  "launching",
  "running",
  "waiting_for_input",
  "paused",
];

function load(): Partial<Persisted> {
  if (typeof localStorage === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Persisted | null;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function save(state: Island) {
  const payload: Persisted = {
    theme: state.theme,
    projects: state.projects,
    tasks: state.tasks.slice(0, 40),
    drafts: state.drafts,
    extensions: state.extensions,
    autoSubmit: state.autoSubmit,
    cpuWarn: state.cpuWarn,
    gpuWarn: state.gpuWarn,
    audit: state.audit.slice(0, 80),
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

function titleOf(prompt: string) {
  const line = prompt.trim().split("\n")[0] ?? "Task";
  return line.length > 42 ? `${line.slice(0, 41)}…` : line || "Task";
}

function withState(task: OrchTask, state: TaskState, patch: Partial<OrchTask> = {}): OrchTask {
  if (!canTransition(task.state, state) && task.state !== state) return task;
  return { ...task, ...patch, state };
}

export function liveProviders(state: Pick<Island, "tasks" | "ollamaUp" | "ollamaModels" | "extensions">): ProviderLive[] {
  const jobs = (id: ProviderId) => state.tasks.filter((task) => task.provider === id && ACTIVE.includes(task.state)).length;
  const base = (id: ProviderId, name: string, cloud: boolean, extension: boolean): ProviderLive => ({
    id,
    name,
    availability: "unavailable",
    installed: false,
    authenticated: false,
    local_or_cloud: cloud ? "cloud" : "local",
    supported_task_types: ["coding", "debug", "research", "writing", "ops", "general"],
    current_model: null,
    usage: null,
    usage_note: "Usage unavailable",
    active_jobs: jobs(id),
    latency_estimate_ms: null,
    extension,
    detail: "Adapter is not configured on this host.",
    vram: null,
    tokens_per_sec: null,
  });
  const ollama = base("ollama", "Ollama", false, false);
  if (state.ollamaUp) {
    ollama.availability = jobs("ollama") > 0 ? "busy" : "ready";
    ollama.installed = true;
    ollama.authenticated = true;
    ollama.current_model = state.ollamaModels[0] ?? null;
    ollama.usage_note = "Local — no quota meter";
    ollama.latency_estimate_ms = 500;
    ollama.detail = state.ollamaModels.length ? state.ollamaModels.join(", ") : "Running, no model pulled.";
    ollama.vram = null;
  } else {
    ollama.availability = "offline";
    ollama.detail = "Offline at 127.0.0.1:11434.";
    ollama.usage_note = "Local — offline";
  }
  const codex = base("codex", "Codex", true, false);
  codex.availability = "auth_required";
  codex.detail = "No Codex credential on this host. Usage unavailable.";
  const claude = base("claude", "Claude", true, false);
  claude.availability = "auth_required";
  claude.detail = "No Claude credential on this host. Usage unavailable.";
  const cline = base("cline", "Cline", true, true);
  cline.installed = false;
  cline.detail = state.extensions.cline
    ? "Extension slot is on. No Cline adapter is installed."
    : "Extension is off.";
  const cursor = base("cursor", "Cursor", true, true);
  cursor.detail = state.extensions.cursor
    ? "Extension slot is on. No Cursor adapter is installed."
    : "Extension is off.";
  return [codex, claude, ollama, cline, cursor];
}

export const useIsland = create<Island>((set, get) => ({
  theme: "dark",
  projects: [],
  tasks: [],
  drafts: [],
  extensions: { cline: false, cursor: false },
  autoSubmit: false,
  cpuWarn: 90,
  gpuWarn: 85,
  audit: [],
  sheet: null,
  providerFocus: null,
  decisionTaskId: null,
  prompt: "",
  mode: "balanced",
  autoRoute: true,
  override: "auto",
  projectId: null,
  host: "online",
  samples: [],
  ollamaUp: false,
  ollamaModels: [],
  notice: null,
  filter: "all",
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    const loaded = load();
    const tasks = (loaded.tasks ?? []).map((task) =>
      task.state === "running" || task.state === "launching"
        ? {
            ...task,
            state: "failed" as const,
            error: "The host restarted before this executor returned.",
            finishedAt: task.finishedAt ?? Date.now(),
          }
        : task,
    );
    set({ ...loaded, tasks, hydrated: true });
  },
  setSheet: (sheet) => set({ sheet }),
  setTheme: (theme) => {
    set({ theme });
    save(get());
  },
  setPrompt: (prompt) => set({ prompt }),
  setMode: (mode) => set({ mode }),
  setAutoRoute: (autoRoute) => set({ autoRoute, override: autoRoute ? "auto" : get().override }),
  setOverride: (override) => set({ override, autoRoute: override === "auto" }),
  setProjectId: (projectId) => set({ projectId }),
  setProviderFocus: (providerFocus) => set({ providerFocus, sheet: "provider" }),
  setFilter: (filter) => set({ filter }),
  setHost: (host) => {
    set({ host });
    get().note(host === "online" ? "Workstation is online." : "Workstation is sleeping. New phone tasks stay queued.");
    if (host === "online" && get().autoSubmit) get().sendDrafts();
  },
  setAutoSubmit: (autoSubmit) => {
    set({ autoSubmit });
    save(get());
    if (autoSubmit && get().host === "online") get().sendDrafts();
  },
  setCpuWarn: (cpuWarn) => {
    set({ cpuWarn });
    save(get());
  },
  setGpuWarn: (gpuWarn) => {
    set({ gpuWarn });
    save(get());
  },
  setExtension: (id, on) => {
    set({ extensions: { ...get().extensions, [id]: on } });
    save(get());
    get().note(`${id} extension slot ${on ? "on" : "off"}.`);
  },
  addProject: (name, path) => {
    const project: Project = { id: crypto.randomUUID(), name: name.trim(), path: path.trim(), preferred: "auto" };
    if (!project.name || !project.path) return;
    set({ projects: [project, ...get().projects] });
    save(get());
    get().note(`Project ${project.name} registered. No disk scan.`);
  },
  removeProject: (id) => {
    set({ projects: get().projects.filter((project) => project.id !== id) });
    save(get());
  },
  dismissNotice: () => set({ notice: null }),
  note: (line) => {
    set({ audit: [{ at: Date.now(), line }, ...get().audit].slice(0, 80), notice: line });
    save(get());
  },
  refreshOllama: async () => {
    try {
      const probe = await probeExecutors();
      set({ ollamaUp: probe.up, ollamaModels: probe.models });
    } catch {
      set({ ollamaUp: false, ollamaModels: [] });
    }
  },
  pushSample: (sample) => {
    const samples = [...get().samples, sample].slice(-60);
    set({ samples });
    const cpu = sample.cpu.temperatureC;
    const hotGpu = sample.gpus.find((gpu) => gpu.temperatureC != null && gpu.temperatureC >= get().gpuWarn);
    if (cpu != null && cpu >= get().cpuWarn) get().note(`Thermal warning. CPU ${cpu}°C.`);
    if (hotGpu?.temperatureC != null) get().note(`Thermal warning. ${hotGpu.name} ${hotGpu.temperatureC}°C.`);
  },
  submit: () => {
    const { prompt, mode, projectId, host, autoRoute, override } = get();
    const text = prompt.trim();
    if (!text) return;
    if (host === "sleeping") {
      const draft: Draft = { id: crypto.randomUUID(), prompt: text, mode, projectId, createdAt: Date.now() };
      set({ drafts: [draft, ...get().drafts], prompt: "", sheet: "tasks" });
      get().note(get().autoSubmit ? "Queued until the workstation is online." : "Queued. Auto-send is off.");
      return;
    }
    const providers = liveProviders(get());
    const decision = routeTask({
      prompt: text,
      mode,
      providers,
      override: autoRoute ? "auto" : override,
    });
    const task: OrchTask = {
      id: crypto.randomUUID(),
      title: titleOf(text),
      prompt: text,
      projectId,
      mode,
      state: "waiting_for_approval",
      provider: decision.recommended_provider,
      model: decision.recommended_model,
      decision,
      manual: !autoRoute && override !== "auto",
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      output: "",
      error: null,
      logs: [{ at: Date.now(), line: "Routed. Waiting for approval." }],
      pauseSupported: false,
    };
    set({
      tasks: [task, ...get().tasks],
      prompt: "",
      decisionTaskId: task.id,
      sheet: "decision",
    });
    save(get());
    get().note(`Route ${task.title} → ${decision.recommended_provider}.`);
  },
  sendDrafts: () => {
    const drafts = get().drafts;
    if (!drafts.length || get().host !== "online") return;
    set({ drafts: [] });
    for (const draft of drafts) {
      set({ prompt: draft.prompt, mode: draft.mode, projectId: draft.projectId, autoRoute: true, override: "auto" });
      get().submit();
    }
  },
  run: async (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || !canTransition(task.state, "launching")) return;
    const launching = withState(task, "launching", {
      startedAt: Date.now(),
      logs: [...task.logs, { at: Date.now(), line: `Launching ${task.provider}.` }],
    });
    set({ tasks: get().tasks.map((item) => (item.id === id ? launching : item)) });
    const running = withState(launching, "running", {
      logs: [...launching.logs, { at: Date.now(), line: "Running." }],
    });
    set({ tasks: get().tasks.map((item) => (item.id === id ? running : item)) });
    const result = await runExecutor({
      data: { taskId: id, provider: task.provider, model: task.model, prompt: task.prompt },
    });
    const current = get().tasks.find((item) => item.id === id);
    if (!current || current.state === "stopped") return;
    if (result.stopped) {
      set({
        tasks: get().tasks.map((item) =>
          item.id === id
            ? withState(item, "stopped", { finishedAt: Date.now(), logs: [...item.logs, { at: Date.now(), line: result.log }] })
            : item,
        ),
      });
    } else if (result.ok) {
      set({
        tasks: get().tasks.map((item) =>
          item.id === id
            ? withState(item, "completed", {
                finishedAt: Date.now(),
                output: result.output ?? "",
                logs: [...item.logs, { at: Date.now(), line: result.log }],
              })
            : item,
        ),
      });
      get().note(`${current.title} completed.`);
    } else {
      set({
        tasks: get().tasks.map((item) =>
          item.id === id
            ? withState(item, "failed", {
                finishedAt: Date.now(),
                error: result.error ?? "Failed.",
                logs: [...item.logs, { at: Date.now(), line: result.log }],
              })
            : item,
        ),
      });
      get().note(result.error ?? "Task failed.");
    }
    save(get());
  },
  stop: async (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || !canTransition(task.state, "stopped")) return;
    await stopExecutor({ data: { taskId: id } }).catch(() => undefined);
    set({
      tasks: get().tasks.map((item) =>
        item.id === id
          ? withState(item, "stopped", {
              finishedAt: Date.now(),
              logs: [...item.logs, { at: Date.now(), line: "Stopped this task only." }],
            })
          : item,
      ),
    });
    save(get());
    get().note(`Stopped ${task.title}.`);
  },
  pause: (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task) return;
    if (!task.pauseSupported) {
      get().note("Pause is not supported by this executor. Stop ends only this task.");
      return;
    }
    if (!canTransition(task.state, "paused")) return;
    set({
      tasks: get().tasks.map((item) => (item.id === id ? withState(item, "paused") : item)),
    });
    save(get());
  },
  resume: (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || !canTransition(task.state, "running")) return;
    set({ tasks: get().tasks.map((item) => (item.id === id ? withState(item, "running") : item)) });
    save(get());
  },
  restart: (id) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task) return;
    set({ prompt: task.prompt, mode: task.mode, projectId: task.projectId, autoRoute: !task.manual, override: task.manual ? task.provider : "auto" });
    get().submit();
  },
  retarget: (id, provider) => {
    const task = get().tasks.find((item) => item.id === id);
    if (!task || task.state !== "waiting_for_approval") return;
    const providers = liveProviders(get());
    const decision = routeTask({ prompt: task.prompt, mode: task.mode, providers, override: provider });
    set({
      tasks: get().tasks.map((item) =>
        item.id === id
          ? {
              ...item,
              provider,
              model: decision.recommended_model,
              decision,
              manual: true,
              logs: [...item.logs, { at: Date.now(), line: `Changed executor to ${provider}.` }],
            }
          : item,
      ),
    });
    save(get());
  },
  openDecision: (id) => set({ decisionTaskId: id, sheet: "decision" }),
}));

export function activeTasks(tasks: OrchTask[]) {
  return tasks.filter((task) => ACTIVE.includes(task.state));
}
