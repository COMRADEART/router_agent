import assert from "node:assert/strict";
import test from "node:test";
import { routeTask } from "./router.ts";
import type { ProviderId, ProviderLive } from "./types.ts";

function live(id: ProviderId, availability: ProviderLive["availability"], model: string | null = null): ProviderLive {
  return {
    id,
    name: id,
    availability,
    installed: availability !== "unavailable",
    authenticated: availability === "ready",
    local_or_cloud: id === "ollama" ? "local" : "cloud",
    supported_task_types: ["coding", "debug", "research", "general"],
    current_model: model,
    usage: null,
    usage_note: "Usage unavailable",
    active_jobs: 0,
    latency_estimate_ms: id === "ollama" ? 400 : 1800,
    extension: id === "cline" || id === "cursor",
    detail: "",
    vram: null,
    tokens_per_sec: null,
  };
}

const primary = [
  live("codex", "auth_required"),
  live("claude", "auth_required"),
  live("ollama", "ready", "llama3.2"),
];

test("deep repository work does not collapse to a fixed provider map", () => {
  const prompt = "Implement a distributed test harness across the repository and fix the failing suite";
  const deep = routeTask({ prompt, mode: "deep", providers: primary });
  const fast = routeTask({ prompt, mode: "fast", providers: primary });
  assert.equal(deep.recommended_provider, "codex");
  assert.equal(fast.recommended_provider, "ollama");
  assert.equal(deep.task_type, "debug");
  assert.ok(deep.complexity > 0.6);
  assert.ok(deep.confidence > 0.5);
});

test("deep research prefers Claude over Codex when both have the same host status", () => {
  const decision = routeTask({
    prompt: "Compare the two papers and explain the argument in depth",
    mode: "deep",
    providers: primary,
  });
  assert.equal(decision.task_type, "research");
  assert.equal(decision.recommended_provider, "claude");
});

test("a manual override is recorded without pretending the model answered", () => {
  const decision = routeTask({
    prompt: "Rename this one line typo",
    mode: "fast",
    providers: primary,
    override: "claude",
  });
  assert.equal(decision.recommended_provider, "claude");
  assert.match(decision.reason, /Manual override/);
});
