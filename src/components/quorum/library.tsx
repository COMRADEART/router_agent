import { useRef, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { patternById } from "@/lib/jev/catalog";
import { fmt } from "@/lib/jev/engine";
import type { SavedRun } from "@/lib/jev/types";
import { useQuorum } from "@/store/use-quorum";
import { Button, Panel } from "@/components/quorum/ui";

function download(run: SavedRun) {
  const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quorum-${run.id.slice(0, 8)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function LibraryView() {
  const runs = useQuorum((state) => state.runs);
  const openRun = useQuorum((state) => state.openRun);
  const removeRun = useQuorum((state) => state.removeRun);
  const importRuns = useQuorum((state) => state.importRuns);
  const clearRuns = useQuorum((state) => state.clearRuns);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <Panel
        title="Runs on this device"
        action={
          <div className="flex gap-2">
            <Button tone="plain" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <Button
              tone="plain"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                clearRuns();
                setConfirming(false);
              }}
            >
              {confirming ? "Confirm clear" : "Clear"}
            </Button>
          </div>
        }
      >
        <p className="max-w-3xl text-sm text-muted">
          Finished runs stay in this browser. There is no account. Export a file on a Windows laptop and import it on
          an Android phone — or the other way — to keep the same trace.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import a Quorum run"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const parsed: unknown = JSON.parse(await file.text());
              importRuns(parsed);
            } catch {
              importRuns(null);
            }
          }}
        />
      </Panel>
      {runs.length === 0 ? (
        <Panel title="Nothing saved yet" eyebrow="Library">
          <p className="text-sm text-muted">Run a mission on the desk. When it finishes, it lands here.</p>
        </Panel>
      ) : (
        <ul className="group-card">
          {runs.map((run) => (
            <li key={run.id} className="border-b px-4 py-3 hairline last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-brass">{patternById(run.pattern).name}</p>
                  <h2 className="text-[17px] font-semibold text-fg">{run.title}</h2>
                  <p className="mt-0.5 text-[15px] text-muted">{run.summary}</p>
                  <p className="mt-1 text-[13px] text-muted tabular-nums">
                    {run.totals.questions} questions · {fmt(run.totals.cost)} units · {run.totals.latencyMs} ms modeled
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button tone="plain" onClick={() => openRun(run)}>
                    Open
                  </Button>
                  <Button tone="plain" onClick={() => download(run)} aria-label="Export run">
                    <Download className="size-4" aria-hidden="true" />
                  </Button>
                  <Button tone="plain" onClick={() => removeRun(run.id)} aria-label="Remove run">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
