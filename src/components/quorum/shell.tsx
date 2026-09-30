import { useEffect } from "react";
import { Library, LineChart, PanelsTopLeft, Waypoints } from "lucide-react";
import { Desk } from "@/components/quorum/desk";
import { Patterns } from "@/components/quorum/patterns";
import { Algorithms } from "@/components/quorum/algorithms";
import { LibraryView } from "@/components/quorum/library";
import { cn } from "@/components/quorum/ui";
import { loadStoredRuns, persistRuns, useQuorum, type DeskView } from "@/store/use-quorum";

const NAV: { id: DeskView; label: string; hint: string; icon: typeof PanelsTopLeft }[] = [
  { id: "desk", label: "Desk", hint: "Run a mission on this device.", icon: PanelsTopLeft },
  { id: "patterns", label: "Patterns", hint: "Eight ways to compose the desk.", icon: Waypoints },
  { id: "algorithms", label: "Algorithms", hint: "Gates, bids, and the policy table.", icon: LineChart },
  { id: "library", label: "Library", hint: "Runs saved in this browser.", icon: Library },
];

function useSession() {
  const hydrated = useQuorum((state) => state.hydrated);
  const runs = useQuorum((state) => state.runs);
  const hydrate = useQuorum((state) => state.hydrate);
  const playing = useQuorum((state) => state.playing);
  const visible = useQuorum((state) => state.visible);
  const total = useQuorum((state) => state.snapshot?.steps.length ?? 0);
  const snapshot = useQuorum((state) => state.snapshot);
  const setVisible = useQuorum((state) => state.setVisible);
  const setPlaying = useQuorum((state) => state.setPlaying);
  const remember = useQuorum((state) => state.remember);

  useEffect(() => {
    hydrate(loadStoredRuns());
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    persistRuns(runs);
  }, [hydrated, runs]);

  useEffect(() => {
    if (!playing) return;
    if (visible >= total) {
      setPlaying(false);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(total);
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => setVisible(visible + 1), 340);
    return () => window.clearTimeout(id);
  }, [playing, visible, total, setPlaying, setVisible]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== "done") return;
    if (visible < snapshot.steps.length) return;
    remember(snapshot);
  }, [snapshot, visible, remember]);
}

export function QuorumApp() {
  useSession();
  const view = useQuorum((state) => state.view);
  const setView = useQuorum((state) => state.setView);
  const issue = useQuorum((state) => state.issue);
  const current = NAV.find((item) => item.id === view) ?? NAV[0];

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 overflow-y-auto px-3 py-8 lg:flex">
        <div className="px-3">
          <p className="text-xs text-muted">On this device</p>
          <p className="text-2xl font-semibold tracking-tight text-fg">Quorum</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  "tap flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium",
                  active ? "bg-brass text-white" : "text-fg",
                )}
              >
                <Icon className={cn("size-4", active ? "text-white" : "text-muted")} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <p className="px-3 text-xs text-muted">The judge, the policy, and the run stay in this browser.</p>
      </aside>
      <div className="min-w-0 pb-28 lg:pb-10">
        <header className="px-4 pt-8 lg:px-8 lg:pt-10">
          <h1 className="text-[34px] leading-none font-bold tracking-tight text-fg">{current.label}</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">{current.hint}</p>
        </header>
        {issue ? (
          <p className="px-4 pt-4 text-sm text-brass lg:px-8" role="status">
            {issue}
          </p>
        ) : null}
        <main className="px-4 py-6 lg:px-8">
          {view === "desk" ? <Desk /> : null}
          {view === "patterns" ? <Patterns /> : null}
          {view === "algorithms" ? <Algorithms /> : null}
          {view === "library" ? <LibraryView /> : null}
        </main>
        <footer className="px-4 pb-4 text-sm text-muted lg:px-8">
          Closed questions, probabilities, and code-owned effects. Nothing is sent. Export a run to open the same trace
          on Windows or Android.
        </footer>
      </div>
      <nav
        className="tab-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/80 backdrop-blur lg:hidden"
        aria-label="Sections"
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.id)}
                className={cn(
                  "tap flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                  active ? "text-brass" : "text-muted",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
