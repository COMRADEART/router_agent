import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BENCH_TASKS, POLICY } from "@/lib/jev/catalog";
import {
  FANOUT_QUESTION_MS,
  bidsFor,
  fmt,
  pct,
  reflexCurve,
  reflexPoint,
} from "@/lib/jev/engine";
import { useQuorum } from "@/store/use-quorum";
import { DistBars, FieldLabel, Panel } from "@/components/quorum/ui";
import { WeightControls } from "@/components/quorum/desk";

export function Algorithms() {
  const tau = useQuorum((state) => state.tau);
  const setTau = useQuorum((state) => state.setTau);
  const enabled = useQuorum((state) => state.enabled);
  const objective = useQuorum((state) => state.objective);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const curve = useMemo(() => reflexCurve(), []);
  const points = useMemo(() => BENCH_TASKS.map((task) => ({ task, point: reflexPoint(task.text, tau) })), [tau]);
  const spend = points.reduce((sum, row) => sum + row.point.spend, 0);
  const always = BENCH_TASKS.length * 3.4;
  const ranking = bidsFor(objective, enabled);
  const fanoutQuestions = 6;

  return (
    <div className="flex flex-col gap-8">
      <Panel title="Confidence gate on eight tasks" eyebrow="REFLEX">
        <p className="max-w-3xl text-sm text-muted">
          Fast path only if the toolbox confidence clears τ and policy says the action is executable. Money, mail,
          secrets, and “ask a person” stay held no matter how high you push the gate. That is why the moss line
          does not move.
        </p>
        <label className="mt-3 flex max-w-md flex-col">
          <FieldLabel label="Confidence gate τ" value={fmt(tau)} />
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
        <div className="mt-2 h-64 w-full min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="tau" stroke="var(--color-muted)" tick={{ fill: "var(--color-muted)", fontSize: 12 }} />
                <YAxis
                  stroke="var(--color-muted)"
                  tick={{ fill: "var(--color-muted)", fontSize: 12 }}
                  tickFormatter={(value: number) => `${Math.round(value * 100)}`}
                  domain={[0, 1]}
                />
                <Tooltip
                  formatter={(value, name) => [`${Math.round(Number(value) * 100)}%`, String(name)]}
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    borderRadius: 12,
                    color: "var(--color-fg)",
                  }}
                />
                <ReferenceLine x={tau} stroke="var(--color-brass)" />
                <Line type="monotone" dataKey="fast" name="Fast path" stroke="var(--color-brass)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="held" name="Held for a person" stroke="var(--color-moss)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-control bg-raised" />
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          At τ {fmt(tau)} the eight tasks spend {fmt(spend)} units. Always calling a strong model would spend{" "}
          {fmt(always)}. Brass is the fast path. Moss is held for a person.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-2 pr-3 font-medium">Task</th>
                <th className="py-2 pr-3 font-medium">Call</th>
                <th className="py-2 pr-3 font-medium">Confidence</th>
                <th className="py-2 font-medium">Path</th>
              </tr>
            </thead>
            <tbody>
              {points.map(({ task, point }) => (
                <tr key={task.id} className="border-b border-line last:border-b-0">
                  <td className="py-2 pr-3 text-fg">{task.title}</td>
                  <td className="py-2 pr-3 text-muted">{point.decision}</td>
                  <td className="py-2 pr-3 text-fg tabular-nums">{pct(point.confidence)}</td>
                  <td className="py-2 text-fg">{point.fast ? "Fast" : point.held ? "Person" : "Strong step"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Fan-out wall clock" eyebrow="Parallel questions">
          <p className="text-sm text-muted">
            {fanoutQuestions} questions share one state. Each is modeled at {FANOUT_QUESTION_MS} ms.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <FieldLabel label="Serial sum" value={`${FANOUT_QUESTION_MS * fanoutQuestions} ms`} />
              <div className="mt-2 h-3 rounded-full bg-line" />
            </div>
            <div>
              <FieldLabel label="Fan-out wall clock" value={`${FANOUT_QUESTION_MS} ms`} />
              <div className="mt-2 h-3 rounded-full bg-raised">
                <div className="h-3 rounded-full bg-brass" style={{ width: `${Math.round(100 / fanoutQuestions)}%` }} />
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Softmax: pᵢ = exp(sᵢ / T) / Σ exp(sⱼ / T). Confidence = ½ top probability + ½ margin. The desk uses T
            between 0.55 and 0.70 depending on the question.
          </p>
        </Panel>
        <Panel title="Contract net on the current objective" eyebrow="Bids">
          <p className="text-sm text-muted">
            raw = (keyword hits, or 0.2 if there are none) divided by cost to the power 0.3. Cost still matters, but a
            real match is not erased by a cheaper worker.
          </p>
          <div className="mt-4">
            {ranking.judgment ? (
              <DistBars dist={ranking.judgment.dist} />
            ) : (
              <p className="text-sm text-muted">Enable a worker on the desk to see bids.</p>
            )}
          </div>
          {ranking.rows.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-1 text-sm text-muted">
              {ranking.rows.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 tabular-nums">
                  <span>{row.name}</span>
                  <span>
                    {row.hits} hits · raw {fmt(row.raw)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>

      <Panel title="Composite weights" eyebrow="Your arithmetic">
        <p className="mb-2 max-w-3xl text-sm text-muted">
          score = Σ wᵢ sᵢ after the weights are normalized. Accept at 0.72, review at 0.48, otherwise reject. Moving
          these sliders changes the next cascade or composite run.
        </p>
        <div className="max-w-md">
          <WeightControls />
        </div>
      </Panel>

      <Panel title="Policy table" eyebrow="Effects">
        <ul className="flex flex-col gap-3">
          {POLICY.map((row) => (
            <li key={row.level} className="grid gap-1 border-b border-line pb-3 last:border-b-0 last:pb-0 sm:grid-cols-3">
              <span className="text-sm font-medium text-fg">{row.level}</span>
              <span className="text-sm text-muted">{row.effect}</span>
              <span className="text-sm text-brass">{row.who}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
