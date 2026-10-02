// Outbound TLS tunnel only. The Host API remains loopback-only and the
// production web bridge requires a revocable paired-device cookie.
// The public address is state (remote.json), never a constant: a temporary quick tunnel by default,
// or a stable hostname when .bunny-a/tunnel.json configures a Cloudflare named tunnel
// ({"mode":"named","hostname":"bunny.example.com","config":"C:\\Users\\you\\.cloudflared\\bunny-a.yml"}).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { readyTunnelAddress, loopbackTunnelOrigin } from "./bunny-tunnel-state.mjs";
const root=resolve(process.env.BUNNY_ROOT ?? process.cwd());
const data=join(root,".bunny-a");mkdirSync(data,{recursive:true});
const binary=join(data,"tools/cloudflared.exe");
const target=loopbackTunnelOrigin(process.env.BUNNY_TUNNEL_ORIGIN);
let child=null,closing=false;
async function configure(enabled,url) {
  const credentials=JSON.parse(readFileSync(join(data,"credentials.json"),"utf8"));
  const response=await fetch(`http://127.0.0.1:${credentials.port}/command`,{method:"POST",headers:{authorization:`Bearer ${credentials.token}`,"content-type":"application/json"},body:JSON.stringify({action:"remote.configure",data:{enabled,url}})});
  if(!response.ok) throw new Error("Host refused tunnel configuration.");
}
/** Named-tunnel settings, or null for the default temporary quick tunnel. */
function namedTunnel() {
  const path=join(data,"tunnel.json");
  if(!existsSync(path)) return null;
  const settings=JSON.parse(readFileSync(path,"utf8"));
  if(settings.mode!=="named") return null;
  const origin=new URL(`https://${settings.hostname}`);
  if(origin.hostname!==settings.hostname || !existsSync(settings.config)) throw new Error("tunnel.json needs a bare hostname and an existing cloudflared config file.");
  return {url:origin.origin,config:settings.config};
}
async function run() {
  const named=namedTunnel();
  const args=named ? ["tunnel","--no-autoupdate","--config",named.config,"run"] : ["tunnel","--no-autoupdate","--url",target,"--protocol","http2"];
  child=spawn(binary,args,{cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]});
  writeFileSync(join(data,"tunnel-process.json"),JSON.stringify({pid:process.pid,childPid:child.pid,root,mode:named ? "named" : "quick",target}));
  let pending="",configured=false;
  const output=chunk=>{
    const value=String(chunk);process.stdout.write(value);pending=(pending+value).slice(-16000);
    // Quick tunnels announce their random hostname; a named tunnel's hostname is configured and is
    // published only once cloudflared reports a registered connection.
    const url=readyTunnelAddress(pending,named?.url);
    if(url && !configured) {
      configured=true;
      writeFileSync(join(data,"remote.json"),JSON.stringify({url,temporary:!named,createdAt:Date.now(),tunnelPid:process.pid},null,2));
      void configure(true,url).catch(error=>console.error(error.message));
    }
  };
  child.stdout.on("data",output);child.stderr.on("data",output);
  const exit=await new Promise(resolveExit=>{child.once("error",error=>{console.error(error.message);resolveExit(-1);});child.once("exit",resolveExit);});
  await configure(false).catch(()=>{});
  const remotePath=join(data,"remote.json");
  if(existsSync(remotePath) && JSON.parse(readFileSync(remotePath,"utf8")).tunnelPid===process.pid) unlinkSync(remotePath);
  console.log(`Tunnel exited (${exit}).`);
  if(!closing) {await new Promise(r=>setTimeout(r,10000));if(!closing) return run();}
}
for(const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>{closing=true;child?.kill();});
await run();
