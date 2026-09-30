import { agentById } from "@/lib/jev/catalog";
import {
  agentName,
  bidsFor,
  complexityOf,
  compositeOf,
  FANOUT_QUESTION_MS,
  features,
  intentOf,
  JUDGE_COST,
  marginOf,
  needsToolOf,
  policyOf,
  retrieveRank,
  safeOf,
  sensitiveOf,
  toolChoice,
  urgencyOf,
  workerForIntent,
  fmt,
  pct,
} from "@/lib/jev/engine";
import type {
  Artifact,
  Memory,
  Pending,
  RunInput,
  SavedRun,
  Snapshot,
  Step,
  Totals,
} from "@/lib/jev/types";

type Resume = "cascade-after-guard" | null;

type Ctx = {
  id: string;
  input: RunInput;
  steps: Step[];
  artifacts: Artifact[];
  memory: Memory;
  phase: "hold" | "done";
  pending: Pending | null;
  resume: Resume;
  summary: string;
  seq: number;
};

function blankMemory(): Memory {
  return {
    intent: "Research",
    complexity: "Moderate",
    sensitiveP: 0,
    sensitive: false,
    needsToolP: 0,
    urgency: "Normal",
    actionClass: "prepare",
    actionLabel: "Prepare only",
    composite: 0,
    band: "review",
    worker: "mason",
    leader: "mason",
    safeP: 0,
  };
}

function uid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `run-${Date.now()}`;
}

function push(ctx: Ctx, step: Omit<Step, "id">) {
  ctx.seq += 1;
  const next: Step = { ...step, id: `s${ctx.seq}` };
  ctx.steps.push(next);
  return next;
}

function snapshot(ctx: Ctx): Snapshot {
  return {
    id: ctx.id,
    input: ctx.input,
    steps: ctx.steps,
    artifacts: ctx.artifacts,
    memory: ctx.memory,
    phase: ctx.phase,
    pending: ctx.pending,
    resume: ctx.resume,
    summary: ctx.summary,
  };
}

function finish(ctx: Ctx, summary: string) {
  ctx.summary = summary;
  ctx.phase = "done";
  ctx.pending = null;
  ctx.resume = null;
}

function hold(ctx: Ctx, pending: Pending, summary: string, resume: Resume = null) {
  ctx.pending = pending;
  ctx.resume = resume;
  ctx.phase = "hold";
  ctx.summary = summary;
}

function clip(text: string, max = 220) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function addArtifact(ctx: Ctx, title: string, body: string) {
  ctx.artifacts.push({ title, body });
  push(ctx, {
    kind: "artifact",
    title,
    detail: body,
    actor: ctx.memory.worker,
    status: "info",
  });
}

function specialistBody(ctx: Ctx, role: string) {
  const objective = clip(ctx.input.objective, 280);
  if (role === "scout") {
    return [
      `Question: ${objective}`,
      "Points the desk can stand behind without a network call:",
      "1. Keep the decision layer on-device: typed questions, not a free-form transcript.",
      "2. Separate prepare from send. A recommendation is not a side effect.",
      "3. Name one owner. A roster is not an answer.",
    ].join("\n");
  }
  if (role === "smith") {
    return [
      `Failure named in the objective: ${objective}`,
      "Working theory: resume from background drops the in-memory queue before it flushes.",
      "First patch: persist the queue, replay on resume, and add a test that kills the process mid-write.",
      "Nothing here is deployed. This is a local note.",
    ].join("\n");
  }
  if (role === "critic") {
    const low =
      ctx.memory.band === "reject" ? "The composite band was reject." : "Claims still need a source or a person.";
    return [
      low,
      "Gap: the desk has not seen a live corpus beyond its built-in cards.",
      "Gap: money, mail, and deletes stay blocked until a person clears them.",
      "Do not publish this as a measured benchmark. It is a trace of the rules.",
    ].join("\n");
  }
  if (role === "clerk") {
    return [
      `Triage: ${objective}`,
      `Intent ${ctx.memory.intent}, urgency ${ctx.memory.urgency}, class ${ctx.memory.actionLabel}.`,
      "Next: a person owns anything that refunds, emails, or resets a secret. The clerk only files the packet.",
    ].join("\n");
  }
  return [
    `Draft for: ${objective}`,
    "Recommendation: prefer the option that keeps runs on the device and exports a file when someone switches between a Windows laptop and an Android phone.",
    "This draft does not leave the desk.",
  ].join("\n");
}

