import test from "node:test";
import assert from "node:assert/strict";
import {
  bytes,
  elapsed,
  finitePlan,
  isLocalGeneration,
  percent,
  recentSamples,
  thermalReadingFor,
  verifiedFile,
  conflictsWithLocalOnly,
} from "./ui-model.ts";
import type { HostSample, OrchTask, TaskProgress } from "../../lib/orch/types.ts";

const task = (fields: Partial<OrchTask>) => fields as OrchTask;
const sample = (at: number, temperatureC: number | null = null): HostSample => ({
  at,
  cpu: { utilization: null, clockMhz: null, temperatureC },
  memory: { usedBytes: 0, availableBytes: 0, totalBytes: 0 },
  gpus: [],
  notes: [],
});

test("progress needs finite integer steps, never elapsed time or a provider percentage", () => {
  assert.equal(finitePlan({ kind: "indeterminate" }), null);
  assert.equal(finitePlan(null), null);
  for (const [completed, total] of [
    [0, 0],
    [1, Infinity],
    [NaN, 5],
    [-1, 5],
    [6, 5],
    [1.2, 5],
    [1, 5.2],
  ]) {
    assert.equal(
      finitePlan({ kind: "determinate", completed, total, source: "provider plan" }),
      null,
    );
  }
  const realPlan: TaskProgress = {
    kind: "determinate",
    completed: 7,
    total: 10,
    source: "provider plan",
    current: "Running tests",
  };
  assert.deepEqual(finitePlan(realPlan), realPlan);
});
test("elapsed uses actual session boundaries and freezes at finish", () => {
  assert.equal(elapsed(task({ startedAt: null }), 999999), "—");
  assert.equal(elapsed(task({ startedAt: 1000 }), 259000), "04:18");
  assert.equal(elapsed(task({ startedAt: 1000, finishedAt: 259000 }), 999999), "04:18");
  assert.equal(elapsed(task({ startedAt: 1000 }), 3662000), "1:01:01");
});
test("missing sensors remain unavailable and gaps remain in telemetry history", () => {
  for (const value of [null, undefined, NaN, Infinity]) {
    assert.equal(bytes(value), "Unavailable");
    assert.equal(percent(value), "Unavailable");
  }
  const history = [sample(100), sample(1000), sample(5000), sample(121000)];
  assert.deepEqual(recentSamples(history), history.slice(1));
  assert.equal(recentSamples(history)[1].cpu.utilization, null);
});
test("thermal warnings require fresh measured temperatures and a reachable Host", () => {
  assert.equal(thermalReadingFor([sample(1000, 95)], "offline", 90, 85, 2000), null);
  assert.equal(thermalReadingFor([sample(1000, 95)], "online", 90, 85, 20000), null);
  assert.equal(thermalReadingFor([sample(2000, 95)], "online", 90, 85, 1000), null);
  assert.equal(thermalReadingFor([sample(1000)], "online", 90, 85, 2000), null);
  assert.deepEqual(thermalReadingFor([sample(1000, 95)], "online", 90, 85, 2000), {
    name: "CPU",
    temperature: 95,
    key: "cpu",
  });
});
test("cloud and unknown Ollama models cannot be presented as local inference", () => {
  assert.equal(
    isLocalGeneration(task({ provider: "ollama", model: "deepseek:cloud", state: "running" })),
    false,
  );
  assert.equal(isLocalGeneration(task({ provider: "ollama", model: "", state: "running" })), false);
  assert.equal(
    isLocalGeneration(task({ provider: "ollama", model: "qwen3:8b", state: "completed" })),
    false,
  );
  assert.equal(
    isLocalGeneration(task({ provider: "ollama", model: "qwen3:8b", state: "running" })),
    true,
  );
  assert.equal(
    conflictsWithLocalOnly(
      task({ provider: "ollama", model: "deepseek:cloud", constraints: { localOnly: true } }),
    ),
    true,
  );
  assert.equal(
    conflictsWithLocalOnly(
      task({ provider: "ollama", model: "deepseek:cloud", constraints: { localOnly: false } }),
    ),
    false,
  );
});
test("a file claim requires independent Host verification; prose never creates a file manifest", () => {
  assert.equal(verifiedFile(task({ state: "completed", output: "report.pdf created" })), null);
  const fields: Partial<OrchTask> = {
    state: "completed",
    cwd: "C:\\Projects\\bunny",
    verify: { kind: "file", name: "result.txt", expected: "OK" },
  };
  assert.equal(verifiedFile(task(fields)), null);
  assert.equal(
    verifiedFile(task({ ...fields, verification: { passed: false, detail: "Missing" } })),
    null,
  );
  assert.deepEqual(
    verifiedFile(task({ ...fields, verification: { passed: true, detail: "Disk check" } })),
    { name: "result.txt", folder: "C:\\Projects\\bunny", path: "C:\\Projects\\bunny\\result.txt" },
  );
});
