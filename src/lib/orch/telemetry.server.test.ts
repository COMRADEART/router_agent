import test from "node:test";
import assert from "node:assert/strict";
import { parseNvidiaSamples } from "./telemetry.server.ts";
test("GPU telemetry parses every GPU independently and preserves unavailable sensors",()=>{
  const samples=parseNvidiaSamples("GPU One, 10, 100, 200, 40, 25\nGPU Two, N/A, 300, 400, [Not Supported], N/A\n");
  assert.equal(samples.length,2);assert.equal(samples[0].utilization,10);assert.equal(samples[1].memoryUsedBytes,300*1024*1024);assert.equal(samples[1].temperatureC,null);assert.equal(samples[1].utilization,null);
});
