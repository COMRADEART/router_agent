import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { execute, probeOllama, stopTask } from "./exec.server.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
const tags = () => new Response(JSON.stringify({ models: [{ name: "test-model" }] }));
const request = {
  taskId: "integration-test",
  provider: "ollama" as const,
  model: "test-model",
  prompt: "Test",
};

test("unconfigured cloud providers refuse launch without a network request", async () => {
  globalThis.fetch = async () => {
    throw new Error("must not fetch");
  };
  const result = await execute({ ...request, provider: "codex" });
  assert.equal(result.ok, false);
  assert.match(result.error!, /not configured/);
});
test("offline or malformed Ollama discovery fails cleanly", async () => {
  globalThis.fetch = async () => new Response("invalid JSON");
  assert.deepEqual(await probeOllama(), { up: false, models: [] });
});
test("a missing requested model is refused instead of silently switching", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return tags();
  };
  const result = await execute({ ...request, model: "missing-model" });
  assert.equal(result.ok, false);
  assert.match(result.error!, /no longer available/);
  assert.equal(calls, 1);
});
test("execution delivers model output and releases its task controller", async () => {
  globalThis.fetch = async (_url, options) => {
    if (!options?.method) return tags();
    assert.deepEqual(JSON.parse(options.body as string), {
      model: "test-model",
      prompt: "Test",
      stream: false,
    });
    return new Response(JSON.stringify({ response: "ROUTER_TEST_OK" }));
  };
  const result = await execute(request);
  assert.equal(result.ok, true);
  assert.equal(result.output, "ROUTER_TEST_OK");
  assert.deepEqual(await stopTask(request.taskId), { stopped: false });
});
test("duplicate launch is refused and cancellation aborts only its task", async () => {
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  globalThis.fetch = async (_url, options) => {
    if (!options?.method) return tags();
    started();
    return new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  };
  const first = execute(request);
  await ready;
  const duplicate = await execute(request);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error!, /already running/);
  assert.deepEqual(await stopTask("unrelated-task"), { stopped: false });
  assert.deepEqual(await stopTask(request.taskId), { stopped: true });
  assert.equal((await first).stopped, true);
  assert.deepEqual(await stopTask(request.taskId), { stopped: false });
});

test("Host streaming preserves genuine Ollama output and cancellation during discovery prevents generation",async()=>{
  const chunks:string[]=[];
  globalThis.fetch=async(_url,options)=>!options?.method ? tags() : new Response('{"response":"BUNNY"}\n{"response":"_A_OK","done":true}\n');
  const result=await execute({...request,taskId:"streaming"},{stream:text=>chunks.push(text)});
  assert.equal(result.output,"BUNNY_A_OK");assert.deepEqual(chunks,["BUNNY","_A_OK"]);
  const controller=new AbortController();let generationCalled=false;
  globalThis.fetch=async(_url,options)=>{if(options?.method) generationCalled=true;controller.abort();return tags();};
  const stopped=await execute({...request,taskId:"prelaunch-stop"},{signal:controller.signal});
  assert.equal(stopped.stopped,true);assert.equal(generationCalled,false);
});
