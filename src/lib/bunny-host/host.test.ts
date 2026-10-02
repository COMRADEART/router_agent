import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostDatabase } from "./persistence.server.ts";
import { TaskManager } from "./manager.server.ts";
import { bunnyRoute } from "./router.ts";
import { providerBase, parseAgentEvent } from "./adapters.server.ts";
import { validateConstraints, validateSubmit, startHost, FailureLimiter } from "./http.server.ts";
import type { AdapterHooks, AdapterResult, ProviderAdapter } from "./contracts.ts";
import type { OrchTask, ProviderLive } from "../orch/types.ts";

function ready(id: "claude"|"ollama"="claude"):ProviderLive {return {...providerBase(id),installed:true,authenticated:true,availability:"ready",capabilities:id === "ollama" ? ["text"] : ["filesystem","terminal","text"],current_model:id === "ollama" ? "test" : null};}
function fakeAdapter() {
  const launched: { task:OrchTask; finish:(result:AdapterResult)=>void; hooks:AdapterHooks; stopped:boolean }[]=[];
  const adapter:ProviderAdapter={id:"claude",detect:async()=>ready(),launch:(task,hooks)=>{
    let finish!:(result:AdapterResult)=>void;const done=new Promise<AdapterResult>(resolve=>finish=resolve);
    const session={task,finish,hooks,stopped:false};launched.push(session);
    return {done,stop:async()=>{session.stopped=true;finish({ok:false,output:"",stopped:true});}};
  }};
  return {adapter,launched};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,10));
