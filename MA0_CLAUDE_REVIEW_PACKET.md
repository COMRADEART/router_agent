# Bunny-A M-A-0R — Narrow Claude rereview packet

Review **closure of Review 0 findings and regressions only**. Do not repeat the entire original architecture review or perform M-A-1 live-provider acceptance. Read the actual code/tests; [MA0_REMEDIATION_REPORT.md](MA0_REMEDIATION_REPORT.md) is the implementer's evidence, not an independent verdict.

## Identity and preserved history

| Item | Value |
|---|---|
| Repository / branch | `COMRADEART/router_agent` / `ma0-mission-architecture` |
| Original base | `ea0e803b8186ac777ba67f4c47db58ccd6b4407d` |
| Review 0 baseline | `33723ee0d3992203bc4951cee76d32ff6df3935a` |
| Original four commits | `32ce245`, `dbab79e`, `60d54e0`, `33723ee` — preserved |
| Original independent verdict | **BUNNY_MA0_REVIEW_PASS_WITH_REMEDIATION**: 0 BLOCKER, 1 HIGH, 3 MEDIUM, 3 LOW |
| Authority / Git / low fixes | `02d6a7efe2423d3cca6ab6c466f509e22da2aedd` |
| Browser isolation fix / final code | `b97502638a1304a004376a06170d33f520196327` |
| Documentation | The following commit containing this packet; inspect `git log -3` |
| Push / merge / history rewrite | None |

Review diff: `git diff 33723ee b975026`. The local supplied `MA0_CLAUDE_REVIEW_0.md` remains untracked and unchanged. No production code came from the review report.

## REVIEW 0 REMEDIATION MAP

All paths below are repository-relative; braces denote the named files, not extra directories. The report includes exact changes, tests, gate logs and residual limitations for each ID.

| Finding / claimed closure | Commit | Files to inspect | Tests / assertions to challenge |
|---|---|---|---|
| **H1 FIXED** | `02d6a7e` | `src/lib/orch/types.ts`; `bunny-host/{contracts,manager.server,adapters.server}.ts`; `bunny-missions/{types,authorization.server,manager.server}.ts` under `src/lib/` | `bunny-host/execution-scope.test.ts`: actual Codex/Claude launch with legacy/read/write argv stand-ins. `missions.test.ts`: explicit access independent of role, mutation refusal, retry/reroute, replan approval and child ≤ step ≤ envelope. |
| **M1 MITIGATED** | `02d6a7e` | Scope files above; `src/lib/bunny-host/http.server.ts`; `src/components/island/{mission-model.ts,mission.tsx}` | `missions.test.ts` phone serialization/bounded sessions; `capabilities.test.ts` real paired HTTP approve without starting, forged overrides ignored, actor events; UI authority and skill label tests. |
| **M2 FIXED** | `b975026` | `src/lib/bunny-missions/capabilities/{browser.server,browser-network.server}.ts` | `browser-network.test.ts`: all DNS answers and literal pinning, HTTP/CONNECT rebinding refusal, real isolated browser redirects/subresources/local IPv6/private DNS → **zero requests to a real disposable Host**. |
| **M3 FIXED** | `02d6a7e` | `src/lib/bunny-missions/capabilities/{git-merge.server,local.server,bus.server}.ts`; mission manager/types | `git-merge.test.ts`: real repository success/conflict/native Git Stop/process failure/cancellation, user-created merge untouched, cleanup failure reported, no retry after Stop. |
| **L1 FIXED** | `02d6a7e` | Mission authorization/types; capability Bus/process/local files | `capabilities.test.ts`: rogue same-basename executable and changed PATH cannot inherit pinned trust; explicit new-path approval works. Check there is no second PATH lookup after the decision. |
| **L2 FIXED (solution A)** | `02d6a7e` | Mission UI/model; mission authorization/manager/types; Bus wording | `missions.test.ts`: repeated matching skill actions, out-of-root refusal, allowance clearing. UI says **Allow this skill run**; standalone says Allow once. |
| **L3 FIXED** | `02d6a7e` | `src/lib/bunny-missions/commands.server.ts` | `missions.test.ts`: relative/missing/file/outside/control/UNC/ADS/junction cwd refusal and valid approved subfolder; no directory creation. |