function actAs(ctx: Ctx, agentId: string, title: string) {
  const agent = agentById(agentId);
  ctx.memory.worker = agentId;
  push(ctx, {
    kind: "act",
    title,
    detail: agent
      ? `${agent.name} · ${agent.specialty}. Modeled ${agent.latencyMs} ms at ${fmt(agent.cost)} units.`
      : "No matching worker was enabled.",
    actor: agentId,
    decision: agent?.name ?? "Unassigned",
    latencyMs: agent?.latencyMs ?? 0,
    cost: agent?.cost ?? 0,
    status: agent ? "allow" : "deny",
  });
  if (!agent) return;
  const heading =
    agentId === "scout"
      ? "Scout notes"
      : agentId === "smith"
        ? "Smith note"
        : agentId === "critic"
          ? "Critic note"
          : agentId === "clerk"
            ? "Clerk packet"
            : "Mason draft";
  addArtifact(ctx, heading, specialistBody(ctx, agentId));
}

function stateStep(ctx: Ctx) {
  const f = features(ctx.input.objective);
  const action = policyOf(ctx.input.objective, ctx.input.tau);
  ctx.memory.actionClass = action.actionClass;
  ctx.memory.actionLabel = action.actionLabel;
  ctx.memory.safeP = action.safe.dist.find((row) => row.label === "Safe to run")?.p ?? 0;
  push(ctx, {
    kind: "state",
    title: "State, built by code",
    actor: "router",
    detail: `${f.tokens.length} tokens. Class: ${action.actionLabel}. Signals — research ${f.research}, write ${f.write}, code ${f.code}, money ${f.money}, external ${f.external}, destructive ${f.destructive}, urgency ${f.urgency}, uncertainty ${f.uncertainty}.`,
    status: "info",
    latencyMs: 0,
    cost: 0,
  });
}

