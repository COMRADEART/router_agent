# Bunny-A M-A-0 — Capability model

## Manifest

Every capability provider implements `CapabilityAdapter` (`capabilities/bus.server.ts`):

```ts
manifest: { id, version, description, locality: "local"|"remote", platforms, actions: ActionManifest[], events, cost, adapter }
health(): Promise<{ availability: "available"|"degraded"|"unavailable"|"unconfigured"|"unsupported"; detail }>
execute(action, params, { missionId, stepId, cwd, roots, dataDirectory, signal, timeoutMs }): Promise<CapabilityResult>
riskFor?(action, params): RiskClass | null      // parameter-dependent escalation
```

`ActionManifest`: `id` (namespaced `capability.action`), `description`, `risk` (READ/WRITE/EXECUTE/EXTERNAL_SIDE_EFFECT/DESTRUCTIVE), `sensitive`, `hardApproval`, `inputs`, `outputs`, `evidence`, `timeoutMs`, `implemented`.

`CapabilityResult`: `ok`, `status` (`succeeded/failed/denied/unavailable/unconfigured/unsupported/timeout/interrupted`), `summary`, `output`, `evidence[]`, optional `artifacts[]`, `before/after`, `errorCategory`.

## Bus behaviour

`request()` → `capability.requested` → decision (see security model). `ask` executes nothing and returns no run (the caller raises a permission request). `deny` records a `denied` run. Non-available capabilities record `unavailable/unconfigured/unsupported` runs — never success. Allowed actions run with an `AbortController` timeout (≤30 min), are recorded in `capability_runs` (redacted parameters, summary, evidence, artifacts, duration, origin) and emit `capability.started` + `capability.completed/failed`. Mission cancellation aborts in-flight runs; aborting a terminal run ends exactly the spawned process tree (`taskkill /T` on Windows).

## Registered capabilities and what each really does

| Capability | Actions (implemented) | Availability on the dev workstation | Notes |
|---|---|---|---|
| `filesystem` | `read` (≤1 MB), `list` (≤500), `exists`, `write` (atomic, no silent overwrite, read-back), `delete` (single file, DESTRUCTIVE) | available | Paths canonicalized (symlinks/junctions followed) and contained in approved roots. |
| `terminal` | `exec` | available | argv only, `shell: false`; npm/npx via this Node's bundled npm CLI; `.cmd/.bat/.ps1/.js` refused; bounded output; timeout; parameter escalation. |
| `git` | `status`, `diff` (patch artifact), `log`, `commit`, `worktree_add` (under `<data>/worktrees`, branch `bunny/<mission>-<name>`), `worktree_remove` (Bunny-owned only, no force), `merge` (`bunny/*` only, `--no-ff`; conflict → `merge --abort`, tree unchanged) | available | No push/fetch. |
| `notifications` | `send` → Bunny Inbox | available | Local only; no phone push. |
| `browser` | `navigate, search (DuckDuckGo HTML), read, extract, metadata, click, type, wait, screenshot, download, tabs` | available (installed Chrome, isolated profile) | DOM/accessibility locators (role+name, label, placeholder, text, CSS). Evidence: URL, title, retrieval time; `read` stores a `browser_evidence` artifact, `search` a `research_note`. |
| `computer` (win32) | `list_windows, read_controls, focus_window, invoke_control, type (ValuePattern), capture, open_app` | available | UI Automation + user32 through `powershell.exe`; parameters passed via an environment variable, never interpolated into script text. No coordinates/keystrokes. |
| `github` | `pr_list, issue_list, repo_view` | available (gh signed in) | `pr_create`, `comment`: contract only (`implemented: false`, hardApproval). |
| `email` | `read`, `send` | **unconfigured** | contract only |
| `calendar` | `list`, `create`, `cancel` | **unconfigured** | contract only |
| `messaging` | `send_message`, `receive_message` | **unconfigured** | contract only; personal messaging UIs are never automated |
| `sms` | `send_message`, `receive_message` | **unconfigured** | contract only |
| `whatsapp` | `send_message`, `receive_message` | **unconfigured** | official Business API only; contract only |
| `phone` | `start_call, receive_call, speak, listen, hang_up, transcript` | **unconfigured** | contract only; no telephony backend; nothing simulated |

"Available on the dev workstation" reflects `capability.refresh` on this Windows machine during M-A-0; it is re-probed every 5 minutes while missions are enabled.

## Execution preference (cheapest deterministic first)

1. Native library (Node fs) → 2. CLI (git, npm, gh, tar) → 3. browser DOM → 4. Windows UI Automation → 5. (raw input deliberately not offered) → 6. local model (Ollama via TaskManager) → 7. external model (Codex/Claude via TaskManager).

The planner maps known requests to skills/capabilities (zero model tokens); `localOnly` and step `local` preferences push model steps to Ollama; an exhausted external-call budget forces `localOnly` or fails the step as `budget_exceeded`. Local execution still uses CPU/GPU/RAM; "zero tokens" is not "zero compute".

## Skill Library

`Skill`: `id, version, name, description, requirements, preconditions (file_exists | git_repository | capability_available), parameters, steps (semantic capability actions with ${param} templates), validations (status_succeeded | exit_code | output_contains), cleanup, provenance (builtin | recorded | repaired), status (active | candidate | retired), previousVersion, reliability (runs, successes, lastSuccessAt, lastFailureAt)`.

Built-ins (v1): `project.test`, `project.build`, `project.typecheck`, `project.lint`, `git.snapshot`, `git.worktree`, `screen.capture`, `web.capture_page`, `web.download`, `archive.extract`, `app.open`, `project.open`.

Lifecycle:

* A failing step stops the skill immediately (no unsafe continuation), runs cleanup, records the failure and emits `skill.failed` ("repair candidate needed; last-known-good unchanged") → Inbox `requires_attention`.
* `skill.repair` saves a **new version** as `candidate`; the active version is untouched.
* `skill.verify` runs the candidate; only a run that passes every validation promotes it (previous version `retired`, kept as history).
* `skill.record` builds a candidate from successful capability runs (semantic actions + parameters); runs with redacted/private parameters cannot be recorded; candidates cannot be used by missions until verified.
* Not implemented: "start server" and "restart approved Bunny component" (no service manager capability yet); automatic LLM-driven repair (repair steps are supplied explicitly).

## Adding a capability

Implement `CapabilityAdapter`, namespace every action under the manifest id, report health truthfully, set `implemented: false` for contract-only actions, and register it in `MissionManager`'s adapter list. The bus refuses duplicate ids and un-namespaced actions.
