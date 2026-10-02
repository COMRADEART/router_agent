import type { MissionStore } from "./store.server.ts";
import type { MemoryEntry, MemoryKind } from "./types.ts";

const PER_MISSION = 300;
/** Kinds that may be marked verified, and the provenance that may verify them. */
const VERIFIABLE: Record<MemoryKind, RegExp | null> = {
  mission_state: /^bunny:/,
  verified_fact: /^bunny:(capability|verification):/,
  agent_conclusion: null,
  artifact: /^bunny:/,
  user_decision: /^user:/,
  skill_knowledge: /^bunny:skill:/,
};

/**
 * Bounded, Host-owned mission working memory. Provider conclusions are always stored unverified;
 * only Bunny's own deterministic checks (or the user's explicit decisions) produce verified entries.
 */
export class MissionMemory {
  store: MissionStore;
  constructor(store: MissionStore) { this.store = store; }
  record(missionId: string | null, kind: MemoryKind, key: string, value: string, provenance: string, verified = false): MemoryEntry {
    const allowed = VERIFIABLE[kind];
    const entry: MemoryEntry = { id: crypto.randomUUID(), missionId, kind, key: key.slice(0, 200), value: value.slice(0, 4000), provenance, verified: verified && !!allowed && allowed.test(provenance), createdAt: Date.now() };
    this.store.saveMemory(entry);
    if (missionId) this.store.trimMemory(missionId, PER_MISSION);
    return entry;
  }
  entries(missionId: string, filter: { kind?: MemoryKind; verified?: boolean } = {}) { return this.store.memory(missionId, filter); }
  /** What an agent may see: verified facts and user decisions only, newest last, bounded. */
  context(missionId: string, max = 12): string[] {
    const facts = this.store.memory(missionId, { verified: true }).filter((entry) => entry.kind === "verified_fact" || entry.kind === "user_decision");
    return facts.slice(-max).map((entry) => `${entry.key}: ${entry.value.slice(0, 300)} (${entry.kind === "user_decision" ? "user decision" : "verified by Bunny"})`);
  }
  skillKnowledge(): MemoryEntry[] { return this.store.memory(null, { kind: "skill_knowledge" }); }
}