function judgeLayer(ctx: Ctx, extra: boolean) {
  const text = ctx.input.objective;
  const intent = intentOf(text);
  const complexity = complexityOf(text);
  const sensitive = sensitiveOf(text);
  const tool = needsToolOf(text);
  ctx.memory.intent = intent.decision;
  ctx.memory.complexity = complexity.decision as Memory["complexity"];
  ctx.memory.sensitiveP = sensitive.dist.find((row) => row.label === "Sensitive")?.p ?? 0;
  ctx.memory.sensitive = sensitive.decision === "Sensitive" || ctx.memory.actionClass === "money" || ctx.memory.actionClass === "irreversible";
  ctx.memory.needsToolP = tool.dist.find((row) => row.label === "Tool")?.p ?? 0;
  const questions = extra ? 6 : 4;
  push(ctx, {
    kind: "note",
    title: extra ? "Six questions, one request" : "Decision layer",
    actor: "router",
    detail: `Shared state is paid once. Serial model ${FANOUT_QUESTION_MS * questions} ms. Fan-out wall clock ${FANOUT_QUESTION_MS} ms. Desk cost ${fmt(JUDGE_COST + 0.01 * (questions - 1))} units for the batch.`,
    latencyMs: FANOUT_QUESTION_MS,
    cost: JUDGE_COST + 0.01 * (questions - 1),
    status: "info",
  });
  push(ctx, {
    kind: "judge",
    title: "Intent",
    actor: "router",
    decision: intent.decision,
    confidence: intent.confidence,
    dist: intent.dist,
    detail: "Choice over a closed intent set. Temperature 0.70.",
    status: "info",
  });
  push(ctx, {
    kind: "judge",
    title: "Complexity",
    actor: "router",
    decision: complexity.decision,
    confidence: complexity.confidence,
    dist: complexity.dist,
    detail: "Score over Simple, Moderate, Complex. Length and mixed signals push toward Complex.",
    status: "info",
  });
  push(ctx, {
    kind: "judge",
    title: "Sensitive?",
    actor: "router",
    decision: sensitive.decision,
    confidence: sensitive.confidence,
    dist: sensitive.dist,
    detail: "Noul. Money, secrets, and outbound verbs raise P(sensitive). Code still forces a hold for money and irreversible classes.",
    status: ctx.memory.sensitive ? "hold" : "allow",
  });
  push(ctx, {
    kind: "judge",
    title: "Needs a tool?",
    actor: "router",
    decision: tool.decision,
    confidence: tool.confidence,
    dist: tool.dist,
    detail: "Noul. Code, outbound, and destructive verbs raise P(tool).",
    status: "info",
  });
  if (!extra) return;
  const urgency = urgencyOf(text);
  const ranking = bidsFor(text, ctx.input.enabled);
  ctx.memory.urgency = urgency.decision;
  push(ctx, {
    kind: "judge",
    title: "Urgency",
    actor: "router",
    decision: urgency.decision,
    confidence: urgency.confidence,
    dist: urgency.dist,
    detail: "Score over Low, Normal, High, Critical.",
    status: "info",
  });
  push(ctx, {
    kind: "judge",
    title: "Who should act",
    actor: "router",
    decision: ranking.judgment?.decision ?? "Nobody enabled",
    confidence: ranking.judgment?.confidence ?? 0,
    dist: ranking.judgment?.dist,
    detail: "Choice over enabled workers. Score is hits, lightly discounted by cost.",
    status: "info",
  });
  ctx.memory.leader = ranking.leaderId || ctx.memory.leader;
}

function hardBlocked(ctx: Ctx) {
  return ctx.memory.actionClass === "money" || ctx.memory.actionClass === "irreversible";
}

function runFanout(ctx: Ctx) {
  judgeLayer(ctx, true);
  const worker = ctx.memory.leader || workerForIntent(ctx.memory.intent, ctx.input.enabled, ctx.input.objective);
  ctx.memory.worker = worker;
  const plan = [
    `Intent ${ctx.memory.intent}, complexity ${ctx.memory.complexity}, urgency ${ctx.memory.urgency}.`,
    `Sensitive probability ${pct(ctx.memory.sensitiveP)}. Tool probability ${pct(ctx.memory.needsToolP)}.`,
    `Code would hand the next prepare-step to ${agentName(worker)}.`,
    hardBlocked(ctx)
      ? "The class is money or irreversible, so the plan stops before any effect."
      : "No strong-model call was spent. Fan-out only judged.",
  ].join(" ");
  addArtifact(ctx, "Combined plan", plan);
  finish(ctx, "Code combined the fan-out. The judge did not act.");
}

function qualityStep(ctx: Ctx, allowHold: boolean) {
  const scored = compositeOf(ctx.input.objective, ctx.input.enabled, ctx.input.weights);
  ctx.memory.composite = scored.score;
  ctx.memory.band = scored.band;
  push(ctx, {
    kind: "judge",
    title: "Composite gate",
    actor: "critic",
    decision: scored.band,
    confidence: Math.abs(scored.score - 0.5) * 2,
    dist: [
      { label: "Quality", p: scored.quality },
      { label: "Safety", p: scored.safety },
      { label: "Fit", p: scored.fit },
      { label: "Completeness", p: scored.completeness },
    ],
    detail: scored.detail,
    status: scored.band === "accept" ? "allow" : scored.band === "review" ? "hold" : "deny",
    cost: 0,
  });
  if (scored.band === "reject") {
    finish(ctx, "Composite band is reject. No draft was accepted.");
    return;
  }
  if (scored.band === "review" && allowHold) {
    hold(ctx, { kind: "quality" }, "Composite score is in the review band. A person can accept it or send it back.");
    return;
  }
  if (scored.band === "review") {
    push(ctx, {
      kind: "note",
      title: "Critic takes the review band",
      actor: "critic",
      detail: "A person already cleared this run, so the critic notes the gap instead of asking again.",
      status: "info",
      cost: 0,
    });
    actAs(ctx, ctx.input.enabled.includes("critic") ? "critic" : ctx.memory.worker, "Critique without a second hold");
  }
  if (!ctx.artifacts.some((item) => item.title === "Mason draft")) {
    const drafter = ctx.input.enabled.includes("mason") ? "mason" : ctx.memory.worker;
    actAs(ctx, drafter, "Draft after the gate");
  }
  finish(ctx, `Closed on ${scored.band}. Composite ${fmt(scored.score)}.`);
}

