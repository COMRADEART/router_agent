# Bunny-A M-A-0 — Security model

## Principles

1. One scoped approval per mission, never silent execution. A mission plans first and stops at `waiting_for_approval` showing its requested scope.
2. Mission-delegated approval is recorded as such (`approval.delegated`, `task.approval.kind = "mission"`), never as a user click.
3. Anything outside the envelope stops and asks (`permission_required` → Allow once / Deny).
4. External side effects and destructive actions always ask, even inside the envelope.
5. Unavailable, unconfigured or unsupported capabilities report exactly that; nothing is simulated.

## Authorization envelope (`mission_authorizations`)

Derived by `scopeFor()` from the planned steps (including the concrete steps inside skills) and persisted on approval:

| Field | Meaning |
|---|---|
| `projectRoots` | Mission root (+ the mission's worktree folder when a step uses `isolation: "worktree"`). |
| `riskClasses` | Subset of `READ, WRITE, EXECUTE, EXTERNAL_SIDE_EFFECT, DESTRUCTIVE` the plan needs. |
| `capabilities` | Action ids/prefixes the plan uses. |
| `providers` | `execution` (model steps present), optional allowlist, `localOnly`. |
| `filesystem.read/write` | Roots; `write` is empty unless a step writes. |
| `terminal` | Enabled + exact command names (`npm`, `node`, …). |
| `git.actions` | `status, diff, log, commit, worktree, merge` as planned. |
| `browser` / `network` / `computer` | Enabled only when planned. |
| `budget` | Max external model calls (Fast 2, Balanced 6, Deep 12), max runtime (30/60/120 min), max retries, optional token ceiling. |
| `alwaysAsk` | `EXTERNAL_SIDE_EFFECT`, `DESTRUCTIVE`. |
| `expiresAt` / `revokedAt` | Expired → ask; revoked (replan) → deny. |

## The decision function (`authorization.server.ts: decide`)

Order of evaluation:

1. Contract-only action (`implemented: false`) → **deny**.
2. Persistent grant `never_allow` → **deny**; `read_only` and the action is not READ → **deny**. (Most restrictive applicable grant wins; mission-scoped and global grants both apply.)
3. The user allowed this exact pending request once → **allow** (only that action for that step; for a path outside the roots, the containment root is widened to that path's folder for that one request).
4. Direct workstation invocation (`capability.run`, `skill.run`) → **allow**, except hard-approval, EXTERNAL_SIDE_EFFECT, DESTRUCTIVE and privacy-sensitive actions, which need `confirmed: true`.
5. No envelope → **ask**. Revoked → **deny**. Expired → **ask**.
6. `hardApproval` actions (calls, sending messages, PR creation, calendar changes) → **ask**, regardless of grants.
7. Grant `ask_every_time` → **ask**.
8. Action not in envelope capabilities / risk class not approved / parameter outside scope (path, command, cwd, git action, domain, browser/network/computer flags) → **ask** with the precise reason. Relative paths are judged against the step's working folder.
9. Risk in `alwaysAsk` → **ask**, unless a persistent `always_allow`/`allow_for_mission` grant covers it and the risk is not DESTRUCTIVE.
10. Privacy-sensitive (screen capture, UI control-tree read) without such a grant → **ask**.
11. Otherwise **allow**.

Grant policies stored in `capability_grants`: `always_allow, allow_for_mission, ask_every_time, read_only, never_allow` (workstation-only `capability.grant`; a blanket `*` allow is refused). M-A-0 has no UI for grants; the data model and enforcement exist.

Parameter-dependent escalation: `terminal.exec` of `git reset/clean/push/rebase/checkout/restore/branch/…`, `rm/del/format/reg/…` is DESTRUCTIVE; `npm publish/login/install/ci/…` is EXTERNAL_SIDE_EFFECT.

## Child model tasks

`taskViolation()` re-checks every child at delegated launch: envelope not revoked/expired, provider execution approved, provider allowlist, local-only, external-call budget, working folder inside the roots. A violation leaves the child at `waiting_for_approval` and raises a `provider.execute` request; the user may approve the child directly (recorded as a normal user approval) or deny.

**Limit:** inside a launched Codex/Claude session, file and command actions are performed by the provider CLI under its own sandbox/permission mode (as in the direct path). The Capability Bus does not intercept them. The envelope governs which provider runs where; it is not an OS sandbox.

## Remote devices

Unchanged authentication (paired, hashed, revocable device token). Mission actions a device may call: `mission.create` (no explicit graphs), `mission.get`, `mission.approve`, `mission.start`, `mission.respond`, `mission.stop`, `inbox.ack`. Workstation-only: `mission.configure`, `mission.retry`, `mission.replan/plan`, all `capability.*`, `skill.*`, `trigger.*`. Tested in `capabilities.test.ts`.

## Browser Runtime isolation

* Separate persistent profile at `<data>/browser-profile`; the user's Chrome/Edge profiles, cookies and credentials are never opened. When no Playwright Chromium is installed it launches the installed Chrome or Edge **binary** with that separate profile.
* Only `http(s)` URLs; embedded credentials refused; loopback, RFC1918, link-local (incl. 169.254.169.254), CGNAT, `.local/.internal/.localhost` hosts refused for the initial URL, the final URL after redirects, and every subresource (request routing). The Host API at 127.0.0.1:43119 is therefore unreachable.
* **Limit:** a public hostname that DNS-resolves to a private address is not blocked (no DNS pinning).
* Typed text and file bodies are recorded only as character counts.

## Computer Runtime limits

Window list (READ), control tree (READ, privacy-sensitive), focus, invoke/toggle/select/expand, set value through `ValuePattern`, screen capture (privacy-sensitive), open allowlisted apps (`notepad, calculator, paint, explorer, terminal`) optionally on a non-executable file inside the roots. No raw mouse coordinates and no synthetic keystrokes are offered. All non-READ actions are EXECUTE and need an envelope that enables computer control.

## Secrets

* `redact()` replaces values of keys matching token/secret/password/api key/cookie/authorization/credential in every capability run record; `text`/`content` parameters are stored as lengths.
* The gh token stays in gh's own store; health keeps only the verdict.
* No connector stores or requests credentials in M-A-0.

## Triggers

Created disabled; fire only if globally enabled **and** individually enabled; minimum interval 60 s, ≤12/hour; journaled (`trigger.fired`, `trigger.suppressed`). Actions cannot execute work: Inbox notification or a mission draft that waits for approval.

## Known security limitations (for M-A-1)

* DNS-rebinding style SSRF via public hostnames resolving to private IPs.
* Skills with several steps of the same action: an allow-once covers each instance of that action in that skill run.
* Provider CLI actions inside a session are outside the Capability Bus (see above).
* Trigger `contains` matching is plain substring matching on event detail text.
