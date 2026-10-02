import test from "node:test";
import assert from "node:assert/strict";
import { authorizeBridge } from "./host-bridge.server.ts";

const req=(url:string,headers:Record<string,string>={})=>new Request(url,{headers});

test("workstation access requires a loopback peer, not just a loopback Host header",()=>{
  assert.deepEqual(authorizeBridge(req("http://127.0.0.1:8080/x"),"127.0.0.1"),{local:true,token:null});
  assert.equal(authorizeBridge(req("http://localhost:8080/x"),"::1").local,true);
  assert.throws(()=>authorizeBridge(req("http://127.0.0.1:8080/x"),"192.168.1.50"),/only available from this machine/);
  assert.throws(()=>authorizeBridge(req("http://127.0.0.1:8080/x"),undefined),/only available from this machine/);
});
test("proxied requests cannot borrow workstation authentication",()=>{
  const cases:Record<string,string>[]=[{"cf-connecting-ip":"1.2.3.4"},{"x-forwarded-for":"1.2.3.4"},{"x-forwarded-proto":"https"},{"x-real-ip":"1.2.3.4"}];for(const headers of cases) assert.throws(()=>authorizeBridge(req("http://127.0.0.1:8080/x",headers),"127.0.0.1"),/cannot use workstation/);
});
test("non-loopback hosts never get workstation access",()=>{
  delete process.env.BUNNY_REMOTE_ORIGIN;
  assert.throws(()=>authorizeBridge(req("http://192.168.1.2:8080/x"),"127.0.0.1"),/not configured/);
  process.env.BUNNY_REMOTE_ORIGIN="https://bunny.example.com";
  assert.deepEqual(authorizeBridge(req("https://bunny.example.com/x",{cookie:"bunny_device=abc"}),"127.0.0.1"),{local:false,token:"abc"});
  delete process.env.BUNNY_REMOTE_ORIGIN;
});