function runCascade(ctx: Ctx) {
  judgeLayer(ctx, false);
  const worker = workerForIntent(ctx.memory.intent, ctx.input.enabled, ctx.input.objective);
  ctx.memory.worker = worker;
  ctx.memory.leader = worker;
  const agent = agentById(worker);
  push(ctx, {
    kind: "route",
    title: "Route",
    actor: "router",
    decision: agent?.name ?? "No worker",
    detail: `${ctx.memory.intent} / ${ctx.memory.complexity}. ${
      hardBlocked(ctx)
        ? "Money or irreversible class blocks the worker until a person answers."
        : `${agent?.name ?? "Nobody"} is the cheapest enabled match for this intent.`
    }`,
    status: hardBlocked(ctx) ? "hold" : "allow",
    confidence: intentOf(ctx.input.objective).confidence,
  });
  if (!agent) {
    finish(ctx, "Enable at least one worker. The cascade will not invent one.");
    return;
  }
  if (hardBlocked(ctx)) {
    push(ctx, {
      kind: "gate",
      title: "Warden held the cascade",
      actor: "warden",
      decision: "Person",
      detail: `${ctx.memory.actionLabel}. ${agent.name} does not start until you allow a prepare-only packet.`,
      status: "hold",
    });
    hold(
      ctx,
      { kind: "guard", label: ctx.memory.actionLabel },
      "Warden will not let money or irreversible work start without you.",
      "cascade-after-guard",
    );
    return;
  }
  actAs(ctx, worker, `${agent.name} takes the objective`);
  qualityStep(ctx, true);
}

function continueCascade(ctx: Ctx) {
  const worker = ctx.memory.worker || workerForIntent(ctx.memory.intent, ctx.input.enabled, ctx.input.objective);
  push(ctx, {
    kind: "note",
    title: "Person cleared a prepare-only path",
    actor: "warden",
    detail: "Nothing is sent, paid, or deleted. The worker may file a packet.",
    status: "allow",
  });
  actAs(ctx, worker, "Worker files a packet");
  qualityStep(ctx, false);
}

