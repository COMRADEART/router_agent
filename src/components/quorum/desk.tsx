import { Check } from "lucide-react";
import { PATTERNS, POLICY, PRESETS, WORKERS, patternById } from "@/lib/jev/catalog";
import { agentName, fmt, pct } from "@/lib/jev/engine";
import { totalsOf } from "@/lib/jev/runner";
import type { Pending, Weights } from "@/lib/jev/types";
import { useQuorum } from "@/store/use-quorum";
import { Button, DistBars, FieldLabel, Panel, Pill, Switch, cn } from "@/components/quorum/ui";

function holdCopy(pending: Pending | null) {
  if (!pending) return { title: "Held", yes: "Allow", no: "Refuse" };
  if (pending.kind === "guard") return { title: "A person has to clear this", yes: "Allow prepare", no: "Refuse" };
  if (pending.kind === "quality") return { title: "Review band", yes: "Accept", no: "Send back" };
  if (pending.kind === "award") return { title: "The leading bid is thin", yes: "Award the leader", no: "No award" };
  return { title: "The gate is asking you", yes: "Continue", no: "Stop" };
}

function WeightSliders() {
  const weights = useQuorum((state) => state.weights);
  const setWeight = useQuorum((state) => state.setWeight);
  const keys: { key: keyof Weights; label: string }[] = [
    { key: "quality", label: "Quality" },
    { key: "safety", label: "Safety" },
    { key: "fit", label: "Fit" },
    { key: "completeness", label: "Completeness" },
  ];
  const sum = keys.reduce((total, item) => total + weights[item.key], 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      {keys.map((item) => (
        <label key={item.key} className="flex flex-col">
          <FieldLabel label={item.label} value={pct(weights[item.key] / sum)} />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={weights[item.key]}
            aria-label={`${item.label} weight`}
            onChange={(event) => setWeight(item.key, Number(event.target.value))}
          />
        </label>
      ))}
    </div>
  );
}

export function WeightControls() {
  return <WeightSliders />;
}

