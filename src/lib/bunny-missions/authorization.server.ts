import { basename, isAbsolute, resolve } from "node:path";
import type { Mode, ProviderId } from "../orch/types.ts";
import { withinAny } from "./paths.server.ts";
import type { ActionManifest, AuthorizationEnvelope, Budget, GitAction, GrantPolicy, MissionStep, PermissionDecision, RiskClass, ScopeRequest } from "./types.ts";

export const ALWAYS_ASK: RiskClass[] = ["EXTERNAL_SIDE_EFFECT", "DESTRUCTIVE"];
export const MODE_BUDGET: Record<Mode, Budget> = {
  fast: { maxExternalModelCalls: 2, maxRuntimeMs: 30 * 60_000, maxRetries: 2, maxTokens: null },
  balanced: { maxExternalModelCalls: 6, maxRuntimeMs: 60 * 60_000, maxRetries: 4, maxTokens: null },
  deep: { maxExternalModelCalls: 12, maxRuntimeMs: 2 * 60 * 60_000, maxRetries: 6, maxTokens: null },
};
const GIT_ACTION: Record<string, GitAction> = { "git.status": "status", "git.diff": "diff", "git.log": "log", "git.commit": "commit", "git.worktree_add": "worktree", "git.worktree_remove": "worktree", "git.merge": "merge" };

