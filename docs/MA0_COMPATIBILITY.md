# Bunny-A M-A-0 — Compatibility

## Compatibility boundary

| Contract | Status after M-A-0 | Evidence |
|---|---|---|
| Direct task path `submit → routing → waiting_for_approval → approve → launch → verify → persist` | Unchanged. `approve(id)` delegates to a shared private `launch()` with the original event (`approval.accepted`) and detail text. | `host.test.ts` (unchanged, passing); `missions.test.ts` "feature flag off …" asserts the exact direct event sequence; "model steps flow …" asserts a direct task gets `approval.accepted` and no `approval`/`mission` fields. |
| Direct task record shape | Unchanged for direct tasks. Optional `mission` and `approval` fields are written only on mission children. | `missions.test.ts` asserts `approval === undefined` and `mission === undefined` on a direct task. |
| Provider eligibility / BunnyRouter / learning policy | Not modified. Mission children are routed by the same `bunnyRoute()` with ordinary `TaskConstraints`. | `router.ts`, `learning.server.ts` untouched (`git diff ea0e803 -- src/lib/bunny-host/router.ts src/lib/bunny-host/learning.server.ts` is empty). |
| Approval-before-launch | Preserved. Children launch only through `approveDelegated`, which requires a persisted envelope approved by a person and re-checks it at launch. | "nothing launches before mission approval" assertion. |
| Stop ownership / isolation | Reused unchanged: mission stop calls `TaskManager.stop()` only for tasks whose `task.mission.missionId` matches. | "mission stop cancels only its own children …" (unrelated direct task keeps running). |
| Project-root validation | Unchanged for direct tasks. Delegated working folders must be an approved project root, the default root, or inside `<data>/worktrees`. | `manager.server.ts submit()`. |
| Host authentication / pairing / revocation | Unchanged. Mission commands go through the same bearer/device check; revoked devices get 401. | capabilities.test.ts "Host HTTP …" (pair, use, revoke → 401). |
| Provider usage provenance, verification semantics | Unchanged. | Adapters, registry, verification untouched. |
| HostSnapshot | Superset. New optional `missions` field; every previous key still present. | "Host HTTP …" test checks all previous keys. |
| Host command contract | All previous actions behave as before; new actions are dispatched before the original `switch` only when the action name is a mission action. | `http.server.ts`. |
| HostEvent | Gains optional `missionId` (null for every pre-existing and direct-task event). | migration test, live snapshot check. |
| UI consumption of old records | The store ignores a missing `missions` field (`missions: null`), so the UI also works against an older Host. Notifications skip `approval.required`/`task.*` events that belong to a mission. | `use-island.ts`. |

## Database migration

* `HostDatabase` sets `PRAGMA user_version=3` and adds `events.mission_id TEXT` (nullable) plus index `events_mission` only if missing. Existing rows are not rewritten.
* `MissionStore` creates 14 new tables with `CREATE TABLE IF NOT EXISTS` and records `ma0.missions.v1` in `migrations` with `INSERT OR IGNORE`.
* Opening an M-A-0 database with the previous Host code: the old code resets `user_version` to 2 and ignores the extra column/tables (inserts name their columns). Not exercised with the released v10/v13 binaries.

Live-data proof: a read-only `VACUUM INTO` snapshot of the running Host's database (51 tasks, 13 projects, 1,835 events, 36 outcomes, 9 devices) was migrated twice. SHA-256 over every row of `tasks, projects, outcomes, devices, policies, providers` and `events(sequence,at,type,task_id,detail)` was identical before and after; all 1,835 events read back with `missionId: null`. Evidence: `test-results/ma0/live-snapshot-migration.json`. Unit test: "migration: a pre-M-A-0 database keeps every row …".

## Feature flag

Central in `MissionStore.config()`: `settings.missions_config` (default `enabled: false`), overridden by `BUNNY_MISSIONS=1|0`. When disabled:

* tables exist (additive), nothing schedules, no inbox writes, no trigger timer, no capability health probes;
* every mission action except `mission.configure`/read paths fails with "Missions are disabled …";
* `snapshot.missions = { enabled: false, missions: [], … }`; the UI hides the Task/Mission switch and mission sections;
* direct tasks run exactly as before (asserted).

## The running installation

The installed Host (PID 14188, instance `5b8d70f2-…`) runs from this checkout and still executes the pre-M-A-0 code already loaded in memory. It was not restarted. On its next restart it will load M-A-0, migrate to schema v3 as described, and keep missions disabled until enabled in Settings → Missions or with `BUNNY_MISSIONS=1`. The native WPF Island (`install/Bunny-Island.ps1`) was not changed and does not display missions.
