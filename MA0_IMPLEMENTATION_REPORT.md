# Bunny-A M-A-0 — Implementation report

October 2, 2026 · branch `ma0-mission-architecture` · baseline `ea0e803` (clean tree, `main`).

Architecture: [docs/MA0_ARCHITECTURE.md](docs/MA0_ARCHITECTURE.md) · [compatibility](docs/MA0_COMPATIBILITY.md) · [security](docs/MA0_SECURITY_MODEL.md) · [capabilities](docs/MA0_CAPABILITY_MODEL.md) · [state machine](docs/MA0_MISSION_STATE_MACHINE.md) · review packet: [MA0_CLAUDE_REVIEW_PACKET.md](MA0_CLAUDE_REVIEW_PACKET.md).

## Baseline (recorded before any edit)

| Gate | Baseline result | Log |
|---|---|---|
| `npm test` | 205 script + 103 application/Host = 308 pass, 0 fail | `test-results/ma0/baseline-test.log` |
| `npm run test:ui` | 12 pass | `baseline-test-ui.log` |
| typecheck | pass | `baseline-typecheck.log` |
| lint | 0 errors, 10 warnings | `baseline-lint.log` |
| build | pass | `baseline-build.log` |
| Host DB | `user_version` 2; tables tasks, projects, events, outcomes, devices, migrations, policies, settings, providers | live snapshot |
| Live Host | PID 14188, instance `5b8d70f2-7429-48a1-b418-beacb31441f5`, running this checkout | `/health` |

## Final gates

| Gate | Result | Log |
|---|---|---|
| `npm test` | 205 script + **139** application/Host/mission = 344 pass, 0 fail (36 new mission tests) | `test-results/ma0/final-test.log` |
| `npm run test:ui` | **18** pass (6 new) | `final-test-ui.log` |
| typecheck | pass | `final-typecheck.log` |
| lint | 0 errors, the same 10 pre-existing warnings | `final-lint.log` |
| production build (`npm run build`) | pass | `final-build.log` |
| Live-data migration | all pre-existing rows byte-identical (SHA-256), schema 2→3, idempotent | `live-snapshot-migration.json` |
| Dev render (isolated test Host) | desktop, light theme and 390×844 companion rendered; 0 console errors; 0 px horizontal overflow; 11 screenshots inspected | `screenshots/ma0/` |

Total: 362 tests (baseline 320), 0 failures.

## IMPLEMENTED

* **Mission layer** — persisted missions and step graphs; validated mission/step state machines; DAG validation (cycles, unknown dependencies, size); dependency-aware scheduling with parallel independent steps; configurable concurrency (3), steps (12), retries per step (2), replans (2), runtime (120 min), active missions (3).
* **Model steps through TaskManager** — `TaskManager.submit(…, delegated)` and `TaskManager.approveDelegated()`; children routed by the unchanged BunnyRouter; `approval.delegated` audit event; `approve(id)` unchanged. MissionManager imports no adapter.
* **Scoped mission authorization** — envelope derived from the plan (including skill internals), persisted on approval, re-checked per child and per capability call; Allow once / Deny permission requests; budgets (external model calls, runtime, retries, optional token ceiling).
* **Capability Bus** — manifests, health, single decision function, recorded/redacted runs, events, artifacts, abort/timeout, grant policies enforced (`always_allow, allow_for_mission, ask_every_time, read_only, never_allow`).
* **Local capabilities** — filesystem (read/list/exists/write/delete), terminal (shell-free exec with escalation), git (status/diff/log/commit/worktree add+remove/merge with conflict abort), notifications (Inbox).
* **Browser Runtime** — isolated Bunny profile; navigate, search, read, extract, metadata, click, type, wait, screenshot, download, tabs; SSRF guard; evidence artifacts. Verified against a real page in Chrome headless.
* **Computer Runtime (Windows)** — list_windows, read_controls, focus_window, invoke_control (Invoke/Toggle/Select/Expand), type (ValuePattern), capture, open_app (allowlist). `list_windows` verified live; others verified for refusal/permission paths only (see NOT TESTED).
* **GitHub** — `pr_list`, `issue_list`, `repo_view` through the signed-in gh CLI (health verified; queries not executed in tests).
* **Skill Library** — 12 built-in skills, versioning, failure stop + repair candidate, verified promotion, retired history, semantic record/replay.
* **Artifact Bus** — inline/file artifacts with SHA-256, consumers, verification status; dependents get excerpts + references.
* **Mission memory** — bounded, provenance, verified vs. unverified enforced by provenance.
* **Bunny Inbox** — event classification, suggestions, auto-acknowledgement of answered items.
* **Workspace safety** — persisted shared/exclusive locks with nested-path conflicts; writers on one workspace serialized; git worktree isolation per step (`isolation: "worktree"`).
* **Verification** — Bunny's own checks: TaskManager VerifySpec, file exists/contains, command exit code, non-empty git diff, artifact present. Mission result reports verified vs. unverified steps separately.
* **Failure/retry/recovery** — category-specific bounded retries, reroute only when an alternative provider exists, dependency blocking, mission stop with child cancellation (only its own children), Host-restart recovery that never claims resumption.
* **Host API** — 25 mission/capability/skill/trigger/inbox commands, validated, with remote/workstation split; `HostSnapshot.missions` (optional).
* **Feature flag** — off by default; `settings.missions_config` + `BUNNY_MISSIONS`; Settings → Missions toggle.
* **UI** — Bunny Bar mission strip (title, role glyphs ✓ ● ○ ! ✕, +N), expanded Mission Control (approval scope card, permission cards, agent list, agent detail with executor/activity/provider-plan progress/elapsed/artifacts/dependencies/verification, retry/stop, model-call accounting), 8 s completion state + auto-collapse, Task/Mission composer switch, Home and phone mission sections with Inbox, capability availability list.
* **Persistence** — additive schema v3 and 14 tables, recorded migration key, idempotent.

