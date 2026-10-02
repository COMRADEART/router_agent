// Defaults to private loopback validation. BUNNY_GATEWAY_PUBLIC=1 exercises an
// already approved TLS tunnel. Test credentials stay in memory and are revoked.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { serverFnFetcher } from "../node_modules/@tanstack/start-client-core/dist/esm/client-rpc/serverFnFetcher.js";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { request as httpRequest } from "node:http";
const root=resolve("."),data=join(root,".bunny-a"),config=join(data,"remote.json");
const publicGateway=process.env.BUNNY_GATEWAY_PUBLIC === "1";
if(!publicGateway) assert.ok(!existsSync(config),"Refusing to replace existing remote configuration.");
const packagePath=JSON.parse(readFileSync(join(data,"deployment.json"),"utf8")).packagePath;
const ssr=join(packagePath,".output/server/_ssr");
const hostSource=readFileSync(join(ssr,readdirSync(ssr).find(name=>/^host-[\w-]+\.mjs$/.test(name))),"utf8");
const id=name=>hostSource.match(new RegExp(`id: "([a-f0-9]+)",\\s*name: "${name}"`))?.[1];
assert.ok(id("readBunnyHost"));assert.ok(id("commandBunnyHost"));
const credentials=JSON.parse(readFileSync(join(data,"credentials.json"),"utf8"));
const local=async(action,input={})=>{
  const response=await fetch(`http://127.0.0.1:${credentials.port}/command`,{method:"POST",headers:{authorization:`Bearer ${credentials.token}`,"content-type":"application/json"},body:JSON.stringify({action,data:input})});
  const result=await response.json();if(!response.ok) throw new Error(result.error);return result;
};
const hostname="bunny-companion.invalid",origin=publicGateway ? JSON.parse(readFileSync(config,"utf8")).url : `https://${hostname}`,url=publicGateway ? origin : "http://127.0.0.1:8084";
const headers={host:hostname,"x-forwarded-proto":"https",origin,"sec-fetch-site":"same-origin"};
let cookie="",deviceId=null,taskId=null;
// Node's fetch strips a custom Host header. Use an actual HTTP request so this
// exercise reaches the same public-host branch that the TLS relay will use.
const wireFetch=(address,options={})=>new Promise((resolveResponse,reject)=>{
  const request=httpRequest(address,{method:options.method ?? "GET",headers:Object.fromEntries(new Headers(options.headers))},response=>{
    const chunks=[];response.on("data",chunk=>chunks.push(chunk));response.on("end",()=>resolveResponse(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:response.headers})));response.on("error",reject);
  });request.on("error",reject);if(options.body) request.write(options.body);request.end();
});
const transport=publicGateway ? fetch : wireFetch;
const rpc=async(name,input,extra={})=>{
  const envelope=await runWithStartContext({startOptions:{}},()=>serverFnFetcher(`${url}/_serverFn/${id(name)}`,[{method:"POST",data:input,headers:{...headers,...extra,...(cookie ? {cookie} : {})}}],transport));
  if(envelope.error) throw envelope.error;return envelope.result ?? envelope;
};
const checks=[];
try {
  if(!publicGateway) writeFileSync(config,JSON.stringify({url:origin,temporary:true,testOnly:true}));
  await assert.rejects(rpc("readBunnyHost",{after:0}),/Pair this device/);checks.push("Unpaired reads refused");
  const cross=await transport(`${url}/api/bunny-pair`,{method:"POST",headers:{...headers,origin:"https://evil.invalid","content-type":"application/json"},body:JSON.stringify({code:"invalid",name:"test"})});assert.equal(cross.status,403);checks.push("Cross-origin requests refused");
  const code=(await local("pairing.create")).pairCode;
  const paired=await transport(`${url}/api/bunny-pair`,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({code,name:"Gateway verification (revoked after test)"})});
  const result=await paired.json();assert.equal(paired.status,200,JSON.stringify(result));assert.equal(result.paired,true);assert.ok(!("token" in result));deviceId=result.deviceId;
  const setCookie=paired.headers.get("set-cookie");assert.match(setCookie,/HttpOnly; Secure; SameSite=Strict/);cookie=setCookie.split(";")[0];checks.push("One-time pairing sets secure HttpOnly cookie without exposing bearer in JSON");
  const state=await rpc("readBunnyHost",{after:0});assert.equal(state.app,"Bunny-A");checks.push("Paired device reads the actual shared Host registry");
  await assert.rejects(rpc("commandBunnyHost",{action:"project.add",data:{name:"Denied",path:root}}),/workstation/);checks.push("Remote project registration refused");
  const routed=await rpc("commandBunnyHost",{action:"submit",data:{prompt:"Reply with exactly BUNNY_REMOTE_OK. No extra words.",mode:"fast",override:"ollama"}});taskId=routed.task.id;assert.equal(routed.task.state,"waiting_for_approval");checks.push("Remote task waits for explicit approval");
  await rpc("commandBunnyHost",{action:"approve",data:{id:taskId}});
  let task;for(let attempt=0;attempt<60;attempt++) {task=(await rpc("readBunnyHost",{after:0})).tasks.find(t=>t.id===taskId);if(["completed","failed","stopped"].includes(task.state)) break;await new Promise(r=>setTimeout(r,500));}
  assert.equal(task.state,"completed",task.error);assert.equal(task.output.trim(),"BUNNY_REMOTE_OK");checks.push("Approved task executes through the Host and returns real Ollama output");
  const stopped=await rpc("commandBunnyHost",{action:"submit",data:{prompt:"Write 500 numbered sentences about programming. Keep generating until all 500 are written.",mode:"fast",override:"ollama",constraints:{maxRuntimeMs:30000}}});
  await rpc("commandBunnyHost",{action:"approve",data:{id:stopped.task.id}});
  let running;for(let attempt=0;attempt<30;attempt++) {running=(await rpc("readBunnyHost",{after:0})).tasks.find(t=>t.id===stopped.task.id);if(running.state==="running" && running.output.length) break;await new Promise(r=>setTimeout(r,200));}
  assert.equal(running.state,"running");assert.ok(running.output.length>0,"Real generation must begin before stop.");
  await rpc("commandBunnyHost",{action:"stop",data:{id:stopped.task.id}});const afterStop=await rpc("readBunnyHost",{after:0});assert.equal(afterStop.tasks.find(t=>t.id===stopped.task.id).state,"stopped");assert.equal(afterStop.tasks.find(t=>t.id===taskId).state,"completed");checks.push("Remote stop cancels genuine in-flight generation and preserves the other task");
  await local("device.revoke",{id:deviceId});await assert.rejects(rpc("readBunnyHost",{after:0}),/Authentication required/);checks.push("Revoked cookie immediately loses Host access");
  if(!publicGateway) {await assert.rejects(rpc("readBunnyHost",{after:0},{host:"127.0.0.1:8084","cf-connecting-ip":"192.0.2.1",origin:"http://127.0.0.1:8084"}),/Remote requests cannot/);checks.push("Forwarded remote traffic cannot borrow local workstation credentials");}
  writeFileSync(`test-results/bunny-gateway-${publicGateway ? "public" : "local"}-validation.json`,JSON.stringify({ok:true,transport:publicGateway ? "Cloudflare public HTTPS, certificate validation enabled" : "loopback HTTPS-forwarding simulation; public TLS not tested",checks,taskId},null,2));console.log(checks.join("\n"));
} finally {
  if(deviceId) await local("device.revoke",{id:deviceId}).catch(()=>{});
  if(taskId) await local("stop",{id:taskId}).catch(()=>{});
  if(!publicGateway) unlinkSync(config);
}
