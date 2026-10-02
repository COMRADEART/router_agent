import test from "node:test";
import assert from "node:assert/strict";
import { HostDatabase } from "./persistence.server.ts";
import { PolicyEngine } from "./learning.server.ts";
import { providerBase } from "./adapters.server.ts";
import type { ProviderId } from "../orch/types.ts";
test("policy candidates persist replay artifacts; equal performance cannot be silently promoted",()=>{
  const db=new HostDatabase(":memory:");const policy=new PolicyEngine(db);
  const providers=(["codex","claude","ollama"] as ProviderId[]).map(id=>({...providerBase(id),installed:true,authenticated:true,availability:"ready" as const,capabilities:id === "ollama" ? ["text"] : ["text","filesystem","terminal"]}));
  const result=policy.candidate(1,0,providers);
  assert.equal(result.replay.rows.length,11);assert.equal(result.replay.regressions,0);assert.equal(result.replay.promotable,false);
  assert.throws(()=>policy.promote(result.policy.id),/Promotion gate refused/);assert.equal(policy.active().id,"bunny-router-v1");
  assert.throws(()=>policy.candidate(100,1,providers),/bounds/);assert.throws(()=>policy.rollback(),/No previous/);db.close();
});