## PARTIALLY IMPLEMENTED

* **Planner** — deterministic heuristic (`bunny-planner-deterministic-v1`): deterministic intents, simple/medium/complex templates, explicit user graphs. No model-assisted planning; replanning re-runs the same planner (completed steps kept).
* **Self-improvement** — evidence is collected (child outcomes via the existing outcomes table and policy engine, capability runs, skill reliability, mission accounting, retries). Candidate/replay/promote/rollback exists for routing policy (pre-existing) and skills (new). No candidate *mission-planning* policy generation.
* **Provider/resource routing for missions** — mode per reasoning level, local preference, budget-forced local, reviewer independence (deny producer provider when an alternative exists). No quota-aware scheduling beyond what BunnyRouter already does.
* **Phone companion** — remote mission create/inspect/approve/respond/stop implemented and HTTP-tested with a paired device token; mission section renders in the companion view. Not exercised through the public tunnel or on a phone.
* **Resource accounting** — runtime, cloud vs. local model calls, deterministic steps, retries, provider-reported tokens. No dollar cost (not available).

## ARCHITECTURE ONLY

* Email, calendar, messaging, SMS, WhatsApp, phone/voice connectors: manifests + `CommunicationProvider` contract; report **unconfigured**; nothing simulated.
* GitHub mutations (`pr_create`, `comment`): contract only.
* Triggers from filesystem, GitHub, message, email, calendar sources: in the contract; creation refused ("no event feed on this Host yet").
* Inbox Supervisor decisions: rule-based suggestion only; nothing acts automatically.
* Persistent-permission UI: data model and enforcement exist; no UI to set grants (Host command only).

## NOT IMPLEMENTED

* Native WPF Island (`install/Bunny-Island.ps1`) mission display.
* Skills "start server" and "restart approved Bunny component".
* Automatic (LLM-driven) skill repair; repaired steps are supplied explicitly.
* Raw mouse/keyboard input (intentionally not offered).
* Windows wake-from-sleep, Android background push (unchanged from M3: unavailable).
* DNS pinning for the browser SSRF guard.

## NOT TESTED

* **Any live provider mission.** No Codex/Claude/Ollama child task was launched by a mission; mission→TaskManager integration is tested with fake adapters through the real TaskManager. No external model quota was spent.
* Computer Runtime `focus_window`, `invoke_control`, `type`, `capture`, `open_app` success paths on the real desktop (not run to avoid disturbing the user's session).
* GitHub queries against the API; `browser.search` against DuckDuckGo (network); browser tests used a local page.
* Production-build browser render and the Windows standalone package (only `npm run build` was run).
* Opening an M-A-0 database with the released v10/v13 binaries.
* The live installed Host after restart (not restarted).
* Public-HTTPS phone flow for missions.

## BLOCKED

None.

## Defects found and fixed during M-A-0

Found by tests or live QA, fixed, and covered by tests: reroute could deny the only provider (retry could never launch); relative paths were scope-checked against the Host's cwd; allow-once did not extend containment to the approved path; capability-step writes were missing from the envelope write scope; skill steps' commands were missing from the envelope (a "Run the tests" mission asked for permission it should already have); answered approvals stayed in the Inbox; Retry was offered when nothing had failed; "Draft a CONTRIBUTING guide" planned read-only; an allowed `provider.execute` request could leave its step stuck when the provider had become ineligible.

## Deviations from the specification

* Suggested module names were adapted (`store.server.ts` instead of a separate `scheduler/recovery` module; scheduling and recovery live in `manager.server.ts`).
* Mission states follow the suggested list exactly; step states add `blocked` and `skipped`.
* The feature flag defaults to **off**, so the live installation is unchanged in behaviour until missions are enabled.
* GLM review: **not performed.** A read-only advisory review was dispatched through the Cline delegate (GLM 5.2 profile; GLM 5.3 Flash is not available here), but the run failed at startup because the `cline` CLI is not installed (`spawn cline ENOENT`, run `c92b4ef7`, zero tool calls). It was not retried. A focused self-review was done instead; it found one defect (an allowed `provider.execute` request could leave a step stuck if the provider became ineligible), which is fixed and tested.

## Git

Commits on `ma0-mission-architecture` (no push, no history rewrite): `32ce245` backend, `dbab79e` UI, then the documentation/report commit (see the review packet for the final HEAD). Untracked evidence lives under ignored `test-results/ma0/` and `screenshots/ma0/`.

## Verdict

**BUNNY_MA0_IMPLEMENTATION_COMPLETE** — the architecture is implemented and wired end to end, repository gates pass (362 tests, typecheck, lint 0 errors, build), migration compatibility is proven on live data, the direct-task regression gate passes, documentation and the review packet exist, and no known critical regression is hidden. Live-provider missions, the Computer Runtime's action paths and the phone/public flow are left to M-A-1 as listed under NOT TESTED.
