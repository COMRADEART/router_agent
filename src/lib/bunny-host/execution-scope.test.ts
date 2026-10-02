import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CodexAdapter, ClaudeAdapter, providerBase } from "./adapters.server.ts";
import { systemContext } from "./discovery.server.ts";
import type { AdapterHooks } from "./contracts.ts";
import type { OrchTask, ProviderExecutionScope } from "../orch/types.ts";

/** Real adapters and owned process launch, with an argv-echo executable rather than a model CLI. */
for (const provider of ["codex", "claude"] as const) for (const access of [undefined, "read", "write"] as const) test(`MA0R: actual ${provider} adapter spawn carries ${access ?? "legacy"} authority`, async () => {
  const directory = mkdtempSync(join(tmpdir(), "bunny-authority-"));
  const script = join(directory, "argv.mjs");
  writeFileSync(script, "process.stdin.resume(); process.stdin.on('end',()=>console.log(JSON.stringify({argv:process.argv.slice(2)})));\n");
  const adapter = provider === "codex" ? new CodexAdapter(() => systemContext()) : new ClaudeAdapter(() => systemContext());
  adapter.launchTarget = { command: process.execPath, args: [script], path: script, kind: "node-script", source: "disposable fixture" };
  adapter.detected = { ...providerBase(provider), installed: true, authenticated: true, availability: "ready" };
  const lines: string[] = [];
  const hooks: AdapterHooks = { event: () => {}, session: () => {}, output: () => {}, raw: (stream, line) => { if (stream === "stdout") lines.push(line); } };
  const task = { id: "fixture", provider, model: "fixture-model", prompt: "Echo arguments only", cwd: directory, ...(access ? { executionScope: { access } as ProviderExecutionScope } : {}) } as OrchTask;
  try {
    const result = await adapter.launch(task, hooks).done;
    assert.equal(result.ok, true);
    const args = (JSON.parse(lines.find((line) => line.includes('"argv"'))!) as { argv: string[] }).argv;
    if (provider === "codex") assert.equal(args[args.indexOf("--sandbox") + 1], access === "read" ? "read-only" : "workspace-write");
    else {
      assert.equal(args[args.indexOf("--permission-mode") + 1], access === "read" ? "dontAsk" : "acceptEdits");
      if (access === "read") {
        assert.equal(args[args.indexOf("--tools") + 1], "Read");
        assert.equal(args[args.indexOf("--allowedTools") + 1], "Read");
        assert.equal(args[args.indexOf("--disallowedTools") + 1], "Write,Edit,Bash,PowerShell");
      } else assert.match(args[args.indexOf("--allowedTools") + 1], /Read,Write,Edit,Bash/);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
