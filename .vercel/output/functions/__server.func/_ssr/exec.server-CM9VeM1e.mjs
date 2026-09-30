//#region node_modules/.nitro/vite/services/ssr/assets/exec.server-CM9VeM1e.js
var inflight = /* @__PURE__ */ new Map();
var NOT_CONFIGURED = {
	codex: "Codex adapter is not configured. No Codex CLI or API credential is on this host. Usage unavailable.",
	claude: "Claude adapter is not configured. No Claude CLI or API credential is on this host. Usage unavailable.",
	cline: "Cline adapter is not installed. GUI automation is not used as a stand-in.",
	cursor: "Cursor adapter is not installed. GUI automation is not used as a stand-in."
};
async function probeOllama() {
	try {
		const response = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(800) });
		if (!response.ok) return {
			up: false,
			models: []
		};
		return {
			up: true,
			models: ((await response.json()).models ?? []).map((model) => model.name).filter((name) => !!name)
		};
	} catch {
		return {
			up: false,
			models: []
		};
	}
}
async function stopTask(taskId) {
	const controller = inflight.get(taskId);
	if (!controller) return { stopped: false };
	controller.abort();
	return { stopped: true };
}
async function execute(request) {
	if (request.provider !== "ollama") return {
		ok: false,
		error: NOT_CONFIGURED[request.provider] ?? "Provider adapter is not installed.",
		log: "Launch refused."
	};
	const probe = await probeOllama();
	if (!probe.up) return {
		ok: false,
		error: "Ollama is offline at 127.0.0.1:11434.",
		log: "Probe failed."
	};
	const model = probe.models.includes(request.model) ? request.model : probe.models[0];
	if (!model) return {
		ok: false,
		error: "Ollama is up but has no models.",
		log: "No model."
	};
	const controller = new AbortController();
	inflight.set(request.taskId, controller);
	try {
		const response = await fetch("http://127.0.0.1:11434/api/generate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				model,
				prompt: request.prompt,
				stream: false
			}),
			signal: controller.signal
		});
		if (!response.ok) return {
			ok: false,
			error: `Ollama returned HTTP ${response.status}.`,
			log: `POST /api/generate ${response.status}`
		};
		return {
			ok: true,
			output: (await response.json()).response ?? "",
			log: `Ollama ${model} finished.`
		};
	} catch (error) {
		if (controller.signal.aborted) return {
			ok: false,
			stopped: true,
			error: "Stopped.",
			log: "Abort."
		};
		const message = error instanceof Error ? error.message : "Ollama request failed.";
		return {
			ok: false,
			error: message,
			log: message
		};
	} finally {
		inflight.delete(request.taskId);
	}
}
//#endregion
export { execute, probeOllama, stopTask };
