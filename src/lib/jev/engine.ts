import { AGENTS, BENCH_TASKS, CORPUS, WORKERS } from "@/lib/jev/catalog";
import type {
  ActionClass,
  Features,
  Judgment,
  Weights,
} from "@/lib/jev/types";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "that",
  "this",
  "is",
  "are",
  "was",
  "be",
  "it",
  "as",
  "at",
  "by",
  "from",
  "into",
  "their",
  "them",
  "they",
  "you",
  "your",
  "our",
  "we",
  "if",
  "then",
  "than",
  "not",
  "do",
  "does",
  "did",
  "about",
  "before",
  "after",
  "anyone",
  "someone",
  "every",
  "when",
  "what",
  "how",
  "who",
]);

const MONEY = ["refund", "charg", "paid", "pay", "invoice", "wire", "billing", "price"];
const EXTERNAL = ["send", "email", "publish", "notify", "customer", "slack", "post", "tweet"];
const DESTRUCTIVE = [
  "delete",
  "wipe",
  "production",
  "deploy",
  "password",
  "secret",
  "credential",
  "irreversible",
];
const CODE = ["code", "bug", "crash", "refactor", "test", "api", "android", "windows", "retry", "script"];
const RESEARCH = ["compare", "why", "source", "evidence", "research", "find", "option", "versus", "sync"];
const WRITE = ["draft", "write", "email", "summar", "proposal", "note", "announce", "recommend", "brief", "launch"];
const URGENCY = ["urgent", "asap", "today", "immediately", "critical", "tonight", "now"];
const UNCERTAIN = ["maybe", "unclear", "roughly", "guess", "unsure", "somehow", "later"];

export const FANOUT_QUESTION_MS = 40;
export const STRONG_COST = 3.4;
export const JUDGE_COST = 0.05;

export function clamp(n: number, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, n));
}

export function fmt(n: number) {
  return n.toFixed(2);
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function stem(token: string) {
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$]+/g, " ")
    .split(/\s+/)
    .filter((token) => token && !STOP.has(token))
    .map(stem);
}

function matches(token: string, word: string) {
  const stemmed = stem(word);
  if (token === stemmed || token === word) return true;
  const short = token.length < stemmed.length ? token : stemmed;
  const long = token.length < stemmed.length ? stemmed : token;
  return short.length >= 4 && long.startsWith(short);
}

function hits(tokens: string[], lexicon: string[]) {
  let n = 0;
  for (const token of tokens) {
    if (lexicon.some((word) => matches(token, word))) n += 1;
  }
  return Math.min(n, 4);
}

export function features(text: string): Features {
  const tokens = tokenize(text);
  const moneyBoost = /\$\s?\d/.test(text) || /\b\d+\s?(usd|dollars)\b/i.test(text) ? 1 : 0;
  return {
    tokens,
    money: Math.min(4, hits(tokens, MONEY) + moneyBoost),
    external: hits(tokens, EXTERNAL),
    destructive: hits(tokens, DESTRUCTIVE),
    code: hits(tokens, CODE),
    research: hits(tokens, RESEARCH),
    write: hits(tokens, WRITE),
    urgency: hits(tokens, URGENCY),
    uncertainty: hits(tokens, UNCERTAIN),
  };
}

export function softmax(scores: number[], temperature: number) {
  const t = Math.max(temperature, 0.05);
  const peak = Math.max(...scores, 0);
  const exps = scores.map((score) => Math.exp((score - peak) / t));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
}

export function sigmoid(z: number) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

export function judgeScores(pairs: { id: string; score: number }[], temperature = 0.65): Judgment {
  if (!pairs.length) {
    return { decision: "None", confidence: 0, dist: [] };
  }
  const probabilities = softmax(
    pairs.map((pair) => pair.score),
    temperature,
  );
  const dist = pairs
    .map((pair, index) => ({ label: pair.id, p: probabilities[index] ?? 0 }))
    .sort((a, b) => b.p - a.p);
  const top = dist[0] ?? { label: "None", p: 0 };
  const second = dist[1]?.p ?? 0;
  const margin = top.p - second;
  return {
    decision: top.label,
    confidence: clamp(0.5 * top.p + 0.5 * margin),
    dist,
  };
}