function runReflex(ctx: Ctx) {
  const choice = toolChoice(ctx.input.objective);
  const policy = policyOf(ctx.input.objective, ctx.input.tau);
  ctx.memory.safeP = policy.safe.dist.find((row) => row.label === "Safe to run")?.p ?? 0;
  push(ctx, {
    kind: "judge",
    title: "Next tool",
    actor: "router",
    decision: choice.decision,
    confidence: choice.confidence,
    dist: choice.dist,
    detail: `Closed toolbox. Gate τ is ${fmt(ctx.input.tau)}. Confidence is half the top probability plus half the margin.`,
    latencyMs: FANOUT_QUESTION_MS,
    cost: JUDGE_COST,
    status: "info",
  });
  const hard =
    policy.actionClass === "money" ||
    policy.actionClass === "external" ||
    policy.actionClass === "irreversible";
  if (hard || choice.decision === "Ask a person") {
    const next = workerForIntent("Triage", ctx.input.enabled, ctx.input.objective);
    ctx.memory.worker = next;
    push(ctx, {
      kind: "gate",
      title: hard ? "Policy holds the fast path" : "The tool is ask-a-person",
      actor: "warden",
      decision: "Person",
      detail: hard ? policy.why : "The objective is too thin to act on. The fast path will not guess.",
      status: "hold",
    });
    if (hard) {
      hold(ctx, { kind: "guard", label: policy.actionLabel }, policy.why);
    } else {
      hold(ctx, { kind: "ask", next }, "The gate wants a person before anyone continues.");
    }
    return;
  }
  if (choice.decision === "Stop") {
    finish(ctx, "The toolbox chose stop. No worker ran.");
    return;
  }
  if (choice.confidence >= ctx.input.tau) {
    const worker = choice.decision === "Code" ? "smith" : choice.decision === "Draft" ? "mason" : "scout";
    const picked = ctx.input.enabled.includes(worker) ? worker : ctx.input.enabled[0];
    if (!picked) {
      finish(ctx, "Confidence cleared, but no worker is enabled.");
      return;
    }
    push(ctx, {
      kind: "gate",
      title: "Fast path",
      actor: "router",
      decision: "Execute",
      confidence: choice.confidence,
      detail: `Confidence ${pct(choice.confidence)} clears τ ${fmt(ctx.input.tau)}, and the class is executable.`,
      status: "allow",
    });
    actAs(ctx, picked, "Fast worker");
    finish(ctx, `Fast path. ${agentName(picked)} ran without a strong model.`);
    return;
  }
  push(ctx, {
    kind: "gate",
    title: "Escalate to a strong step",
    actor: "critic",
    decision: "Escalate",
    confidence: choice.confidence,
    detail: `Confidence ${pct(choice.confidence)} is under τ ${fmt(ctx.input.tau)}. REFLEX spends one strong step instead of acting on a thin margin.`,
    status: "hold",
    cost: 3.4,
    latencyMs: 1200,
  });
  const strong = ctx.input.enabled.includes("critic") ? "critic" : ctx.input.enabled.includes("smith") ? "smith" : ctx.input.enabled[0];
  if (!strong) {
    finish(ctx, "The gate wanted a strong step, but no worker is enabled.");
    return;
  }
  actAs(ctx, strong, "Strong step");
  finish(ctx, "Escalated. The thin margin did not execute on its own.");
}

function runComposite(ctx: Ctx) {
  const scored = compositeOf(ctx.input.objective, ctx.input.enabled, ctx.input.weights);
  ctx.memory.composite = scored.score;
  ctx.memory.band = scored.band;
  push(ctx, {
    kind: "judge",
    title: "Four dimensions",
    actor: "critic",
    decision: scored.band,
    confidence: Math.abs(scored.score - 0.5) * 2,
    dist: [
      { label: "Quality", p: scored.quality },
      { label: "Safety", p: scored.safety },
      { label: "Fit", p: scored.fit },
      { label: "Completeness", p: scored.completeness },
    ],
    detail: `${scored.detail}. Accept ≥ 0.72, review ≥ 0.48, else reject.`,
    latencyMs: FANOUT_QUESTION_MS,
    cost: JUDGE_COST + 0.03,
    status: scored.band === "accept" ? "allow" : scored.band === "review" ? "hold" : "deny",
  });
  if (scored.band === "reject") {
    addArtifact(
      ctx,
      "Rejection",
      `${scored.detail}\nLowest pressure is whatever dimension you weighted that still scored poorly. Change the weights on the desk and run again — the band is yours.`,
    );
    finish(ctx, `Rejected at ${fmt(scored.score)}.`);
    return;
  }
  if (scored.band === "review") {
    hold(ctx, { kind: "quality" }, `Review band at ${fmt(scored.score)}. Accept the draft or send it back.`);
    return;
  }
  const drafter = ctx.input.enabled.includes("mason") ? "mason" : ctx.input.enabled[0];
  if (!drafter) {
    finish(ctx, "Accepted on the score, but no worker is enabled to draft.");
    return;
  }
  actAs(ctx, drafter, "Accepted — draft it");
  finish(ctx, `Accepted at ${fmt(scored.score)}.`);
}

