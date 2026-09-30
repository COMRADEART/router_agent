import type { Agent, PatternId, Weights } from "@/lib/jev/types";

export const AGENTS: Agent[] = [
  {
    id: "router",
    name: "Router",
    specialty: "Decision layer",
    tier: "fast",
    keywords: [],
    cost: 0.05,
    latencyMs: 40,
    locked: true,
  },
  {
    id: "warden",
    name: "Warden",
    specialty: "Policy guard",
    tier: "fast",
    keywords: [],
    cost: 0.05,
    latencyMs: 40,
    locked: true,
  },
  {
    id: "clerk",
    name: "Clerk",
    specialty: "Triage and short answers",
    tier: "fast",
    keywords: ["ticket", "refund", "customer", "account", "status", "billing", "triage"],
    cost: 0.4,
    latencyMs: 160,
  },
  {
    id: "scout",
    name: "Scout",
    specialty: "Research and retrieve",
    tier: "mid",
    keywords: ["compare", "option", "source", "evidence", "research", "find", "why", "sync"],
    cost: 1.2,
    latencyMs: 640,
  },
  {
    id: "mason",
    name: "Mason",
    specialty: "Drafts and structure",
    tier: "mid",
    keywords: ["draft", "write", "note", "proposal", "summar", "recommend", "launch", "brief"],
    cost: 1.4,
    latencyMs: 700,
  },
  {
    id: "critic",
    name: "Critic",
    specialty: "Gaps, risk, and claims",
    tier: "strong",
    keywords: ["risk", "review", "claim", "quality", "stress", "legal", "score"],
    cost: 3.2,
    latencyMs: 1200,
  },
  {
    id: "smith",
    name: "Smith",
    specialty: "Code and failure modes",
    tier: "strong",
    keywords: ["code", "bug", "crash", "refactor", "test", "api", "android", "windows", "retry"],
    cost: 3.6,
    latencyMs: 1400,
  },
];

export const WORKERS = AGENTS.filter((agent) => !agent.locked);

export const DEFAULT_ENABLED = WORKERS.map((agent) => agent.id);

export const DEFAULT_WEIGHTS: Weights = {
  quality: 35,
  safety: 25,
  fit: 20,
  completeness: 20,
};

export const DEFAULT_TAU = 0.62;

