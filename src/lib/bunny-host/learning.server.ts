import { createHash, randomUUID } from "node:crypto";
import { analyze, scoreProvider } from "../orch/router.ts";
import { eligibility, inferredConstraints } from "./router.ts";
import type { Mode, ProviderId, ProviderLive, TaskConstraints } from "../orch/types.ts";
import type { HostDatabase } from "./persistence.server.ts";

export type RoutingPolicy={id:string;historyWeight:number;workloadWeight:number;latencyWeight?:number};
export type ReplayCase={prompt:string;mode:Mode;constraints?:TaskConstraints;expected:ProviderId};
export const BASE_POLICY:RoutingPolicy={id:"bunny-router-v1",historyWeight:1,workloadWeight:0,latencyWeight:0};
const PROVIDERS:ProviderId[]=["codex","claude","ollama","opencode","cline","cursor"];
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;};
export const ROUTING_BENCHMARK:ReplayCase[]=[
  {prompt:"Create a tiny code file",mode:"fast",expected:"codex"},
  {prompt:"Debug a repository architecture with a failing test suite",mode:"deep",expected:"codex"},
  {prompt:"Fix one failing test in a repository",mode:"balanced",expected:"codex"},
  {prompt:"Draft documentation for a public product",mode:"deep",expected:"claude"},
  {prompt:"Compare reasoning approaches and explain tradeoffs",mode:"deep",expected:"claude"},
  {prompt:"Run a shell automation command for a distributed deploy",mode:"deep",expected:"codex",constraints:{requiresTerminal:true}},
  {prompt:"Transform a local only short sentence",mode:"fast",expected:"ollama"},
  {prompt:"Summarize privacy-sensitive text; do not send off machine",mode:"balanced",expected:"ollama"},
  {prompt:"Implement distributed repository architecture in a large context",mode:"deep",expected:"codex"},
  {prompt:"Quick simple uppercase transformation",mode:"fast",expected:"ollama"},
  {prompt:"Research and compare two papers",mode:"deep",expected:"claude"},
];
export class PolicyEngine {
  db:HostDatabase;
  constructor(db:HostDatabase) {
    this.db=db;db.db.exec("CREATE TABLE IF NOT EXISTS policies(id TEXT PRIMARY KEY,record TEXT NOT NULL,replay TEXT,previous_id TEXT); CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
    db.db.prepare("INSERT OR IGNORE INTO policies VALUES(?,?,NULL,NULL)").run(BASE_POLICY.id,JSON.stringify(BASE_POLICY));
    db.db.prepare("INSERT OR IGNORE INTO settings VALUES('active_policy',?)").run(BASE_POLICY.id);
  }
  active():RoutingPolicy {const id=(this.db.db.prepare("SELECT value FROM settings WHERE key='active_policy'").get() as {value:string}).value;return JSON.parse((this.db.db.prepare("SELECT record FROM policies WHERE id=?").get(id) as {record:string}).record);}
  adjustment(provider:ProviderLive,prompt:string,mode:Mode,policy=this.active()):number {
    const type=analyze(prompt,mode).task_type;
    return this.db.learned(provider.id,type)*policy.historyWeight-Math.min(0.1,provider.active_jobs*policy.workloadWeight)+this.latencyAdjustment(provider.id,type,mode,policy.latencyWeight ?? 0);
  }
  /** Measured speed relative to other providers on the same task type; zero without enough samples on both sides. */
  latencyAdjustment(id:ProviderId,type:string,mode:Mode,weight:number):number {
    if(!weight) return 0;
    const mine=this.db.latency(id,type);const all=PROVIDERS.map(provider=>this.db.latency(provider,type)).filter((value):value is number=>value!==null);
    if(mine===null || all.length<2) return 0;
    const reference=median(all);
    return Math.max(-1,Math.min(1,(reference-mine)/reference))*weight*(mode === "fast" ? 1 : mode === "balanced" ? 0.5 : 0.2);
  }
  choose(test:ReplayCase,providers:ProviderLive[],policy:RoutingPolicy) {
    const constraints=inferredConstraints(test.prompt,test.constraints);const pool=providers.filter(p=>!eligibility(p,constraints));
    return pool.map(provider=>({id:provider.id,score:scoreProvider(provider.id,test.prompt,test.mode,provider)+this.adjustment(provider,test.prompt,test.mode,policy)})).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id))[0]?.id ?? null;
  }
  candidate(historyWeight:number,workloadWeight:number,providers:ProviderLive[],latencyWeight=0) {
    if(!Number.isFinite(historyWeight)||historyWeight<0||historyWeight>2||!Number.isFinite(workloadWeight)||workloadWeight<0||workloadWeight>0.03||!Number.isFinite(latencyWeight)||latencyWeight<0||latencyWeight>0.05) throw new Error("Candidate weights exceed allowed bounds.");
    const policy={id:randomUUID(),historyWeight,workloadWeight,latencyWeight};const active=this.active();
    const rows=ROUTING_BENCHMARK.map(test=>({...test,current:this.choose(test,providers,active),candidate:this.choose(test,providers,policy)}));
    const currentPass=rows.filter(row=>row.current===row.expected).length,candidatePass=rows.filter(row=>row.candidate===row.expected).length;
    const regressions=rows.filter(row=>row.current===row.expected && row.candidate!==row.expected).length;
    const replay={datasetHash:createHash("sha256").update(JSON.stringify(ROUTING_BENCHMARK)).digest("hex"),currentPass,candidatePass,regressions,promotable:candidatePass>currentPass && regressions===0,rows};
    this.db.db.prepare("INSERT INTO policies VALUES(?,?,?,?)").run(policy.id,JSON.stringify(policy),JSON.stringify(replay),active.id);
    return {policy,replay};
  }
  promote(id:string) {
    const row=this.db.db.prepare("SELECT replay,previous_id FROM policies WHERE id=?").get(id) as {replay:string;previous_id:string}|undefined;
    if(!row || !JSON.parse(row.replay).promotable || row.previous_id!==this.active().id) throw new Error("Promotion gate refused: no measured improvement without regression against the current policy.");
    this.db.db.prepare("UPDATE settings SET value=? WHERE key='active_policy'").run(id);
    this.db.event("policy.promoted",null,`Policy ${id}; rollback artifact ${row.previous_id}`);return this.active();
  }
  rollback() {const row=this.db.db.prepare("SELECT previous_id FROM policies WHERE id=?").get(this.active().id) as {previous_id:string|null};if(!row.previous_id) throw new Error("No previous policy.");this.db.db.prepare("UPDATE settings SET value=? WHERE key='active_policy'").run(row.previous_id);this.db.event("policy.rolled_back",null,row.previous_id);return this.active();}
}