## Focused review questions

1. Trace **user approval → envelope step/session authority → explicit step access → immutable child execution scope → existing adapter**. Confirm no role-based exception, silent read→write upgrade on retry/replan/additional consent, second router or MissionManager provider launch.
2. Check actual installed-CLI flags: Codex read-only sandbox; Claude read exposes only Read with explicit mutation/shell denial, restricted mode, no settings, safe mode/strict MCP and dontAsk. Write and unscoped direct argv remain compatible. Help was read; no live provider mission was launched.
3. Verify bounded session count, displayed roots/access/shell/external-effect disclosure and distinct direct/envelope/delegated/additional/remote audit records. Check paired HTTP serialization grants the same scope and ignores arbitrary caller fields.
4. Follow browser sockets, not just URL strings: all DNS answers checked, checked IP dialed, no destination re-resolution, redirect/subresource/CONNECT/WebSocket paths, no loopback bypass. Verify the real test Host receives no network request before authentication.
5. Challenge Git ownership and races: existing user operation refusal, marker/HEAD/target/sidecar proof, fresh cleanup signal, cancellation waiting, result persistence and no scheduling after Stop. Failed/unproven cleanup and commit-before-cancel must be honest; no reset or unrelated abort.
6. Confirm original direct event sequence/approval/verification/persistence, feature-off behavior, provider detection, Stop ownership, project registration, pairing/revocation, bridge, learning and usage stay intact. Old JSON is not rewritten to invent authority.

Untouched against `33723ee`: BunnyRouter, ProviderRegistry, learning policy, TaskManager process-tree module, verification, Host bridge, UI store and `install/`. Adapter changes are launch authority only; detection/usage/event parsing are unchanged.

## Reproduce gates without spending mission quota

Run on the current branch without resetting/cleaning the checkout:

```text
npm test
npm run test:ui
npm run typecheck
npm run lint
npm run build
```

Expected: **205 script + 166 app/Host/mission + 20 UI = 391**, 0 failures/skips; typecheck/build exit 0; lint 0 errors and the same 10 baseline warnings. No tests removed. Git Stop tests need permission to terminate their own disposable native processes; a restricted Windows shell can deny `taskkill` and invalidate that fixture run. Never use broad process termination.

Migration unit tests are in `missions.test.ts`: populated pre-M-A-0 schema additive/idempotent plus old mission JSON byte preservation and missing-authority refusal. Local `test-results/ma0r/migration-evidence.json` additionally proves unchanged rows after two opens of current Host/pre-M2 snapshots, unchanged source main/WAL hashes, and successful reads by the actual `ea0e803` persistence code. Do not migrate the production DB to reproduce this.

Local UI evidence: standard desktop/mobile dev/built smoke plus `approval-ui-evidence.json` and eight inspected fixture screenshots. All fixture RPC calls were intercepted; approval/respond clicks could not reach the live Host. Raw built-preview smoke uses the existing offline Host mode and reports less body text than connected dev; the changed mission UI itself passes with the same isolated data on both. No bridge weakening or branding removal was used.

## Residual boundaries to assess, not conceal

* **M1 remains MITIGATED:** provider-internal operations are governed by provider permissions, outside Capability Bus; write-session shell authority is explicit. Claude write mode is not an OS-level project-only jail. Separate per-operation external-effect approval inside a provider is not claimed.
* CLI/tool enforcement is trusted. Live provider read/write acceptance, actual phone/public tunnel and broad public browsing belong to M-A-1; no Codex/Claude/Ollama mission quota was used here.
* Executable path/prefix pinning does not detect replacement at the same path or library changes.
* Unproven merge ownership/failed cleanup/early index lock/hard crash may require manual attention; committed merges remain. The returned and persisted cleanup evidence must say so.
* Browser connection isolation is not an OS sandbox against a compromised browser/native workstation actor. Resolver/socket and loopback exceptions are in-process fixture seams, absent from HTTP inputs.

Builder claim: **BUNNY_MA0_REMEDIATION_COMPLETE**. Please return a finding-closure/regression verdict, identifying any remaining H1/M1/M2/M3/L1/L2/L3 defect with code/test evidence. Do not infer live-provider acceptance from stand-ins.