export const PATTERNS: {
  id: PatternId;
  name: string;
  primitive: string;
  line: string;
  when: string;
  algorithm: string;
}[] = [
  {
    id: "fanout",
    name: "Speculative fan-out",
    primitive: "Choice + score + noul",
    line: "Many closed questions, one shared state, one wall clock.",
    when: "The next step branches, and each branch is a small typed question.",
    algorithm:
      "Ask every question against the same state. Parallel wall-clock is the slowest question, not the sum. Code — not the judge — combines the answers.",
  },
  {
    id: "reflex",
    name: "Confidence gate",
    primitive: "Choice, then a threshold",
    line: "Act fast only when the margin is wide and the action is executable.",
    when: "Most steps are cheap, and a strong model should be the exception.",
    algorithm:
      "Pick a tool from a closed set. If confidence clears τ and policy allows it, run the fast worker. Otherwise spend a strong step, or stop for a person when the tool is ask-user.",
  },
  {
    id: "composite",
    name: "Composite score",
    primitive: "Four scores, your weights",
    line: "Break a fuzzy judgment into dimensions you can reweight.",
    when: "The decision is a matter of degree: quality, safety, fit, completeness.",
    algorithm:
      "Score each dimension in isolation on 0–1. Normalize your weights. Accept at 0.72, review at 0.48, otherwise reject. The band is code.",
  },
  {
    id: "cascade",
    name: "Cascade",
    primitive: "Route, then spend",
    line: "Easy work stays cheap. Sensitive work never starts alone.",
    when: "Worker choice and model spend should follow the shape of the request.",
    algorithm:
      "Intent, complexity, and a sensitive yes/no pick the worker. Money and irreversible classes hold for a person before any worker runs. One person, one question.",
  },
  {
    id: "retrieve",
    name: "Retrieve, then judge",
    primitive: "Rank, then noul",
    line: "Lexical rank proposes. A yes/no judge disposes.",
    when: "A corpus is larger than the context you want a writer to see.",
    algorithm:
      "BM25-style rank over a fixed desk corpus. A sigmoid turns the score into P(relevant). Chunks under 0.50 never reach the draft.",
  },
  {
    id: "contract",
    name: "Contract net",
    primitive: "Bids, then a margin",
    line: "Announce the task. Award capability over cost, unless the bid is thin.",
    when: "Several specialists could own the work and you need a reason, not a rota.",
    algorithm:
      "raw = (hits, or 0.2 if none) / cost^0.3. Softmax temperature 0.5. If confidence is under τ, a person awards the leader or awards nobody.",
  },
  {
    id: "guard",
    name: "Action guard",
    primitive: "Class, then a table",
    line: "Probability advises. The policy table decides.",
    when: "A tool might send, pay, delete, or touch a secret.",
    algorithm:
      "Infer a class: read, prepare, reversible, external, money, irreversible. Read and prepare run. Reversible runs only above τ. External, money, and irreversible wait for a person — confidence cannot override the last two.",
  },
  {
    id: "blackboard",
    name: "Blackboard",
    primitive: "Goals with preconditions",
    line: "The board is the memory. Agents post only into a matching goal.",
    when: "Work splits into research, critique, and a draft that must wait for the first.",
    algorithm:
      "Three goals. The best keyword match among the goal’s candidates posts. Critique and draft name their precondition. Disabled candidates leave the goal unassigned instead of inventing an owner.",
  },
];

export const POLICY: { level: string; effect: string; who: string }[] = [
  { level: "Read", effect: "Search, inspect, analyse", who: "Runs" },
  { level: "Prepare", effect: "Draft or recommend, nothing leaves", who: "Runs" },
  { level: "Reversible", effect: "Update a local draft", who: "Runs if confidence clears τ" },
  { level: "External", effect: "Send, publish, contact", who: "A person" },
  { level: "Money or irreversible", effect: "Pay, delete, secrets, production", who: "A person, always" },
];

export type Preset = {
  id: string;
  title: string;
  kicker: string;
  pattern: PatternId;
  objective: string;
  enabled: string[];
};

export const PRESETS: Preset[] = [
  {
    id: "field",
    title: "Field sync",
    kicker: "Cascade",
    pattern: "cascade",
    objective:
      "Compare three on-device sync options for a field team that moves between Windows laptops and Android phones. Recommend one.",
    enabled: ["scout", "mason", "critic", "smith"],
  },
  {
    id: "refund",
    title: "Duplicate charge",
    kicker: "Guard",
    pattern: "guard",
    objective:
      "Customer says they were charged twice and wants a refund today. The account is two weeks old.",
    enabled: ["clerk", "critic"],
  },
  {
    id: "crash",
    title: "Resume crash",
    kicker: "Contract net",
    pattern: "contract",
    objective: "Pick an owner for a flaky Android crash when the app resumes from the background.",
    enabled: ["smith", "scout", "critic", "clerk"],
  },
  {
    id: "launch",
    title: "Launch note",
    kicker: "Blackboard",
    pattern: "blackboard",
    objective:
      "Draft a launch note about offline runs, then stress-test the claims before anyone publishes it.",
    enabled: ["scout", "critic", "mason"],
  },
  {
    id: "reset",
    title: "Password reset",
    kicker: "Confidence gate",
    pattern: "reflex",
    objective: "Is this tool call safe: send the customer a password reset and close the ticket?",
    enabled: ["clerk", "smith"],
  },
  {
    id: "layer",
    title: "Decision layer",
    kicker: "Retrieve",
    pattern: "retrieve",
    objective: "What does a Jev-style decision layer decide inside a multi-agent loop?",
    enabled: ["scout", "mason"],
  },
  {
    id: "vendor",
    title: "Vendor score",
    kicker: "Composite",
    pattern: "composite",
    objective:
      "Score this proposal: a cheap sync tool, no admin controls, and a promise to ship Android later.",
    enabled: ["critic", "mason", "scout"],
  },
  {
    id: "incident",
    title: "Incident fan-out",
    kicker: "Fan-out",
    pattern: "fanout",
    objective:
      "A teammate pasted a long incident: billing failed, Android clients retried, and someone wants to email every affected account tonight.",
    enabled: ["clerk", "smith", "scout", "mason", "critic"],
  },
];

