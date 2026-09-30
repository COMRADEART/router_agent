export type Mode = "fast" | "balanced" | "deep";

export type ProviderId = "codex" | "claude" | "ollama" | "cline" | "cursor";

export type TaskType = "coding" | "debug" | "research" | "writing" | "ops" | "general";

export type ContextNeed = "low" | "medium" | "high";

export type Availability =
  | "ready"
  | "busy"
  | "offline"
  | "unavailable"
  | "rate_limited"
  | "auth_required";

export type TaskState =
  | "queued"
  | "routing"
  | "waiting_for_approval"
  | "launching"
  | "running"
  | "waiting_for_input"
  | "paused"
  | "completed"
  | "failed"
  | "stopped";

export type RouteDecision = {
  task_type: TaskType;
  complexity: number;
  latency_priority: number;
  privacy_priority: number;
  context_requirement: ContextNeed;
  recommended_provider: ProviderId;
  recommended_model: string;
  confidence: number;
  reason: string;
  alternatives: { provider: ProviderId; note: string; score: number }[];
  scores: { provider: ProviderId; score: number }[];
};

export type Usage = {
  percent: number;
  label: string;
  reset: string | null;
} | null;

export type ProviderLive = {
  id: ProviderId;
  name: string;
  availability: Availability;
  installed: boolean;
  authenticated: boolean;
  local_or_cloud: "local" | "cloud";
  supported_task_types: TaskType[];
  current_model: string | null;
  usage: Usage;
  usage_note: string;
  active_jobs: number;
  latency_estimate_ms: number | null;
  extension: boolean;
  detail: string;
  vram: string | null;
  tokens_per_sec: number | null;
};

export type Project = {
  id: string;
  name: string;
  path: string;
  preferred: ProviderId | "auto";
};

export type TaskLog = { at: number; line: string };

export type OrchTask = {
  id: string;
  title: string;
  prompt: string;
  projectId: string | null;
  mode: Mode;
  state: TaskState;
  provider: ProviderId;
  model: string;
  decision: RouteDecision;
  manual: boolean;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  output: string;
  error: string | null;
  logs: TaskLog[];
  pauseSupported: boolean;
};

export type GpuSample = {
  name: string;
  utilization: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  temperatureC: number | null;
  powerW: number | null;
  note: string | null;
};

export type HostSample = {
  at: number;
  cpu: { utilization: number | null; clockMhz: number | null; temperatureC: number | null };
  memory: { usedBytes: number; availableBytes: number; totalBytes: number };
  gpus: GpuSample[];
  notes: string[];
};

export type HostPresence = "online" | "sleeping";

export type ExecRequest = {
  taskId: string;
  provider: ProviderId;
  model: string;
  prompt: string;
};

export type ExecResult = {
  ok: boolean;
  stopped?: boolean;
  output?: string;
  error?: string;
  log: string;
};
