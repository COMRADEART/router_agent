import { canonical, within } from "./paths.server.ts";
import type { MissionStore } from "./store.server.ts";

export type LockMode = "shared" | "exclusive";
export type LockResult = { ok: true; id: string } | { ok: false; conflict: { missionId: string; stepId: string; root: string; mode: LockMode } };

/**
 * Workspace coordination for mission agents. Readers share a folder; a writer holds it exclusively,
 * and nested folders conflict with their parents. Locks are persisted so a Host restart can release
 * the ones whose owners no longer run instead of trusting memory.
 */
export class WorkspaceCoordinator {
  store: MissionStore;
  constructor(store: MissionStore) { this.store = store; }
  acquire(missionId: string, stepId: string, root: string, mode: LockMode): LockResult {
    const path = canonical(root);
    for (const lock of this.store.locks()) {
      if (lock.stepId === stepId) continue;
      const overlaps = within(lock.root, path) || within(path, lock.root);
      if (overlaps && (mode === "exclusive" || lock.mode === "exclusive")) return { ok: false, conflict: { missionId: lock.missionId, stepId: lock.stepId, root: lock.root, mode: lock.mode } };
    }
    const existing = this.store.locks().find((lock) => lock.stepId === stepId && lock.root === path);
    if (existing) return { ok: true, id: existing.id };
    const id = crypto.randomUUID();
    this.store.addLock({ id, root: path, mode, missionId, stepId });
    return { ok: true, id };
  }
  release(stepId: string) { this.store.releaseLocks({ stepId }); }
  releaseMission(missionId: string) { this.store.releaseLocks({ missionId }); }
  held() { return this.store.locks(); }
}