function runRetrieve(ctx: Ctx) {
  const ranked = retrieveRank(ctx.input.objective);
  const kept = ranked.filter((row) => row.kept);
  push(ctx, {
    kind: "judge",
    title: "Rank, then judge",
    actor: "scout",
    decision: kept.length ? `${kept.length} kept` : "None kept",
    confidence: kept[0]?.p ?? ranked[0]?.p ?? 0,
    dist: ranked.slice(0, 6).map((row) => ({ label: row.title, p: row.p })),
    detail:
      "BM25-style score, then P(relevant) = sigmoid(score − 1.15). Keep at 0.50 or above. Bars are probabilities, not raw BM25.",
    latencyMs: 80,
    cost: JUDGE_COST,
    status: kept.length ? "allow" : "deny",
  });
  if (!kept.length) {
    addArtifact(
      ctx,
      "No grounded draft",
      "No card cleared 0.50. The writer will not invent sources. Try the Decision layer preset, or mention sync, contract net, or the policy table.",
    );
    finish(ctx, "Retrieve refused to ground a draft.");
    return;
  }
  const body = [
    `Question: ${clip(ctx.input.objective, 240)}`,
    "Kept cards:",
    ...kept.map((row) => `• ${row.title} (${pct(row.p)}) — ${row.text}`),
    "Dropped cards stay out of this note.",
  ].join("\n");
  ctx.memory.worker = ctx.input.enabled.includes("mason") ? "mason" : "scout";
  addArtifact(ctx, "Grounded note", body);
  finish(ctx, `${kept.length} card${kept.length === 1 ? "" : "s"} cleared the judge.`);
}

function runContract(ctx: Ctx) {
  const ranking = bidsFor(ctx.input.objective, ctx.input.enabled);
  if (!ranking.judgment || !ranking.rows.length) {
    push(ctx, {
      kind: "note",
      title: "No bids",
      detail: "Enable at least one worker. Locked agents do not bid.",
      status: "deny",
      actor: "router",
    });
    finish(ctx, "Contract net had an empty roster.");
    return;
  }
  const margin = marginOf(ranking.judgment);
  ctx.memory.leader = ranking.leaderId;
  ctx.memory.worker = ranking.leaderId;
  push(ctx, {
    kind: "note",
    title: "Task announced",
    actor: "router",
    detail: clip(ctx.input.objective, 240),
    status: "info",
  });
  push(ctx, {
    kind: "judge",
    title: "Bids",
    actor: "router",
    decision: ranking.judgment.decision,
    confidence: ranking.judgment.confidence,
    dist: ranking.judgment.dist,
    detail: `raw = (hits or 0.2) / cost^0.3. Softmax temperature 0.50. Margin ${fmt(margin)}. ${ranking.rows
      .map((row) => `${row.name} ${row.hits} hit${row.hits === 1 ? "" : "s"} raw ${fmt(row.raw)}`)
      .join(". ")}.`,
    latencyMs: FANOUT_QUESTION_MS,
    cost: JUDGE_COST,
    status: ranking.judgment.confidence < ctx.input.tau ? "hold" : "allow",
  });
  if (ranking.judgment.confidence < ctx.input.tau) {
    hold(
      ctx,
      { kind: "award", leader: ranking.leaderId },
      `${ranking.judgment.decision} leads, but confidence ${pct(ranking.judgment.confidence)} is under τ ${fmt(ctx.input.tau)}.`,
    );
    return;
  }
  actAs(ctx, ranking.leaderId, "Award");
  finish(ctx, `Awarded to ${agentName(ranking.leaderId)}.`);
}

