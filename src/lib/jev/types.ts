export type PatternId =
  | "fanout"
  | "reflex"
  | "composite"
  | "cascade"
  | "retrieve"
  | "contract"
  | "guard"
  | "blackboard";

export type Tier = "fast" | "mid" | "strong";

export type Agent = {
  id: string;
  name: string;
  specialty: string;
  tier: Tier;
  keywords: string[];
  cost: number;
  latencyMs: number;
  locked?: boolean;
};

export type Weights = {
  quality: number;
  safety: number;
  fit: number;
  completeness: number;
};

export type RunInput = {
  objective: string;
  pattern: PatternId;
  tau: number;
  weights: Weights;
  enabled: string[];
};

export type Dist = { label: string; p: number };

export type StepStatus = "allow" | "hold" | "deny" | "info";

export type StepKind =
  | "state"
  | "judge"
  | "route"
  | "act"
  | "gate"
  | "human"
  | "artifact"
  | "note";

export type Step = {
  id: string;
  title: string;
  detail: string;
  kind: StepKind;
  actor?: string;
  confidence?: number;
  dist?: Dist[];
  decision?: string;
  latencyMs?: number;
  cost?: number;
  status?: StepStatus;
};

export type Artifact = { title: string; body: string };

export type ActionClass =
  | "read"
  | "prepare"
  | "write"
  | "external"
  | "money"
  | "irreversible";

export type Pending =
  | { kind: "guard"; label: string }
  | { kind: "quality" }
  | { kind: "award"; leader: string }
  | { kind: "ask"; next: string };

export type Memory = {
  intent: string;
  complexity: "Simple" | "Moderate" | "Complex";
  sensitiveP: number;
  sensitive: boolean;
  needsToolP: number;
  urgency: string;
  actionClass: ActionClass;
  actionLabel: string;
  composite: number;
  band: "accept" | "review" | "reject";
  worker: string;
  leader: string;
  safeP: number;
};

export type Snapshot = {
  id: string;
  input: RunInput;
  steps: Step[];
  artifacts: Artifact[];
  memory: Memory;
  phase: "hold" | "done";
  pending: Pending | null;
  resume: "cascade-after-guard" | null;
  summary: string;
};

export type Totals = {
  latencyMs: number;
  cost: number;
  questions: number;
  escalations: number;
};

export type SavedRun = {
  id: string;
  savedAt: number;
  title: string;
  pattern: PatternId;
  objective: string;
  summary: string;
  steps: Step[];
  artifacts: Artifact[];
  totals: Totals;
};

export type Judgment = {
  decision: string;
  confidence: number;
  dist: Dist[];
};

export type Features = {
  tokens: string[];
  money: number;
  external: number;
  destructive: number;
  code: number;
  research: number;
  write: number;
  urgency: number;
  uncertainty: number;
};
