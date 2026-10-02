# Bunny-A M-A-0 — Independent review packet

**To the reviewer:** review the code, not this packet's conclusions. Every claim below names the file or test that should prove it; verify the ones that matter by reading the code and running the commands. Treat the implementation report as the builder's own account.

## Identity

| | |
|---|---|
| Repository | `COMRADEART/router_agent` (local checkout `C:\Users\allam\Documents\new\bun-router`) |
| Baseline HEAD | `ea0e803b8186ac777ba67f4c47db58ccd6b4407d` (`main`, clean) |
| Final code HEAD | `60d54e048473d59c010a0e33b1f87cb48eb3b5fb` on branch `ma0-mission-architecture` (this packet is committed on top of it) |
| Commits | `32ce245` backend · `dbab79e` UI · `60d54e0` docs/report/fix · (packet) |
| Pushed | No |
| Diff | `git diff --stat ea0e803 60d54e0` → 47 files, +5,994 / −51 |

## Files changed

Modified (existing, additive): `package.json` (test glob), `src/lib/bunny-host/{contracts,http.server,manager.server,persistence.server}.ts`, `src/lib/orch/{types,host}.ts`, `src/store/use-island.ts`, `src/styles.css`, `src/components/island/{floating,desktop,phone,settings,task}.tsx`.

New: `src/lib/bunny-missions/**` (23 files incl. 2 test files), `src/components/island/{mission.tsx,mission.css,mission-model.ts,mission-model.test.ts}`, `docs/MA0_*.md` (5), `MA0_IMPLEMENTATION_REPORT.md`.

Untouched (verify with `git diff ea0e803 60d54e0 -- <path>`): `bunny-host/router.ts`, `learning.server.ts`, `adapters.server.ts`, `registry.server.ts`, `verification.server.ts`, `process-tree.server.ts`, `orch/host-bridge.server.ts`, `install/`.

## Architecture summary

A MissionManager above TaskManager plans a bounded step DAG, asks for one scoped approval (persisted envelope), and schedules steps: model steps become ordinary child `OrchTask`s via `TaskManager.submit(input, delegated)` + `TaskManager.approveDelegated()`; deterministic steps run through a Capability Bus (filesystem, shell-free terminal, git, isolated browser, Windows UI Automation, notifications, gh read-only, unconfigured communication contracts) or a versioned Skill Library. Bunny verifies results itself. Details: `docs/MA0_ARCHITECTURE.md`.

## Invariants claimed preserved — please try to break these

1. **MissionManager never calls a provider adapter.** Check imports of `src/lib/bunny-missions/manager.server.ts`; grep for `launch(` / `adapters`.
2. **`TaskManager.approve(id)` unchanged in behaviour.** It now calls a private `launch()`; compare with `ea0e803` line by line (`manager.server.ts`). Event `approval.accepted` and its detail text are unchanged; direct task records get no new fields.
3. **No child launches without a person's approval.** Children launch only via `approveDelegated`, which requires the child's own `mission` link and re-runs an envelope check; envelopes exist only after `mission.approve`.
4. **Delegation is audited as delegation** (`approval.delegated`, `task.approval.kind = "mission"`).
5. **Every capability call passes `decide()`** (`authorization.server.ts`), including skill steps and verification commands.
6. **No fabricated success** for unavailable/unconfigured/unsupported capabilities, providers, progress or verification.
7. **Bounded retries/replans/steps/concurrency**; user stop never retried.
8. **Stop isolation**: mission stop stops only tasks whose `task.mission.missionId` matches.
9. **Paths** stay within approved roots after symlink/junction resolution (`paths.server.ts`).
10. **Browser** cannot reach loopback/private hosts, including redirects and subresources.
11. **Host restart** never claims a resumed provider stream.
12. **Feature flag off** ⇒ direct mode functionally identical; default is off.

## DB migration summary

Schema `user_version` 2→3; `events.mission_id` (nullable) + index; 14 new tables via `CREATE TABLE IF NOT EXISTS`; `migrations` key `ma0.missions.v1`. Live proof: `test-results/ma0/live-snapshot-migration.json` (SHA-256 of all pre-existing rows identical after two opens of a `VACUUM INTO` snapshot of the live DB). Unit test: `missions.test.ts` "migration: a pre-M-A-0 database …".

## New APIs (Host `POST /command`)