export function noul(pYes: number, yes = "Yes", no = "No"): Judgment {
  const p = clamp(pYes);
  const dist = [
    { label: yes, p },
    { label: no, p: 1 - p },
  ].sort((a, b) => b.p - a.p);
  return {
    decision: p >= 0.5 ? yes : no,
    confidence: Math.abs(p - 0.5) * 2,
    dist,
  };
}

export function actionOf(text: string): { actionClass: ActionClass; actionLabel: string } {
  const f = features(text);
  if (f.destructive > 0) return { actionClass: "irreversible", actionLabel: "Irreversible or secret-bearing" };
  if (f.money > 0) return { actionClass: "money", actionLabel: "Money or refund" };
  if (f.external > 0) return { actionClass: "external", actionLabel: "Leaves the device" };
  if (f.write > 0 || f.code > 0) return { actionClass: "write", actionLabel: "Reversible draft" };
  if (f.research > 0) return { actionClass: "read", actionLabel: "Read and analyse" };
  return { actionClass: "prepare", actionLabel: "Prepare only" };
}

export function intentOf(text: string): Judgment {
  const f = features(text);
  return judgeScores(
    [
      { id: "Research", score: 0.2 + f.research * 1.15 },
      { id: "Draft", score: 0.15 + f.write * 1.1 },
      { id: "Code", score: 0.1 + f.code * 1.2 },
      { id: "Triage", score: 0.1 + f.money * 0.9 + (f.tokens.includes("ticket") ? 1.2 : 0) },
      { id: "Operate", score: 0.05 + f.external * 0.8 + f.destructive * 1.1 },
    ],
    0.7,
  );
}

export function complexityOf(text: string): Judgment {
  const f = features(text);
  const len = f.tokens.length;
  const rich = f.research + f.code + f.write;
  return judgeScores(
    [
      { id: "Simple", score: 1.45 - len / 18 - rich * 0.38 - f.uncertainty * 0.25 },
      { id: "Moderate", score: 0.85 - Math.abs(len - 12) / 22 },
      {
        id: "Complex",
        score: -0.15 + len / 16 + rich * 0.42 + (f.money + f.destructive) * 0.35,
      },
    ],
    0.62,
  );
}

export function sensitiveOf(text: string): Judgment {
  const f = features(text);
  const z = -1.15 + f.money * 1.15 + f.destructive * 1.45 + f.external * 0.85 + f.urgency * 0.15;
  return noul(sigmoid(z), "Sensitive", "Ordinary");
}

export function needsToolOf(text: string): Judgment {
  const f = features(text);
  const z = -0.7 + f.code * 0.95 + f.external * 0.7 + f.destructive * 0.8 + f.money * 0.45;
  return noul(sigmoid(z), "Tool", "No tool");
}

export function urgencyOf(text: string): Judgment {
  const f = features(text);
  return judgeScores(
    [
      { id: "Low", score: 1.05 - f.urgency * 1.1 - f.money * 0.4 },
      { id: "Normal", score: 0.72 },
      { id: "High", score: -0.15 + f.urgency * 1.05 + f.money * 0.55 },
      { id: "Critical", score: -1.1 + f.urgency * 0.9 + f.money * 0.8 + f.destructive * 1.2 },
    ],
    0.58,
  );
}

export function safeOf(text: string): Judgment {
  const f = features(text);
  const z = 1.15 - f.money * 1.35 - f.destructive * 1.7 - f.external * 1.15 - f.uncertainty * 0.35;
  return noul(sigmoid(z), "Safe to run", "Not safe alone");
}

export type PolicyCall = {
  status: "allow" | "hold";
  override: boolean;
  why: string;
};

