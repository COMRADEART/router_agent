# Bunny-A M-A-0 — Compatibility

## Compatibility boundary

| Contract | Status after M-A-0 | Evidence |
|---|---|---|
| Direct task path `submit → routing → waiting_for_approval → approve → launch → verify → persist` | Unchanged. `approve(id)` delegates to a shared private `launch()` with the original event (`approval.accepted`) and detail text. | `host.test.ts` (unchanged, passing); `missions.test.ts` "feature flag off …" asserts the exact direct event sequence; "model steps flow …" asserts a direct task gets `approval.accepted` and no `approval`/`mission` fields. |
| Direct task record shape | Unscoped legacy direct tasks keep the previous shape/defaults. Optional `executionScope` is persisted only when explicitly supplied by trusted in-process input or required for a mission child. | `missions.test.ts` direct/feature-flag tests and `execution-scope.test.ts` legacy argv stand-ins. |
| Provider eligibility / BunnyRouter / learning policy | Not modified. Mission children are routed by the same `bunnyRoute()` with ordinary `TaskConstraints`. | `router.ts`, `learning.server.ts` untouched (`git diff ea0e803 -- src/lib/bunny-host/router.ts src/lib/bunny-host/learning.server.ts` is empty). |
| Approval-before-launch | Preserved. Children launch only through `approveDelegated`, which requires a persisted envelope approved by a person and re-checks it at launch. | "nothing launches before mission approval" assertion. |
| Stop ownership / isolation | Reused unchanged: mission stop calls `TaskManager.stop()` only for tasks whose `task.mission.missionId` matches. | "mission stop cancels only its own children …" (unrelated direct task keeps running). |
| Project-root validation | Legacy TaskManager validation remains. Direct capability/skill cwd additionally requires a plain absolute existing directory inside approved roots after canonical resolution. Delegated task folders retain approved project/default/worktree checks. | `manager.server.ts submit()`, `commands.server.ts direct()`, malformed/outside/junction cwd negative tests. |
| Host authentication / pairing / revocation | Unchanged. Mission commands go through the same bearer/device check; revoked devices get 401. | capabilities.test.ts "Host HTTP …" (pair, use, revoke → 401). |
| Provider detection, usage provenance, verification semantics | Unchanged. Adapter launch configuration additionally enforces an explicit mission access scope. | Registry/verification unchanged; adapter argv stand-ins and all original Host tests pass. |
| HostSnapshot | Superset. New optional `missions` field; every previous key still present. | "Host HTTP …" test checks all previous keys. |
| Host command contract | All previous actions behave as before; new actions are dispatched before the original `switch` only when the action name is a mission action. | `http.server.ts`. |
| HostEvent | Gains optional `missionId` (null for every pre-existing and direct-task event). | migration test, live snapshot check. |
| UI consumption of old records | The store ignores a missing `missions` field (`missions: null`), so the UI also works against an older Host. Notifications skip `approval.required`/`task.*` events that belong to a mission. | `use-island.ts`. |

## Database migration

* `HostDatabase` sets `PRAGMA user_version=3` and adds `events.mission_id TEXT` (nullable) plus index `events_mission` only if missing. Existing rows are not rewritten.
* `MissionStore` creates 14 new tables with `CREATE TABLE IF NOT EXISTS` and records `ma0.missions.v1` in `migrations` with `INSERT OR IGNORE`.
* Opening an M-A-0 database with the previous Host code: the old code resets `user_version` to 2 and ignores the extra column/tables (inserts name their columns). Not exercised with the released v10/v13 binaries.

Live-data proof: a read-only `VACUUM INTO` snapshot of the running Host's database (51 tasks, 13 projects, 1,835 events, 36 outcomes, 9 devices) was migrated twice. SHA-256 over every row of `tasks, projects, outcomes, devices, policies, providers` and `events(sequence,at,type,task_id,detail)` was identical before and after; all 1,835 events read back with `missionId: null`. Evidence: `test-results/ma0/live-snapshot-migration.json`. Unit test: "migration: a pre-M-A-0 database keeps every row …".

M-A-0R changes only optional JSON execution/envelope/run fields; no new SQL migration or legacy row rewrite is required. The current Host snapshot (51 tasks, 13 projects, 1,836 events, 36 outcomes, 9 devices) and pre-M2 backup (13 tasks, 1 project, 890 events, 5 outcomes, 4 devices) were each opened twice with the new code. All original column values/JSON bytes/counts remained identical, excluding the additive migration-key insertion. The actual `ea0e803` persistence implementation then read both migrated copies and preserved their rows. Source main/WAL SHA-256 values stayed identical throughout; only read-only source connections and disposable copies were used. Evidence: `test-results/ma0r/migration-evidence.json` and `migration-check.mjs`.

Old mission JSON lacking `providers.sessions` and old tasks lacking `executionScope` remain byte-identical. An old mission cannot silently acquire provider authority: replan and explicit approval are required before a model child can launch. Unscoped direct tasks still work. The new "MA0R migration: old mission JSON …" test verifies reopening twice and fail-closed authority; the original populated-v2 migration test still runs.

## Feature flag

Central in `MissionStore.config()`: `settings.missions_config` (default `enabled: false`), overridden by `BUNNY_MISSIONS=1|0`. When disabled:

* tables exist (additive), nothing schedules, no inbox writes, no trigger timer, no capability health probes;
* every mission action except `mission.configure`/read paths fails with "Missions are disabled …";
* `snapshot.missions = { enabled: false, missions: [], … }`; the UI hides the Task/Mission switch and mission sections;
* direct tasks run exactly as before (asserted).

## The running installation

The installed Host (PID 14188, instance `5b8d70f2-…`) runs from this checkout and still executes the pre-M-A-0 code already loaded in memory. It was not restarted. On its next restart it will load M-A-0, migrate to schema v3 as described, and keep missions disabled until enabled in Settings → Missions or with `BUNNY_MISSIONS=1`. The native WPF Island (`install/Bunny-Island.ps1`) was not changed and does not display missions.