function runGuard(ctx: Ctx) {
  const policy = policyOf(ctx.input.objective, ctx.input.tau);
  const safe = safeOf(ctx.input.objective);
  ctx.memory.actionClass = policy.actionClass;
  ctx.memory.actionLabel = policy.actionLabel;
  ctx.memory.safeP = safe.dist.find((row) => row.label === "Safe to run")?.p ?? 0;
  push(ctx, {
    kind: "judge",
    title: "Safe to run alone?",
    actor: "warden",
    decision: safe.decision,
    confidence: safe.confidence,
    dist: safe.dist,
    detail: "Noul. This number does not grant permission.",
    latencyMs: FANOUT_QUESTION_MS,
    cost: JUDGE_COST,
    status: "info",
  });
  push(ctx, {
    kind: "gate",
    title: "Policy table",
    actor: "warden",
    decision: policy.status === "allow" ? "Allow" : "Person",
    confidence: safe.confidence,
    detail: policy.why,
    status: policy.status === "allow" ? "allow" : "hold",
  });
  if (policy.status === "hold") {
    hold(ctx, { kind: "guard", label: policy.actionLabel }, policy.why);
    return;
  }
  const worker =
    ctx.memory.actionClass === "read"
      ? ctx.input.enabled.includes("scout")
        ? "scout"
        : ctx.input.enabled[0]
      : ctx.input.enabled.includes("mason")
        ? "mason"
        : ctx.input.enabled[0];
  if (!worker) {
    finish(ctx, "Policy allowed the step, but no worker is enabled.");
    return;
  }
  actAs(ctx, worker, "Allowed by the table");
  finish(ctx, "Allowed. The effect stayed on this device.");
}

function runBlackboard(ctx: Ctx) {
  const goals: { title: string; prefer: string[]; needs: string }[] = [
    { title: "Gather points", prefer: ["scout", "clerk"], needs: "" },
    { title: "Stress-test claims", prefer: ["critic", "smith"], needs: "Gather points" },
    { title: "Draft the deliverable", prefer: ["mason", "clerk"], needs: "Gather points" },
  ];
  const posted = new Set<string>();
  push(ctx, {
    kind: "state",
    title: "Board opened",
    actor: "router",
    detail: "Three goals. A goal posts only if one of its candidates is enabled. Draft and critique name the research precondition.",
    status: "info",
  });
  for (const goal of goals) {
    const owner = goal.prefer.find((id) => ctx.input.enabled.includes(id));
    if (goal.needs && !posted.has(goal.needs)) {
      push(ctx, {
        kind: "note",
        title: `${goal.title} is thin`,
        detail: `Precondition “${goal.needs}” was not posted. The goal can still be attempted, but it must say so.`,
        status: "hold",
        actor: "router",
      });
    }
    if (!owner) {
      push(ctx, {
        kind: "note",
        title: `${goal.title} unassigned`,
        detail: `None of ${goal.prefer.map(agentName).join(", ")} are enabled.`,
        status: "deny",
        actor: "router",
      });
      continue;
    }
    posted.add(goal.title);
    ctx.memory.worker = owner;
    const agent = agentById(owner);
    push(ctx, {
      kind: "act",
      title: `${agent?.name ?? owner} posts “${goal.title}”`,
      actor: owner,
      decision: agent?.name,
      detail: goal.needs ? `Reads “${goal.needs}” on the board first.` : "No precondition.",
      latencyMs: agent?.latencyMs ?? 0,
      cost: agent?.cost ?? 0,
      status: "allow",
    });
  }
  const lines = [
    `Objective: ${clip(ctx.input.objective, 240)}`,
    ...[...posted].map((title) => `Posted: ${title}.`),
    posted.has("Draft the deliverable")
      ? "Draft stays on the desk. Publish was not a goal, and it would have stopped at the guard."
      : "No draft was posted.",
  ];
  addArtifact(ctx, "Board", lines.join("\n"));
  finish(ctx, posted.size ? `${posted.size} goal${posted.size === 1 ? "" : "s"} posted.` : "The board stayed empty.");
}

function open(input: RunInput, id = uid()): Ctx {
  return {
    id,
    input,
    steps: [],
    artifacts: [],
    memory: blankMemory(),
    phase: "done",
    pending: null,
    resume: null,
    summary: "",
    seq: 0,
  };
}

