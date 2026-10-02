import test from "node:test";
import assert from "node:assert/strict";
import {quotaWindows} from "./codex-probe.server.ts";
test("quota rings require actual values; missing windows remain unavailable",()=>{
  assert.deepEqual(quotaWindows(undefined),[]);assert.deepEqual(quotaWindows({primary:null,secondary:{windowDurationMins:10080}}),[]);
  assert.deepEqual(quotaWindows({primary:{usedPercent:0,windowDurationMins:300,resetsAt:100},secondary:{usedPercent:61,windowDurationMins:10080,resetsAt:null}}),[{label:"5 hour window",usedPercent:0,resetsAt:100000},{label:"Weekly",usedPercent:61,resetsAt:null}]);
});
