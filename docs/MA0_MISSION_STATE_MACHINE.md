# Bunny-A M-A-0 — Mission and step state machines

Source: `src/lib/bunny-missions/machine.ts`. Every state change goes through `assertMissionTransition` / `assertStepTransition`; an impossible transition throws instead of succeeding.

## Mission

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> planning
  planning --> waiting_for_approval : plan valid
  planning --> failed : invalid_plan
  waiting_for_approval --> ready : approve (envelope persisted)
  waiting_for_approval --> planning : replan
  ready --> running : start
  running --> waiting_for_user : permission / budget / host restart
  running --> verifying : all steps done
  running --> failed : unrecoverable step failure
  waiting_for_user --> running : request answered / retry
  waiting_for_user --> planning : replan
  waiting_for_user --> failed
  verifying --> completed
  verifying --> running
  verifying --> failed
  failed --> ready : retry (authorization still valid)
  failed --> planning : replan
  draft --> stopped
  planning --> stopped
  waiting_for_approval --> stopped
  ready --> stopped
  running --> stopped
  waiting_for_user --> stopped
  verifying --> stopped
  failed --> stopped
  completed --> [*]
  stopped --> [*]
```

`completed` and `stopped` are terminal. Recovery after a Host restart moves `running/verifying/ready` missions with interrupted steps to `waiting_for_user` (via `running`), fails missions caught in `planning`, and resumes scheduling for running missions that had no executing step.

## Step

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> ready : all dependencies completed/skipped
  pending --> blocked : a dependency failed
  pending --> skipped
  ready --> running
  ready --> waiting_for_approval : outside envelope / child needs approval
  ready --> blocked
  waiting_for_approval --> ready : allow once
  waiting_for_approval --> running : child approved directly
  waiting_for_approval --> failed : deny
  running --> verifying : criteria present
  running --> completed
  running --> failed
  running --> waiting_for_approval : verification command needs permission
  verifying --> completed
  verifying --> failed
  failed --> ready : bounded retry / explicit retry
  blocked --> pending : dependency retried
  pending --> stopped
  ready --> stopped
  waiting_for_approval --> stopped
  running --> stopped
  verifying --> stopped
  blocked --> stopped
```

## Scheduling (`MissionManager.tickOnce`)

1. Only `running` missions schedule; the runtime limit (min of envelope budget and `maxMissionRuntimeMs`) is checked first.
2. `pending` steps whose dependencies are all `completed`/`skipped` become `ready` (`mission.step.ready`).
3. `ready` steps launch in plan order while running+verifying < `maxConcurrentAgents` (default 3). Independent steps therefore run in parallel.
4. A step acquires a workspace lock first (write → exclusive, read → shared; nested folders conflict). A busy workspace keeps the step `ready` and records `mission.step.waiting_workspace` once; the 15 s watchdog retries.
5. Evaluation: all steps done → `verifying` → `completed`; nothing running/ready and a step waits for permission → `waiting_for_user`; otherwise → `failed` with the first failed step's category.

## Failure categories and retry policy

| Category | Policy |
|---|---|
| `user_stopped` | never retried |
| `permission_required` | wait for user |
| `permission_denied` | not retried; dependents blocked |
| `budget_exceeded` | wait for user |
| `dependency_failed` | step blocked |
| `invalid_plan` | replan |
| `host_restart` | wait for user; explicit retry starts a **fresh** child task |
| `workspace_conflict` | bounded retry, then wait for user |
| `provider_rate_limited`, `provider_unavailable` | bounded retry, rerouted away from the failed provider **only if another eligible provider exists** |
| `verification_failed` | bounded repair attempt (the failure text is put in the next prompt), then wait for user |
| `timeout`, `provider_failed`, `capability_failed` | bounded retry (`provider_failed` reroutes when possible) |
| `capability_unavailable` | not retried |

Bounds: per step `maxRetries` (default 2 → at most 3 attempts), per mission `budget.maxRetries`, explicit user retries capped at `2 × maxRetries + 1` attempts per step, replans capped by `maxReplans` (2). Every attempt is stored (`step.attempts`).

## Progress

`missionProgress(steps)` returns `{kind: "steps", completed, total, failed, running}`; `weighted` only when every step has an explicit positive weight. Time never contributes. An agent's own progress is shown as determinate only when its provider published a finite plan (`finitePlan`), otherwise "Indeterminate — no published plan".

## Events (journal types)

`mission.created, mission.planning, mission.planned, mission.approval_required, authorization.granted, authorization.denied, authorization.required, mission.started, mission.step.ready, mission.step.started, mission.step.child_created, mission.step.workspace, mission.step.waiting_workspace, mission.step.workspace_warning, mission.step.verifying, mission.step.completed, mission.step.failed, mission.step.retrying, mission.step.blocked, mission.permission_required, mission.waiting_for_user, mission.resumed, mission.verifying, mission.completed, mission.failed, mission.stopped, mission.retry, mission.replanning, mission.recovered, mission.configured, mission.error, capability.requested, capability.started, capability.completed, capability.failed, capability.grant_changed, skill.executed, skill.failed, skill.candidate, skill.promoted, notification.sent, trigger.created, trigger.enabled, trigger.disabled, trigger.deleted, trigger.fired, trigger.suppressed, trigger.failed`. Child tasks keep their existing `task.*`, `agent.*`, `approval.*` events, now tagged with `missionId`.