function Controls() {
  const objective = useQuorum((state) => state.objective);
  const pattern = useQuorum((state) => state.pattern);
  const tau = useQuorum((state) => state.tau);
  const enabled = useQuorum((state) => state.enabled);
  const setObjective = useQuorum((state) => state.setObjective);
  const setPattern = useQuorum((state) => state.setPattern);
  const setTau = useQuorum((state) => state.setTau);
  const toggleAgent = useQuorum((state) => state.toggleAgent);
  const applyPreset = useQuorum((state) => state.applyPreset);
  const meta = patternById(pattern);

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Mission" flush>
        {PRESETS.map((preset) => {
          const on = preset.objective === objective && preset.pattern === pattern;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={on}
              onClick={() => applyPreset(preset.id)}
              className="tap flex min-h-11 w-full items-center justify-between gap-3 border-b px-4 text-left hairline last:border-b-0"
            >
              <span className="text-[17px] text-fg">{preset.title}</span>
              {on ? <Check className="size-5 text-brass" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </Panel>
      <Panel title="Objective">
        <label className="sr-only" htmlFor="objective">
          What should the desk decide?
        </label>
        <textarea
          id="objective"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          rows={5}
          className="min-h-32 w-full resize-y bg-transparent text-[17px] text-fg outline-none"
        />
      </Panel>
      <Panel title="Pattern" flush eyebrow={meta.line}>
        {PATTERNS.map((item) => {
          const on = item.id === pattern;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => setPattern(item.id)}
              className="tap flex min-h-11 w-full items-center justify-between gap-3 border-b px-4 text-left hairline last:border-b-0"
            >
              <span className="text-[17px] text-fg">{item.name}</span>
              {on ? <Check className="size-5 text-brass" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </Panel>
      <Panel title="Confidence gate">
        <label className="flex flex-col">
          <FieldLabel label="Threshold" value={fmt(tau)} />
          <input
            type="range"
            min={0.35}
            max={0.95}
            step={0.01}
            value={tau}
            aria-label="Confidence gate"
            onChange={(event) => setTau(Number(event.target.value))}
          />
        </label>
      </Panel>
      {pattern === "composite" || pattern === "cascade" ? (
        <Panel title="Composite weights">
          <WeightSliders />
        </Panel>
      ) : null}
      <Panel title="Workers" flush eyebrow="Router and Warden always sit in the decision layer. They do not bid.">
        {WORKERS.map((agent) => {
          const on = enabled.includes(agent.id);
          return (
            <button
              key={agent.id}
              type="button"
              role="switch"
              aria-checked={on}
              onClick={() => toggleAgent(agent.id)}
              className="tap flex min-h-[52px] w-full items-center justify-between gap-3 border-b px-4 text-left hairline last:border-b-0"
            >
              <span>
                <span className="block text-[17px] text-fg">{agent.name}</span>
                <span className="block text-[13px] text-muted">{agent.specialty}</span>
              </span>
              <Switch on={on} />
            </button>
          );
        })}
      </Panel>
    </div>
  );
}

function Trace() {
  const snapshot = useQuorum((state) => state.snapshot);
  const visible = useQuorum((state) => state.visible);
  const steps = snapshot?.steps.slice(0, visible) ?? [];
  return (
    <Panel title="Trace" flush eyebrow="Each typed question lands here with its distribution.">
      {steps.length === 0 ? (
        <p className="px-4 py-3 text-[17px] text-muted">Nothing yet.</p>
      ) : (
        <ol>
          {steps
            .filter((step) => step.kind !== "artifact")
            .map((step) => (
              <li key={step.id} className="border-b px-4 py-3 hairline last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-brass">{actorName(step.actor)}</p>
                    <h3 className="text-base font-medium text-fg">{step.title}</h3>
                  </div>
                  {step.decision ? <Pill status={step.status}>{step.decision}</Pill> : null}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{step.detail}</p>
                {step.dist && step.dist.length > 0 ? (
                  <div className="mt-3">
                    <DistBars dist={step.dist} />
                  </div>
                ) : null}
                <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted tabular-nums">
                  {typeof step.confidence === "number" ? <span>Confidence {pct(step.confidence)}</span> : null}
                  {step.latencyMs ? <span>{step.latencyMs} ms modeled</span> : null}
                  {step.cost ? <span>{fmt(step.cost)} units</span> : null}
                </p>
              </li>
            ))}
        </ol>
      )}
    </Panel>
  );
}

function Stage() {
  const snapshot = useQuorum((state) => state.snapshot);
  const visible = useQuorum((state) => state.visible);
  const pattern = useQuorum((state) => state.pattern);
  const enabled = useQuorum((state) => state.enabled);
  const answer = useQuorum((state) => state.answer);
  const meta = patternById(pattern);
  const caughtUp = !!snapshot && visible >= snapshot.steps.length;
  const holding = caughtUp && snapshot?.phase === "hold";
  const copy = holdCopy(snapshot?.pending ?? null);
  const shown = snapshot?.steps.slice(0, visible) ?? [];
  const totals = totalsOf(shown);
  const active = [...shown].reverse().find((step) => step.actor && step.actor !== "router")?.actor;
  const artifacts = caughtUp ? (snapshot?.artifacts ?? []) : [];

  return (
    <div className="flex flex-col gap-8">
      <Panel title={holding ? copy.title : snapshot ? "Live" : "Idle"}>
        <p className="text-[17px] text-fg" aria-live="polite">
          {holding ? snapshot?.summary : snapshot ? (caughtUp ? snapshot.summary : "Stepping through the judge.") : meta.algorithm}
        </p>
        {snapshot && shown.length > 0 ? (
          <dl className="mt-3 grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
            {[
              ["Questions", String(totals.questions)],
              ["Modeled ms", String(totals.latencyMs)],
              ["Units", fmt(totals.cost)],
              ["Holds", String(totals.escalations)],
            ].map(([label, value]) => (
              <div key={label} className="px-3 py-1">
                <dt className="text-[13px] text-muted">{label}</dt>
                <dd className="text-[22px] font-semibold text-fg tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {holding ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="moss" onClick={() => answer("approve")}>
              {copy.yes}
            </Button>
            <Button onClick={() => answer("refuse")}>{copy.no}</Button>
          </div>
        ) : null}
      </Panel>
      <Panel title="On this run" flush>
        {["router", "warden", ...enabled].map((id) => (
          <div key={id} className="flex min-h-11 items-center justify-between gap-3 border-b px-4 hairline last:border-b-0">
            <span className="text-[17px] text-fg">{agentName(id)}</span>
            <span className={cn("text-[17px]", active === id ? "text-brass" : "text-muted")}>
              {active === id ? "Active" : "Waiting"}
            </span>
          </div>
        ))}
      </Panel>
      <Panel title="Artifacts">
        {artifacts.length === 0 ? (
          <p className="text-[17px] text-muted">
            Notes appear when a worker is allowed to prepare. Sends, payments, and deletes never leave as a side effect
            of the judge.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {artifacts.map((artifact, index) => (
              <article key={`${artifact.title}-${index}`} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                <h3 className="text-lg font-semibold tracking-tight text-fg">{artifact.title}</h3>
                <p className="mt-2 text-sm whitespace-pre-wrap text-fg">{artifact.body}</p>
              </article>
            ))}
          </div>
        )}
      </Panel>
      {pattern === "guard" ? (
        <Panel title="Policy" flush eyebrow="Code owns the effect. The model does not.">
          {POLICY.map((row) => (
            <div key={row.level} className="grid gap-1 border-b px-4 py-3 hairline last:border-b-0 sm:grid-cols-3">
              <span className="text-[17px] text-fg">{row.level}</span>
              <span className="text-[15px] text-muted">{row.effect}</span>
              <span className="text-[15px] text-brass">{row.who}</span>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

function MobileBar() {
  const snapshot = useQuorum((state) => state.snapshot);
  const visible = useQuorum((state) => state.visible);
  const answer = useQuorum((state) => state.answer);
  const holding = !!snapshot && snapshot.phase === "hold" && visible >= snapshot.steps.length;
  const copy = holdCopy(snapshot?.pending ?? null);
  if (!holding) return null;

  return (
    <div className="above-tabs fixed inset-x-0 z-20 border-t bg-bg/80 px-3 py-2 backdrop-blur hairline lg:hidden">
      <div className="mx-auto flex max-w-7xl gap-2">
        <Button tone="moss" className="flex-1" onClick={() => answer("approve")}>
          {copy.yes}
        </Button>
        <Button className="flex-1" onClick={() => answer("refuse")}>
          {copy.no}
        </Button>
      </div>
    </div>
  );
}

function actorName(id?: string) {
  if (!id) return "Desk";
  if (id === "you") return "You";
  return agentName(id);
}

function Toolbar() {
  const playing = useQuorum((state) => state.playing);
  const launch = useQuorum((state) => state.launch);
  const step = useQuorum((state) => state.step);
  const reset = useQuorum((state) => state.reset);
  return (
    <div className="mb-1 flex items-center justify-end">
      <Button tone="plain" onClick={() => launch()} disabled={playing}>
        Run
      </Button>
      <Button tone="plain" onClick={step}>
        Step
      </Button>
      <Button tone="plain" onClick={reset}>
        Reset
      </Button>
    </div>
  );
}

export function Desk() {
  return (
    <>
      <Toolbar />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="w-full xl:w-72 xl:shrink-0">
          <Controls />
        </div>
        <div className="min-w-0 flex-1">
          <Stage />
        </div>
        <div className="w-full xl:w-80 xl:shrink-0">
          <Trace />
        </div>
      </div>
      <MobileBar />
    </>
  );
}