export function matches(patterns: string[], action: string) {
  return patterns.some((pattern) => pattern === "*" || pattern === action || (pattern.endsWith(".*") && action.startsWith(pattern.slice(0, -1))));
}
/** Command identity for allowlists: "C:\\x\\Node.EXE" → "node". */
export function commandName(command: string) { return basename(command).toLowerCase().replace(/\.(exe|cmd|bat)$/, ""); }
export function domainOf(url: string): string | null { try { return new URL(url).hostname.toLowerCase(); } catch { return null; } }
function domainAllowed(domains: string[] | "public", host: string) {
  if (domains === "public") return true;
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/**
 * The scope a mission asks for, derived from its planned steps. Nothing is granted until the user
 * approves the mission; approval turns this request into a persisted envelope.
 */
export function scopeFor(steps: Pick<MissionStep, "executor" | "requiredCapabilities" | "verification" | "scope" | "providerConstraints">[], root: string, mode: Mode, options: { localOnly?: boolean; providers?: ProviderId[] | null; budget?: Budget; skillSteps?: (skillId: string) => { action: string; params: Record<string, unknown> }[] } = {}): ScopeRequest {
  const actions = new Set<string>(["notifications.send", "filesystem.read", "filesystem.list", "filesystem.exists"]);
  const commands = new Set<string>(); const git = new Set<GitAction>(); const risks = new Set<RiskClass>(["READ"]);
  let browser = false; let computer = false; let network = false; let execution = false; let write = false;
  for (const step of steps) {
    for (const capability of step.requiredCapabilities) actions.add(capability);
    if (step.executor.kind === "model") { execution = true; if (step.scope.access === "write") write = true; }
    // A skill asks for exactly what its own steps will do, so its commands are in the envelope up front.
    const concrete = step.executor.kind === "capability" ? [{ action: step.executor.action, params: step.executor.params as Record<string, unknown> }] : step.executor.kind === "skill" ? options.skillSteps?.(step.executor.skillId) ?? [] : [];
    for (const item of concrete) {
      actions.add(item.action);
      if (item.action === "terminal.exec" && typeof item.params.command === "string") commands.add(commandName(item.params.command));
    }
    for (const check of step.verification) if (check.kind === "command") { actions.add("terminal.exec"); commands.add(commandName(check.command)); }
    if (step.scope.access === "write") write = true;
    if (step.scope.isolation === "worktree") actions.add("git.worktree_add");
    if (step.verification.some((check) => check.kind === "git_diff_nonempty")) actions.add("git.diff");
  }
  for (const action of actions) {
    if (action.startsWith("browser.")) { browser = true; network = true; }
    if (action.startsWith("computer.")) computer = true;
    if (action.startsWith("github.")) network = true;
    if (GIT_ACTION[action]) git.add(GIT_ACTION[action]);
    if (action === "terminal.exec") risks.add("EXECUTE");
    if (action === "filesystem.write" || action === "git.commit" || action === "git.merge" || action.startsWith("git.worktree")) risks.add("WRITE");
    if (action === "filesystem.write" || action === "git.commit" || action === "git.merge") write = true;
  }
  if (write) risks.add("WRITE");
  if (execution) risks.add("EXECUTE");
  return {
    projectRoots: [root],
    riskClasses: [...risks],
    capabilities: [...actions].sort(),
    providers: { execution, allow: options.providers ?? null, localOnly: !!options.localOnly },
    filesystem: { read: [root], write: write ? [root] : [] },
    browser: { enabled: browser, domains: "public" },
    terminal: { enabled: commands.size > 0, commands: [...commands].sort() },
    git: { actions: [...git].sort() },
    network: { allowed: network },
    computer: { enabled: computer },
    budget: options.budget ?? MODE_BUDGET[mode],
    alwaysAsk: [...ALWAYS_ASK],
  };
}

export function envelopeFrom(request: ScopeRequest, missionId: string, grantedBy: string, maxRuntimeMs: number, extraRoots: string[] = []): AuthorizationEnvelope {
  const now = Date.now();
  return {
    ...request,
    projectRoots: [...request.projectRoots, ...extraRoots],
    filesystem: { read: [...request.filesystem.read, ...extraRoots], write: request.filesystem.write.length ? [...request.filesystem.write, ...extraRoots] : [] },
    id: crypto.randomUUID(), missionId, grantedAt: now, grantedBy, expiresAt: now + Math.min(maxRuntimeMs, request.budget.maxRuntimeMs), revokedAt: null,
  };
}

/** Parameter-level scope check for one action against an envelope. Returns why it is outside, or null. */
export function scopeViolation(action: string, params: Record<string, unknown>, envelope: AuthorizationEnvelope, base?: string): string | null {
  // Relative paths are judged where they will actually resolve: the step's working folder.
  const at = (value: unknown) => typeof value === "string" && value ? (isAbsolute(value) || !base ? value : resolve(base, value)) : null;
  const path = at(params.path);
  const cwd = at(params.cwd);
  if (action.startsWith("filesystem.")) {
    if (!path) return null;
    const roots = action === "filesystem.write" || action === "filesystem.delete" ? envelope.filesystem.write : [...envelope.filesystem.read, ...envelope.filesystem.write];
    return withinAny(roots, path) ? null : `${path} is outside the approved ${action === "filesystem.write" || action === "filesystem.delete" ? "write" : "read"} scope.`;
  }
  if (action === "terminal.exec") {
    if (!envelope.terminal.enabled) return "Terminal execution was not approved for this mission.";
    const command = typeof params.command === "string" ? commandName(params.command) : "";
    if (!envelope.terminal.commands.includes(command)) return `Command "${command}" is not in the approved command list (${envelope.terminal.commands.join(", ") || "none"}).`;
    if (cwd && !withinAny(envelope.projectRoots, cwd)) return `Working folder ${cwd} is outside the approved project roots.`;
    return null;
  }
  if (GIT_ACTION[action]) {
    if (!envelope.git.actions.includes(GIT_ACTION[action])) return `Git ${GIT_ACTION[action]} was not approved for this mission.`;
    if (cwd && !withinAny(envelope.projectRoots, cwd)) return `Repository ${cwd} is outside the approved project roots.`;
    return null;
  }
  if (action.startsWith("browser.")) {
    if (!envelope.browser.enabled || !envelope.network.allowed) return "Browser use was not approved for this mission.";
    const url = typeof params.url === "string" ? params.url : null;
    if (url) { const host = domainOf(url); if (!host || !domainAllowed(envelope.browser.domains, host)) return `Domain ${host ?? url} is outside the approved browser scope.`; }
    return null;
  }
  if (action.startsWith("computer.")) return envelope.computer.enabled ? null : "Computer control was not approved for this mission.";
  if (action.startsWith("github.")) return envelope.network.allowed ? null : "Network access was not approved for this mission.";
  return null;
}

export type GrantRow = { action: string; scope: string; policy: GrantPolicy };
function grantFor(grants: GrantRow[], action: string, missionId: string | null): GrantPolicy | null {
  const scoped = missionId ? grants.filter((grant) => grant.scope === `mission:${missionId}` && matches([grant.action], action)) : [];
  const global = grants.filter((grant) => grant.scope === "global" && matches([grant.action], action));
  // Most restrictive applicable policy wins.
  const order: GrantPolicy[] = ["never_allow", "read_only", "ask_every_time", "allow_for_mission", "always_allow"];
  const all = [...scoped, ...global].map((grant) => grant.policy).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return all[0] ?? null;
}

/**
 * The single permission decision every capability execution passes through.
 * - `oneTime`: the user just allowed this exact pending request.
 * - `direct`: a workstation user invoked the action explicitly outside any mission (still asks for
 *   EXTERNAL_SIDE_EFFECT / DESTRUCTIVE / hard-approval actions unless `confirmed`).
 */
export function decide(manifest: ActionManifest, params: Record<string, unknown>, context: { envelope: AuthorizationEnvelope | null; missionId: string | null; grants: GrantRow[]; oneTime?: boolean; direct?: { confirmed: boolean }; now?: number; base?: string }): PermissionDecision {
  const risk = manifest.risk; const now = context.now ?? Date.now();
  const deny = (reason: string): PermissionDecision => ({ decision: "deny", reason, risk });
  const ask = (reason: string): PermissionDecision => ({ decision: "ask", reason, risk });
  const allow = (reason: string): PermissionDecision => ({ decision: "allow", reason, risk });
  if (!manifest.implemented) return deny(`${manifest.id} is not implemented on this Host.`);
  const grant = grantFor(context.grants, manifest.id, context.missionId);
  if (grant === "never_allow") return deny(`A persistent "never allow" rule covers ${manifest.id}.`);
  if (grant === "read_only" && risk !== "READ") return deny(`A persistent "read only" rule covers ${manifest.id}.`);
  if (context.oneTime) return allow("The user allowed this specific request once.");
  if (context.direct) {
    if ((manifest.hardApproval || ALWAYS_ASK.includes(risk) || manifest.sensitive) && !context.direct.confirmed) return ask(`${manifest.id} is ${risk.toLowerCase().replaceAll("_", " ")}${manifest.sensitive ? " and privacy-sensitive" : ""}; explicit confirmation required.`);
    return allow("Invoked directly by the workstation user.");
  }
  const envelope = context.envelope;
  if (!envelope) return ask("No mission authorization covers this action.");
  if (envelope.revokedAt) return deny("The mission authorization was revoked.");
  if (envelope.expiresAt <= now) return ask("The mission authorization expired.");
  if (manifest.hardApproval) return ask(`${manifest.id} always needs explicit approval.`);
  if (grant === "ask_every_time") return ask(`A persistent "ask every time" rule covers ${manifest.id}.`);
  if (!matches(envelope.capabilities, manifest.id)) return ask(`${manifest.id} is outside the approved capability list.`);
  if (!envelope.riskClasses.includes(risk)) return ask(`${risk} actions were not approved for this mission.`);
  const violation = scopeViolation(manifest.id, params, envelope, context.base);
  if (violation) return ask(violation);
  const elevated = grant === "always_allow" || grant === "allow_for_mission";
  if (envelope.alwaysAsk.includes(risk) && !(elevated && risk !== "DESTRUCTIVE")) return ask(`${risk.replaceAll("_", " ").toLowerCase()} actions always ask.`);
  if (manifest.sensitive && !elevated) return ask(`${manifest.id} is privacy-sensitive and asks each time.`);
  return allow(`Inside mission authorization ${envelope.id}.`);
}

/** Checks a child model task against the envelope before a delegated launch. */
export function taskViolation(task: { provider: ProviderId; cwd?: string; decision: { recommended_provider: ProviderId } }, envelope: AuthorizationEnvelope, local: boolean, externalCallsUsed: number, now = Date.now()): string | null {
  if (envelope.revokedAt) return "authorization revoked";
  if (envelope.expiresAt <= now) return "authorization expired";
  if (!envelope.providers.execution) return "provider execution was not approved";
  if (envelope.providers.allow && !envelope.providers.allow.includes(task.provider)) return `${task.provider} is outside the approved providers`;
  if (envelope.providers.localOnly && !local) return "mission is local-only and this provider runs in the cloud";
  if (!local && externalCallsUsed >= envelope.budget.maxExternalModelCalls) return `external model call budget (${envelope.budget.maxExternalModelCalls}) exhausted`;
  if (!task.cwd || !withinAny(envelope.projectRoots, task.cwd)) return `working folder ${task.cwd ?? "unknown"} is outside the approved project roots`;
  return null;
}