export function policyOf(text: string, tau: number): PolicyCall & { safe: Judgment; actionLabel: string; actionClass: ActionClass } {
  const action = actionOf(text);
  const safe = safeOf(text);
  const hard = action.actionClass === "money" || action.actionClass === "irreversible";
  if (hard) {
    return {
      ...action,
      safe,
      status: "hold",
      override: true,
      why: `Class is ${action.actionLabel}. Code holds this even if the safe-score is ${pct(safe.dist.find((row) => row.label === "Safe to run")?.p ?? safe.confidence)}. Confidence cannot clear money or irreversible work.`,
    };
  }
  if (action.actionClass === "external") {
    return {
      ...action,
      safe,
      status: "hold",
      override: true,
      why: "Class is external. A person has to clear anything that would leave the device. The probability is advisory.",
    };
  }
  if (action.actionClass === "write" && safe.confidence < tau && safe.decision !== "Safe to run") {
    return {
      ...action,
      safe,
      status: "hold",
      override: false,
      why: `Reversible write, but P(safe) is under the gate (${fmt(tau)}). Holding for a person.`,
    };
  }
  if (action.actionClass === "write" && safe.decision !== "Safe to run") {
    return {
      ...action,
      safe,
      status: "hold",
      override: false,
      why: "Reversible write and the noul did not call it safe. Holding.",
    };
  }
  return {
    ...action,
    safe,
    status: "allow",
    override: false,
    why:
      action.actionClass === "write"
        ? `Reversible write cleared the gate at τ ${fmt(tau)}.`
        : `${action.actionLabel} is allowed by the table. The safe-score stays advisory.`,
  };
}

export function normalizeWeights(weights: Weights) {
  const sum = weights.quality + weights.safety + weights.fit + weights.completeness;
  if (sum <= 0) return { quality: 0.25, safety: 0.25, fit: 0.25, completeness: 0.25 };
  return {
    quality: weights.quality / sum,
    safety: weights.safety / sum,
    fit: weights.fit / sum,
    completeness: weights.completeness / sum,
  };
}

export function compositeOf(text: string, enabled: string[], weights: Weights) {
  const f = features(text);
  const quality = clamp(
    0.58 - f.uncertainty * 0.2 - (f.tokens.includes("no") ? 0.18 : 0) + Math.min(f.tokens.length, 28) / 90,
  );
  const safety = clamp(1 - 0.28 * f.money - 0.34 * f.destructive - 0.22 * f.external);
  const workers = WORKERS.filter((agent) => enabled.includes(agent.id));
  const best = workers.reduce((max, agent) => {
    const hit = agent.keywords.filter((keyword) => f.tokens.some((token) => matches(token, keyword))).length;
    return Math.max(max, hit);
  }, 0);
  const fit = clamp(best / 3);
  const completeness = clamp(
    (f.tokens.length >= 8 ? 0.42 : 0.16) +
      (f.research + f.write + f.code + f.money > 0 ? 0.38 : 0) +
      (text.trim().length > 48 ? 0.16 : 0),
  );
  const w = normalizeWeights(weights);
  const score = w.quality * quality + w.safety * safety + w.fit * fit + w.completeness * completeness;
  const band: "accept" | "review" | "reject" =
    score >= 0.72 ? "accept" : score >= 0.48 ? "review" : "reject";
  const detail = `${fmt(w.quality)}×${fmt(quality)} quality + ${fmt(w.safety)}×${fmt(safety)} safety + ${fmt(w.fit)}×${fmt(fit)} fit + ${fmt(w.completeness)}×${fmt(completeness)} completeness = ${fmt(score)} → ${band}`;
  return { quality, safety, fit, completeness, score, band, detail, weights: w };
}

export type BidRow = { id: string; name: string; hits: number; raw: number };

export function bidsFor(text: string, enabled: string[]) {
  const tokens = features(text).tokens;
  const rows: BidRow[] = WORKERS.filter((agent) => enabled.includes(agent.id)).map((agent) => {
    const hitCount = agent.keywords.filter((keyword) => tokens.some((token) => matches(token, keyword))).length;
    const penalty = Math.pow(agent.cost, 0.3);
    const raw = (hitCount === 0 ? 0.2 : hitCount) / penalty;
    return { id: agent.id, name: agent.name, hits: hitCount, raw };
  });
  if (!rows.length) {
    return { rows, judgment: null as Judgment | null, leaderId: "" };
  }
  const judgment = judgeScores(
    rows.map((row) => ({ id: row.name, score: row.raw })),
    0.5,
  );
  const leader = rows.find((row) => row.name === judgment.decision) ?? rows[0];
  return { rows, judgment, leaderId: leader.id };
}

export function toolChoice(text: string): Judgment {
  const f = features(text);
  return judgeScores(
    [
      { id: "Search", score: 0.25 + f.research * 1.2 + (f.tokens.includes("why") ? 0.4 : 0) },
      { id: "Draft", score: 0.2 + f.write * 1.15 },
      { id: "Code", score: 0.12 + f.code * 1.25 },
      { id: "Ask a person", score: 0.2 + f.uncertainty * 1.35 + f.destructive * 1.15 + f.money * 0.85 + (f.tokens.length < 4 ? 0.85 : 0) },
      { id: "Stop", score: 0.08 + (f.tokens.length < 2 ? 0.9 : 0) },
    ],
    0.48,
  );
}