`mission.create, mission.plan, mission.replan, mission.approve, mission.start, mission.stop, mission.retry, mission.respond, mission.get, mission.configure, inbox.ack, capability.run, capability.grant, capability.revoke_grant, capability.refresh, skill.run, skill.versions, skill.repair, skill.verify, skill.record, trigger.create, trigger.enable, trigger.disable, trigger.delete`. Remote devices: only `mission.create` (no explicit graphs), `mission.get`, `mission.approve`, `mission.start`, `mission.respond`, `mission.stop`, `inbox.ack` (`commands.server.ts`). `GET /state` adds optional `missions`.

## Mission state machine

`docs/MA0_MISSION_STATE_MACHINE.md`; source `machine.ts`.

## Capability model

`docs/MA0_CAPABILITY_MODEL.md`.

## Security decisions

`docs/MA0_SECURITY_MODEL.md`. Notable choices to scrutinize: missions default **off**; triggers created disabled and can only notify/draft; allow-once widens containment to the approved path's folder for that single request; reviewer independence is a preference (falls back to the same provider with a recorded note); direct workstation `capability.run` is allowed except external/destructive/sensitive actions without `confirmed`.

## Tests run (exact results)

| Command | Result |
|---|---|
| `npm test` | scripts 205/205; application+Host+missions 139/139 |
| `npm run test:ui` | 18/18 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | 0 errors, 10 warnings (all pre-existing) |
| `npm run build` | exit 0 |
| Baseline for comparison | 205 + 103 + 12 = 320; lint 0/10; build pass |

New tests: `src/lib/bunny-missions/missions.test.ts` (27), `src/lib/bunny-missions/capabilities.test.ts` (9; real filesystem, shell-free node processes, a real git repo with worktrees/merge/conflict, a real headless Chrome on an isolated profile against a local page, live Windows UI Automation window listing, an HTTP Host on port 43131 with pairing/revocation), `src/components/island/mission-model.test.ts` (6).

Live UI QA: isolated test Host (port 43140, separate data dir) + dev server bridged to it; deterministic and unapproved missions only; Allow-once from the Bar wrote the approved file; screenshots in `screenshots/ma0/` (desktop dark/light, Bar, Mission Control, agent detail, approval card, settings, 390×844 companion); 0 console errors; 0 px horizontal overflow.

## Known limitations / unresolved risks

* No live provider (Codex/Claude/Ollama) has executed a mission child; integration tested with fake adapters through the real TaskManager.
* Inside a provider session, file/command actions are governed by the provider CLI's sandbox, not by the Capability Bus.
* Browser SSRF guard has no DNS pinning (public name → private IP not blocked).
* Computer Runtime action paths (focus, invoke, type, capture, open app) not run on the real desktop.
* Planner is heuristic and deterministic; no model-assisted planning.
* An allow-once inside a multi-step skill covers every step of that same action in that run.
* The live installed Host (PID 14188) still runs pre-M-A-0 code; it was not restarted. The native WPF Island has no mission UI.
* GLM advisory review did not run (`cline` CLI missing, `spawn cline ENOENT`).
* `npm test` starts a real Host on port 43131 (and the existing test uses 43129); both ports must be free.

## Deviations from the specification

See `MA0_IMPLEMENTATION_REPORT.md` → "Deviations". Main ones: feature flag default off; scheduler/recovery live in `manager.server.ts`; GLM review not performed.

## Suggested review procedure

1. `git checkout 60d54e0 && npm test && npm run test:ui && npm run typecheck && npm run lint` — do not trust the table above.
2. Read `manager.server.ts` `approve/launch/approveDelegated` against `ea0e803`.
3. Read `bunny-missions/manager.server.ts` `launchModel`, `stepFailed`, `respond`, `recover`, `stop` for races (async `setImmediate` finalization vs. synchronous state changes) and invalid transitions.
4. Read `authorization.server.ts decide/scopeViolation/taskViolation` for bypasses (relative paths, prefixes, grants ordering).
5. Read `capabilities/process.server.ts` and `computer.server.ts` for shell/script injection.
6. Try to make a mission step run something outside its envelope without a `permission_required` event.
7. Check that nothing reports success it did not observe (`bus.server.ts finish()`, `skills.server.ts run()`, `verifyAndComplete`).

Final verdict claimed by the builder: **BUNNY_MA0_IMPLEMENTATION_COMPLETE** (with the NOT TESTED list in the report handed to M-A-1).