export const SAMPLES: Record<PatternId, string> = PRESETS.reduce(
  (acc, preset) => {
    acc[preset.pattern] = preset.objective;
    return acc;
  },
  {} as Record<PatternId, string>,
);

export const CORPUS: { id: string; title: string; text: string }[] = [
  {
    id: "c1",
    title: "Choice, score, noul",
    text: "A Jev-style layer answers closed questions. Choice picks one label. Score picks a rubric level. Noul returns a yes probability. It does not draft.",
  },
  {
    id: "c2",
    title: "Code owns effects",
    text: "The decision layer must not send, pay, delete, or publish. Application code applies the policy table after the judgment.",
  },
  {
    id: "c3",
    title: "Confidence gate",
    text: "Execute the fast action only when confidence clears a threshold and the action is executable. Otherwise call a stronger model.",
  },
  {
    id: "c4",
    title: "Fan-out",
    text: "Several questions share one state and run in parallel. Extra questions add little wall-clock time. Code combines them.",
  },
  {
    id: "c5",
    title: "Composite score",
    text: "Score independent dimensions, then combine them with weights the product owner controls. Bands live in code.",
  },
  {
    id: "c6",
    title: "Contract net",
    text: "A manager announces a task. Workers bid with capability over cost. Award the best bid or ask a person if the margin is thin.",
  },
  {
    id: "c7",
    title: "Blackboard",
    text: "Agents read a shared board and post only when a goal matches their competence. The board is the memory between research, critique, and draft.",
  },
  {
    id: "c8",
    title: "Windows and Android",
    text: "A field team switches between Windows laptops and Android phones. Sync should stay on-device, exportable as a file, and reversible.",
  },
  {
    id: "c9",
    title: "Cascade routing",
    text: "Route easy work to a cheap worker and hard or sensitive work to a strong model or a person. The judge does not pick the price list.",
  },
  {
    id: "c10",
    title: "Sourdough distractor",
    text: "Feed the starter, fold the dough, and bake in a dutch oven until the crust is dark.",
  },
];

export const BENCH_TASKS: { id: string; title: string; text: string }[] = [
  { id: "t1", title: "Status", text: "What is the status of the field sync?" },
  { id: "t2", title: "Meeting note", text: "Summarize the meeting in three bullets." },
  { id: "t3", title: "Maybe", text: "Maybe fix it somehow?" },
  { id: "t4", title: "Sync research", text: "Why does sync drop when the laptop sleeps?" },
  {
    id: "t5",
    title: "Retry loop",
    text: "Refactor the retry loop and add a test for the Android client.",
  },
  { id: "t6", title: "Refund", text: "Refund the duplicate charge from order 4412 today." },
  {
    id: "t7",
    title: "Broadcast",
    text: "Email every affected customer about the billing failure tonight.",
  },
  {
    id: "t8",
    title: "Wipe",
    text: "Delete the production database and send the password to the customer.",
  },
];

export function agentById(id: string): Agent | undefined {
  return AGENTS.find((agent) => agent.id === id);
}

export function patternById(id: PatternId) {
  return PATTERNS.find((pattern) => pattern.id === id) ?? PATTERNS[0];
}
