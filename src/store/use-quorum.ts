import { create } from "zustand";
import {
  DEFAULT_TAU,
  DEFAULT_WEIGHTS,
  PRESETS,
} from "@/lib/jev/catalog";
import { begin, isSavedRun, replay, respond, totalsOf } from "@/lib/jev/runner";
import type { PatternId, RunInput, SavedRun, Snapshot, Weights } from "@/lib/jev/types";

const first = PRESETS[0];
const STORAGE_KEY = "quorum.v1";

export type DeskView = "desk" | "patterns" | "algorithms" | "library";

type QuorumState = {
  view: DeskView;
  objective: string;
  pattern: PatternId;
  tau: number;
  weights: Weights;
  enabled: string[];
  snapshot: Snapshot | null;
  visible: number;
  playing: boolean;
  runs: SavedRun[];
  hydrated: boolean;
  issue: string | null;
  setView: (view: DeskView) => void;
  setObjective: (objective: string) => void;
  setPattern: (pattern: PatternId) => void;
  setTau: (tau: number) => void;
  setWeight: (key: keyof Weights, value: number) => void;
  toggleAgent: (id: string) => void;
  applyPreset: (id: string) => void;
  setVisible: (visible: number) => void;
  setPlaying: (playing: boolean) => void;
  launch: (override?: Partial<RunInput>) => void;
  step: () => void;
  reset: () => void;
  answer: (choice: "approve" | "refuse") => void;
  remember: (snapshot: Snapshot) => void;
  removeRun: (id: string) => void;
  openRun: (run: SavedRun) => void;
  importRuns: (value: unknown) => void;
  clearRuns: () => void;
  hydrate: (runs: SavedRun[]) => void;
};

function currentInput(state: QuorumState, override?: Partial<RunInput>): RunInput {
  return {
    objective: (override?.objective ?? state.objective).trim(),
    pattern: override?.pattern ?? state.pattern,
    tau: override?.tau ?? state.tau,
    weights: override?.weights ?? state.weights,
    enabled: override?.enabled ?? state.enabled,
  };
}

export const useQuorum = create<QuorumState>((set, get) => ({
  view: "desk",
  objective: first.objective,
  pattern: first.pattern,
  tau: DEFAULT_TAU,
  weights: { ...DEFAULT_WEIGHTS },
  enabled: [...first.enabled],
  snapshot: null,
  visible: 0,
  playing: false,
  runs: [],
  hydrated: false,
  issue: null,
  setView: (view) => set({ view }),
  setObjective: (objective) => set({ objective }),
  setPattern: (pattern) => set({ pattern }),
  setTau: (tau) => set({ tau }),
  setWeight: (key, value) => set({ weights: { ...get().weights, [key]: value } }),
  toggleAgent: (id) => {
    const enabled = get().enabled;
    set({
      enabled: enabled.includes(id) ? enabled.filter((item) => item !== id) : [...enabled, id],
    });
  },
  applyPreset: (id) => {
    const preset = PRESETS.find((item) => item.id === id);
    if (!preset) return;
    set({
      objective: preset.objective,
      pattern: preset.pattern,
      enabled: [...preset.enabled],
      issue: null,
    });
  },
  setVisible: (visible) => set({ visible }),
  setPlaying: (playing) => set({ playing }),
  launch: (override) => {
    const input = currentInput(get(), override);
    if (input.objective.length < 3) {
      set({ issue: "Write an objective first." });
      return;
    }
    const snapshot = begin(input);
    set({
      snapshot,
      visible: 1,
      playing: snapshot.steps.length > 1,
      view: "desk",
      issue: null,
      objective: input.objective,
      pattern: input.pattern,
      tau: input.tau,
      weights: input.weights,
      enabled: input.enabled,
    });
  },
  step: () => {
    const state = get();
    if (!state.snapshot) {
      const input = currentInput(state);
      if (input.objective.length < 3) {
        set({ issue: "Write an objective first." });
        return;
      }
      set({ snapshot: begin(input), visible: 1, playing: false, issue: null });
      return;
    }
    set({
      playing: false,
      visible: Math.min(state.snapshot.steps.length, state.visible + 1),
    });
  },
  reset: () => set({ snapshot: null, visible: 0, playing: false, issue: null }),
  answer: (choice) => {
    const snapshot = get().snapshot;
    if (!snapshot || snapshot.phase !== "hold") return;
    const next = respond(snapshot, choice);
    set({ snapshot: next, playing: true });
  },
  remember: (snapshot) => {
    if (get().runs.some((run) => run.id === snapshot.id)) return;
    const title = snapshot.input.objective.trim().replace(/\s+/g, " ").slice(0, 72);
    const saved: SavedRun = {
      id: snapshot.id,
      savedAt: Date.now(),
      title,
      pattern: snapshot.input.pattern,
      objective: snapshot.input.objective,
      summary: snapshot.summary,
      steps: snapshot.steps,
      artifacts: snapshot.artifacts,
      totals: totalsOf(snapshot.steps),
    };
    set({ runs: [saved, ...get().runs].slice(0, 24) });
  },
  removeRun: (id) => set({ runs: get().runs.filter((run) => run.id !== id) }),
  openRun: (run) =>
    set({
      view: "desk",
      objective: run.objective,
      pattern: run.pattern,
      snapshot: replay(run),
      visible: run.steps.length,
      playing: false,
      issue: null,
    }),
  importRuns: (value) => {
    const list = Array.isArray(value) ? value : [value];
    const clean = list.filter(isSavedRun);
    if (!clean.length) {
      set({ issue: "That file is not a Quorum run." });
      return;
    }
    const merged = [...clean, ...get().runs];
    const seen = new Set<string>();
    const runs = merged.filter((run) => {
      if (seen.has(run.id)) return false;
      seen.add(run.id);
      return true;
    });
    set({ runs: runs.slice(0, 24), issue: null, view: "library" });
  },
  clearRuns: () => set({ runs: [] }),
  hydrate: (runs) => set({ runs, hydrated: true }),
}));

export function loadStoredRuns(): SavedRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedRun).slice(0, 24);
  } catch {
    return [];
  }
}

export function persistRuns(runs: SavedRun[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}
