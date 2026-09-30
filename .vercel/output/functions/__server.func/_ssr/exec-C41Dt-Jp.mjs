import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/exec-C41Dt-Jp.js
var probeExecutors_createServerFn_handler = createServerRpc({
	id: "ee719e97cb1c2f46592c96c60e9ad04cce907dfdf128e1d421e820eb98ed69ee",
	name: "probeExecutors",
	filename: "src/lib/orch/exec.ts"
}, (opts) => probeExecutors.__executeServer(opts));
var probeExecutors = createServerFn({ method: "POST" }).handler(probeExecutors_createServerFn_handler, async () => {
	const { probeOllama } = await import("./exec.server-CM9VeM1e.mjs");
	return probeOllama();
});
var runExecutor_createServerFn_handler = createServerRpc({
	id: "ca4ea93a8e62b9678ee0ab232ce330e9f6256ab6c3e52cce4b1a02aa8606ad70",
	name: "runExecutor",
	filename: "src/lib/orch/exec.ts"
}, (opts) => runExecutor.__executeServer(opts));
var runExecutor = createServerFn({ method: "POST" }).validator((data) => data).handler(runExecutor_createServerFn_handler, async ({ data }) => {
	const { execute } = await import("./exec.server-CM9VeM1e.mjs");
	return execute(data);
});
var stopExecutor_createServerFn_handler = createServerRpc({
	id: "5d37d1cd111e5c99dc1dbc957b447d838099b030ede130419e599b8f45566555",
	name: "stopExecutor",
	filename: "src/lib/orch/exec.ts"
}, (opts) => stopExecutor.__executeServer(opts));
var stopExecutor = createServerFn({ method: "POST" }).validator((data) => data).handler(stopExecutor_createServerFn_handler, async ({ data }) => {
	const { stopTask } = await import("./exec.server-CM9VeM1e.mjs");
	return stopTask(data.taskId);
});
//#endregion
export { probeExecutors_createServerFn_handler, runExecutor_createServerFn_handler, stopExecutor_createServerFn_handler };
