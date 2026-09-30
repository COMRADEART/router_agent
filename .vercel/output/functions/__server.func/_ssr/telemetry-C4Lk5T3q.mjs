import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/telemetry-C4Lk5T3q.js
var readHostTelemetry_createServerFn_handler = createServerRpc({
	id: "6c801bbaf200668a6ac2fcaf83b9082401353e71bea593a1427840716f7312b0",
	name: "readHostTelemetry",
	filename: "src/lib/orch/telemetry.ts"
}, (opts) => readHostTelemetry.__executeServer(opts));
var readHostTelemetry = createServerFn({ method: "POST" }).handler(readHostTelemetry_createServerFn_handler, async () => {
	const { sampleHost } = await import("./telemetry.server-Cu3hYQWV.mjs");
	return sampleHost();
});
//#endregion
export { readHostTelemetry_createServerFn_handler };