export type ReflexPoint = {
  confidence: number;
  decision: string;
  fast: boolean;
  held: boolean;
  escalated: boolean;
  spend: number;
};

export function reflexPoint(text: string, tau: number): ReflexPoint {
  const choice = toolChoice(text);
  const policy = policyOf(text, tau);
  const hardHold =
    policy.actionClass === "money" ||
    policy.actionClass === "external" ||
    policy.actionClass === "irreversible";
  const ask = choice.decision === "Ask a person" || choice.decision === "Stop";
  if (hardHold || ask) {
    return {
      confidence: choice.confidence,
      decision: hardHold ? policy.actionLabel : choice.decision,
      fast: false,
      held: true,
      escalated: false,
      spend: JUDGE_COST,
    };
  }
  if (choice.confidence >= tau) {
    const spend =
      JUDGE_COST + (choice.decision === "Code" ? 3.6 : choice.decision === "Draft" ? 1.4 : 1.2);
    return {
      confidence: choice.confidence,
      decision: choice.decision,
      fast: true,
      held: false,
      escalated: false,
      spend,
    };
  }
  return {
    confidence: choice.confidence,
    decision: choice.decision,
    fast: false,
    held: false,
    escalated: true,
    spend: JUDGE_COST + STRONG_COST,
  };
}

export function reflexCurve() {
  const taus = [0.35, 0.45, 0.55, 0.62, 0.7, 0.78, 0.86, 0.95];
  return taus.map((tau) => {
    const points = BENCH_TASKS.map((task) => reflexPoint(task.text, tau));
    const fast = points.filter((point) => point.fast).length / points.length;
    const held = points.filter((point) => point.held).length / points.length;
    const spend = points.reduce((sum, point) => sum + point.spend, 0);
    return { tau, fast, held, spend, always: BENCH_TASKS.length * STRONG_COST };
  });
}

export type RankedChunk = {
  id: string;
  title: string;
  text: string;
  score: number;
  p: number;
  kept: boolean;
};

export function retrieveRank(query: string): RankedChunk[] {
  const queryTokens = tokenize(query);
  const docs = CORPUS.map((chunk) => ({
    ...chunk,
    tokens: tokenize(`${chunk.title} ${chunk.text}`),
  }));
  const n = docs.length || 1;
  const avg = docs.reduce((sum, doc) => sum + doc.tokens.length, 0) / n;
  const unique = [...new Set(queryTokens)];
  return docs
    .map((doc) => {
      let score = 0;
      for (const term of unique) {
        const freq = doc.tokens.filter((token) => token === term).length;
        if (!freq) continue;
        const df = docs.filter((other) => other.tokens.includes(term)).length;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        const k = 1.2;
        const b = 0.75;
        const denom = freq + k * (1 - b + (b * doc.tokens.length) / (avg || 1));
        score += (idf * (freq * (k + 1))) / denom;
      }
      const p = sigmoid(score - 1.15);
      return {
        id: doc.id,
        title: doc.title,
        text: doc.text,
        score,
        p,
        kept: p >= 0.5,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function workerForIntent(intent: string, enabled: string[], text: string) {
  const ranking = bidsFor(text, enabled);
  const prefer: Record<string, string[]> = {
    Research: ["scout", "critic", "mason"],
    Draft: ["mason", "scout", "clerk"],
    Code: ["smith", "critic", "scout"],
    Triage: ["clerk", "critic", "mason"],
    Operate: ["clerk", "smith", "mason"],
  };
  const order = prefer[intent] ?? ["mason", "scout", "clerk"];
  const picked = order.find((id) => enabled.includes(id)) ?? ranking.leaderId ?? enabled[0] ?? "mason";
  return picked;
}

export function marginOf(judgment: Judgment | null) {
  if (!judgment || judgment.dist.length < 2) return judgment?.dist[0]?.p ?? 0;
  return judgment.dist[0].p - judgment.dist[1].p;
}

export function agentName(id: string) {
  return AGENTS.find((agent) => agent.id === id)?.name ?? id;
}