export function begin(input: RunInput): Snapshot {
  const ctx = open(input);
  stateStep(ctx);
  switch (input.pattern) {
    case "fanout":
      runFanout(ctx);
      break;
    case "reflex":
      runReflex(ctx);
      break;
    case "composite":
      runComposite(ctx);
      break;
    case "cascade":
      runCascade(ctx);
      break;
    case "retrieve":
      runRetrieve(ctx);
      break;
    case "contract":
      runContract(ctx);
      break;
    case "guard":
      runGuard(ctx);
      break;
    case "blackboard":
      runBlackboard(ctx);
      break;
    default:
      finish(ctx, "Unknown pattern.");
  }
  if (!ctx.summary) finish(ctx, "Run finished.");
  return snapshot(ctx);
}

export function respond(previous: Snapshot, choice: "approve" | "refuse"): Snapshot {
  const ctx = open(previous.input, previous.id);
  ctx.steps = previous.steps.map((step) => ({ ...step }));
  ctx.artifacts = previous.artifacts.map((item) => ({ ...item }));
  ctx.memory = { ...previous.memory };
  ctx.seq = previous.steps.length;
  const pending = previous.pending;
  push(ctx, {
    kind: "human",
    title: choice === "approve" ? "Person allowed it" : "Person refused it",
    actor: "you",
    decision: choice === "approve" ? "Allow" : "Refuse",
    detail:
      choice === "approve"
        ? "Approval covers a prepare step on this device. It does not send, pay, delete, or publish."
        : "Refusal stops the run. No effect was applied.",
    status: choice === "approve" ? "allow" : "deny",
  });
  if (!pending || choice === "refuse") {
    finish(ctx, choice === "refuse" ? "Stopped by a person. Nothing left the desk." : "Nothing was pending.");
    return snapshot(ctx);
  }
  if (previous.resume === "cascade-after-guard" && pending.kind === "guard") {
    continueCascade(ctx);
    return snapshot(ctx);
  }
  if (pending.kind === "quality") {
    const drafter = ctx.input.enabled.includes("mason") ? "mason" : ctx.input.enabled[0];
    if (drafter) actAs(ctx, drafter, "Accepted by a person");
    finish(ctx, "A person accepted the review band.");
    return snapshot(ctx);
  }
  if (pending.kind === "award") {
    actAs(ctx, pending.leader, "Awarded by a person");
    finish(ctx, `A person awarded ${agentName(pending.leader)}.`);
    return snapshot(ctx);
  }
  if (pending.kind === "ask") {
    const next = ctx.input.enabled.includes(pending.next) ? pending.next : ctx.input.enabled[0];
    if (next) actAs(ctx, next, "Continued after a person answered");
    finish(ctx, "A person answered. The desk prepared a note and stopped.");
    return snapshot(ctx);
  }
  const worker = ctx.input.enabled.includes("clerk") ? "clerk" : ctx.input.enabled[0];
  if (worker) actAs(ctx, worker, "Prepare-only packet");
  finish(ctx, "Prepared only. Nothing was sent, paid, or deleted.");
  return snapshot(ctx);
}

export function totalsOf(steps: Step[]): Totals {
  return {
    latencyMs: steps.reduce((sum, step) => sum + (step.latencyMs ?? 0), 0),
    cost: round2(steps.reduce((sum, step) => sum + (step.cost ?? 0), 0)),
    questions: steps.filter((step) => step.kind === "judge").length,
    escalations: steps.filter((step) => step.kind === "human" || step.decision === "Escalate" || step.decision === "Person").length,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function replay(run: SavedRun): Snapshot {
  const ctx = open(
    {
      objective: run.objective,
      pattern: run.pattern,
      tau: 0.62,
      weights: { quality: 35, safety: 25, fit: 20, completeness: 20 },
      enabled: [],
    },
    run.id,
  );
  ctx.steps = run.steps;
  ctx.artifacts = run.artifacts;
  ctx.summary = run.summary;
  ctx.phase = "done";
  return snapshot(ctx);
}

export function isSavedRun(value: unknown): value is SavedRun {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<SavedRun>;
  return typeof row.id === "string" && typeof row.objective === "string" && Array.isArray(row.steps);
}