test("Host owns approved concurrent jobs across client snapshots; duplicate approval refused",async()=>{
  const db=new HostDatabase(":memory:");const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();
  const a=host.submit({prompt:"First task",mode:"balanced"}),b=host.submit({prompt:"Second task",mode:"fast"});
  assert.equal(fake.launched.length,0);assert.equal(a.state,"waiting_for_approval");
  host.approve(a.id);host.approve(b.id);assert.equal(host.snapshot().tasks.filter(t=>t.state==="running").length,2);
  assert.throws(()=>host.approve(a.id),/duplicate/);
  // An entirely new UI reads registry state; no in-flight promise belongs to it.
  assert.equal(host.snapshot().tasks.find(t=>t.id===a.id)!.state,"running");
  fake.launched[0].hooks.output("Real captured output");await new Promise(r=>setTimeout(r,400));assert.match(db.get(a.id).output,/captured/);
  await host.stop(a.id);await flush();assert.equal(fake.launched[0].stopped,true);assert.equal(fake.launched[1].stopped,false);
  fake.launched[1].finish({ok:true,output:"B completed",exitCode:0});await flush();
  assert.equal(db.get(a.id).state,"stopped");assert.equal(db.get(b.id).state,"completed");assert.equal(db.get(b.id).exitCode,0);
  assert.equal(host.snapshot().performance[0].verified,0);db.close();
});
test("SQLite retains approval, results and replay events after reopen",async()=>{
  const root=mkdtempSync(join(tmpdir(),"bunny-registry-"));const path=join(root,"host.sqlite");
  try {const db=new HostDatabase(path);const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();const task=host.submit({prompt:"Persisted task",mode:"deep"});const cursor=db.cursor();db.close();
    const reopened=new HostDatabase(path);assert.equal(reopened.get(task.id).state,"waiting_for_approval");assert.ok(reopened.events().some(e=>e.type==="approval.required"));assert.equal(reopened.cursor(),cursor);assert.deepEqual(reopened.events(cursor),[]);reopened.close();
  } finally {rmSync(root,{recursive:true,force:true});}
});
test("hard constraints and overrides fail closed; privacy preference does not exclude cloud",()=>{
  const providers=[ready(),ready("ollama")];
  assert.equal(bunnyRoute({prompt:"local only rewrite text",mode:"deep",providers}).recommended_provider,"ollama");
  assert.throws(()=>bunnyRoute({prompt:"local only modify code",mode:"balanced",providers,constraints:{requiresFilesystem:true}}),/hard constraints/);
  assert.throws(()=>bunnyRoute({prompt:"text",mode:"balanced",providers,constraints:{providerDenylist:["claude"]},override:"claude"}),/not eligible/);
  assert.equal(bunnyRoute({prompt:"private architecture analysis",mode:"deep",providers}).recommended_provider,"claude");
  assert.throws(()=>bunnyRoute({prompt:"text",mode:"fast",providers:[{...ready(),availability:"authentication_required"}]}),/No ready/);
});
test("task inputs reject unknown modes, constraint types and unbounded runtime",()=>{
  assert.throws(()=>validateSubmit({prompt:"x",mode:"turbo"}));assert.throws(()=>validateSubmit({prompt:"",mode:"fast"}));
  assert.throws(()=>validateConstraints({localOnly:"true"}));assert.throws(()=>validateConstraints({maxRuntimeMs:0}));assert.throws(()=>validateConstraints({unrecognized:true}));
});
test("legacy migration is idempotent and never fabricates a running session",async()=>{
  const db=new HostDatabase(":memory:");const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();const original=host.submit({prompt:"Old task",mode:"balanced"});
  const imported={...original,id:"legacy",state:"running" as const};host.importLegacy([imported],[]);host.importLegacy([imported],[]);
  assert.equal(db.tasks().filter(t=>t.id==="legacy").length,1);assert.equal(db.get("legacy").state,"stopped");assert.equal(fake.launched.length,0);db.close();
});
test("CLI normalization reports real tool events and explicit session IDs",()=>{
  const events:string[]=[];let output="",session="";
  const hooks:AdapterHooks={event:(type)=>events.push(type),output:text=>output+=text,session:id=>session=id ?? session};
  parseAgentEvent("claude",{session_id:"owned-session",message:{content:[{type:"tool_use",name:"Read",input:{file_path:"a.ts"}},{type:"text",text:"Result"}]}},hooks);
  assert.deepEqual(events,["agent.reading"]);assert.equal(output,"Result");assert.equal(session,"owned-session");
});
test("thermal warnings use real readings, deduplicate and never stop by default",async()=>{
  const db=new HostDatabase(":memory:");const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();const task=host.submit({prompt:"Work",mode:"balanced"});host.approve(task.id);
  const sample={at:Date.now(),cpu:{utilization:20,clockMhz:null,temperatureC:null},memory:{usedBytes:1,availableBytes:1,totalBytes:2},gpus:[{name:"Detected GPU",utilization:20,memoryUsedBytes:null,memoryTotalBytes:null,temperatureC:90,powerW:null,note:null}],notes:[]};
  host.sample(sample);host.sample(sample);assert.equal(db.events().filter(e=>e.type==="thermal.warning").length,1);assert.equal(fake.launched[0].stopped,false);
  host.sample({...sample,gpus:[{...sample.gpus[0],temperatureC:70}]});assert.ok(db.events().some(e=>e.type==="thermal.resolved"));
  assert.throws(()=>host.configureThermal(1000,85,false));await host.stop(task.id);await flush();db.close();
});
test("Host HTTP authentication, pairing revocation and approval validation",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"bunny-http-"));
  const host=await startHost({dataDirectory:directory,port:43129,root:process.cwd()});
  const url="http://127.0.0.1:43129";
  const command=async(action:string,data:unknown={},token=host.token)=>fetch(`${url}/command`,{method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({action,data})});
  try {
    assert.equal((await fetch(`${url}/state`)).status,401);
    assert.equal((await fetch(`${url}/state`,{headers:{authorization:`Bearer ${host.token}`,origin:"https://evil.example"}})).status,403);
    assert.equal((await command("approve",{id:"unknown"})).status,400);
    const code=(await (await command("pairing.create")).json()).pairCode;
    const pair=await fetch(`${url}/pair`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,name:"Test phone"})});const device=await pair.json();assert.equal(pair.status,200);
    assert.equal((await fetch(`${url}/state`,{headers:{authorization:`Bearer ${device.token}`}})).status,200);
    assert.equal((await command("project.add",{name:"Forbidden",path:process.cwd()},device.token)).status,400);
    await command("device.revoke",{id:device.deviceId});
    assert.equal((await fetch(`${url}/state`,{headers:{authorization:`Bearer ${device.token}`}})).status,401);
    assert.equal((await fetch(`${url}/pair`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,name:"Again"})})).status,403);
  } finally {await host.close();rmSync(directory,{recursive:true,force:true});}
});
test("Codex recoverable errors do not decide the outcome; failed turns do",()=>{
  const events:{type:string;detail:string}[]=[];
  const hooks:AdapterHooks={event:(type,detail)=>events.push({type,detail}),output:()=>{},session:()=>{}};
  parseAgentEvent("codex",{type:"error",message:"Reconnecting... 2/5"},hooks);
  assert.deepEqual(events.map(e=>e.type),["agent.warning"]);
  parseAgentEvent("codex",{type:"turn.failed",error:{message:"Quota exceeded"}},hooks);
  assert.deepEqual(events.at(-1),{type:"agent.error",detail:"Quota exceeded"});
});
test("streamed output is coalesced into one write instead of one per chunk",async()=>{
  const db=new HostDatabase(":memory:");const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();
  const task=host.submit({prompt:"Work",mode:"balanced"});host.approve(task.id);
  const before=db.events().filter(e=>e.type==="agent.output").length;
  for(let i=0;i<200;i++) fake.launched[0].hooks.output("tok ");
  assert.equal(db.events().filter(e=>e.type==="agent.output").length,before);
  await new Promise(r=>setTimeout(r,450));
  assert.equal(db.events().filter(e=>e.type==="agent.output").length,before+1);
  const current=db.get(task.id);assert.equal(current.output,"tok ".repeat(200));assert.ok(current.logs.length<10);
  fake.launched[0].finish({ok:true,output:"done"});await new Promise(r=>setTimeout(r,20));db.close();
});
test("a failed background stop is reported instead of crashing the Host",async()=>{
  const db=new HostDatabase(":memory:");const fake=fakeAdapter();const host=new TaskManager(db,process.cwd(),[fake.adapter]);await host.discover();
  const task=host.submit({prompt:"Work",mode:"balanced"});host.approve(task.id);
  fake.launched[0].finish({ok:true,output:"done"});await new Promise(r=>setTimeout(r,20));
  host.stopInBackground(task.id,"late");await new Promise(r=>setTimeout(r,20));
  assert.ok(db.events().some(e=>e.type==="task.stop_failed"&&e.taskId===task.id));db.close();
});
test("pairing limiter counts failures only, never extends a lockout and resets on success",()=>{
  const limiter=new FailureLimiter(3,1000);
  limiter.fail("a",0);limiter.fail("a",10);assert.equal(limiter.blocked("a",20),false);
  limiter.fail("a",30);assert.equal(limiter.blocked("a",40),true);
  assert.equal(limiter.blocked("a",50),true);assert.equal(limiter.blocked("b",50),false);
  assert.equal(limiter.blocked("a",1001),false,"blocked polls must not push the window out");
  limiter.fail("c",2000);limiter.succeed("c");assert.equal(limiter.entries.has("c"),false);
});
