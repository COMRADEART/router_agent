import { PATTERNS, SAMPLES, WORKERS } from "@/lib/jev/catalog";
import { bidsFor, intentOf, retrieveRank, toolChoice } from "@/lib/jev/engine";
import type { Dist, PatternId } from "@/lib/jev/types";
import { useQuorum } from "@/store/use-quorum";
import { Button, DistBars, Panel } from "@/components/quorum/ui";

function preview(id: PatternId, sample: string): Dist[] {
  if (id === "retrieve") {
    return retrieveRank(sample)
      .slice(0, 4)
      .map((row) => ({ label: row.title, p: row.p }));
  }
  if (id === "contract" || id === "blackboard") {
    return bidsFor(sample, WORKERS.map((agent) => agent.id)).judgment?.dist.slice(0, 4) ?? [];
  }
  if (id === "reflex" || id === "guard") {
    return toolChoice(sample).dist.slice(0, 4);
  }
  return intentOf(sample).dist.slice(0, 4);
}

export function Patterns() {
  const launch = useQuorum((state) => state.launch);
  const enabled = useQuorum((state) => state.enabled);
  const tau = useQuorum((state) => state.tau);
  const weights = useQuorum((state) => state.weights);

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Eight ways to compose a desk" eyebrow="JEV patterns">
        <p className="max-w-3xl text-sm text-muted">
          A Jev-style layer only answers questions you wrote the options for. Choice picks a label, score picks a
          rubric level, noul returns a yes-probability. Workers prepare. Code decides what is allowed to happen.
        </p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {PATTERNS.map((pattern) => {
          const sample = SAMPLES[pattern.id];
          const dist = preview(pattern.id, sample);
          return (
            <Panel
              key={pattern.id}
              title={pattern.name}
              eyebrow={pattern.primitive}
              action={
                <Button
                  tone="plain"
                  className="min-h-8 px-0 text-[15px]"
                  onClick={() =>
                    launch({
                      pattern: pattern.id,
                      objective: sample,
                      enabled,
                      tau,
                      weights,
                    })
                  }
                >
                  Run
                </Button>
              }
            >
              <p className="text-sm text-fg">{pattern.line}</p>
              <p className="mt-2 text-sm text-muted">{pattern.algorithm}</p>
              <p className="mt-3 text-sm font-medium text-fg">Use when</p>
              <p className="text-sm text-muted">{pattern.when}</p>
              <div className="mt-4">
                <DistBars dist={dist} />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
