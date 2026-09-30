import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BqI0BKO9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var readHostTelemetry = createServerFn({ method: "POST" }).handler(createSsrRpc("6c801bbaf200668a6ac2fcaf83b9082401353e71bea593a1427840716f7312b0"));
var probeExecutors = createServerFn({ method: "POST" }).handler(createSsrRpc("ee719e97cb1c2f46592c96c60e9ad04cce907dfdf128e1d421e820eb98ed69ee"));
var runExecutor = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("ca4ea93a8e62b9678ee0ab232ce330e9f6256ab6c3e52cce4b1a02aa8606ad70"));
var stopExecutor = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("5d37d1cd111e5c99dc1dbc957b447d838099b030ede130419e599b8f45566555"));
var NEXT = {
	queued: ["routing", "stopped"],
	routing: [
		"waiting_for_approval",
		"failed",
		"stopped"
	],
	waiting_for_approval: ["launching", "stopped"],
	launching: [
		"running",
		"failed",
		"stopped"
	],
	running: [
		"completed",
		"failed",
		"stopped",
		"paused",
		"waiting_for_input"
	],
	waiting_for_input: [
		"running",
		"stopped",
		"failed"
	],
	paused: ["running", "stopped"],
	completed: [],
	failed: [],
	stopped: []
};
function canTransition(from, to) {
	return NEXT[from].includes(to);
}
var CAP = {
	codex: {
		coding: .95,
		debug: .92,
		research: .72,
		writing: .6,
		ops: .7,
		general: .74,
		context: .9,
		speed: .42,
		local: false
	},
	claude: {
		coding: .86,
		debug: .84,
		research: .95,
		writing: .9,
		ops: .66,
		general: .88,
		context: .92,
		speed: .4,
		local: false
	},
	ollama: {
		coding: .58,
		debug: .52,
		research: .48,
		writing: .55,
		ops: .5,
		general: .56,
		context: .45,
		speed: .9,
		local: true
	},
	cline: {
		coding: .84,
		debug: .8,
		research: .5,
		writing: .4,
		ops: .6,
		general: .6,
		context: .7,
		speed: .5,
		local: false
	},
	cursor: {
		coding: .9,
		debug: .88,
		research: .55,
		writing: .45,
		ops: .62,
		general: .64,
		context: .78,
		speed: .52,
		local: false
	}
};
function clamp(n, lo = 0, hi = 1) {
	return Math.min(hi, Math.max(lo, n));
}
function analyze(prompt, mode) {
	const text = prompt.toLowerCase();
	const coding = /code|implement|refactor|test|bug|repo|function|typescript|debug|api|harness/.test(text);
	const research = /research|compare|paper|explain|summar|why|analy/.test(text);
	const writing = /write|draft|email|docs?\b|readme/.test(text);
	const ops = /deploy|docker|install|server|infra/.test(text);
	let task_type = "general";
	if (coding && /debug|bug|failing|error|broken/.test(text)) task_type = "debug";
	else if (coding) task_type = "coding";
	else if (research) task_type = "research";
	else if (writing) task_type = "writing";
	else if (ops) task_type = "ops";
	const complexity = clamp(.22 + Math.min(.3, prompt.length / 900) + (coding ? .12 : 0) + (/repo|distributed|harness|architecture|migration|suite/.test(text) ? .28 : 0) + (/typo|rename|one line|simple|quick/.test(text) ? -.22 : 0));
	const privacy_priority = /private|local only|offline|secret|on this machine|don't send|do not send/.test(text) ? .86 : .28;
	return {
		task_type,
		complexity,
		latency_priority: mode === "fast" ? .86 : mode === "balanced" ? .5 : .22,
		privacy_priority,
		context_requirement: complexity > .68 ? "high" : complexity > .4 ? "medium" : "low"
	};
}
function weights(mode) {
	if (mode === "fast") return {
		fit: .22,
		speed: .4,
		local: .28,
		context: .1
	};
	if (mode === "deep") return {
		fit: .48,
		speed: .05,
		local: .07,
		context: .4
	};
	return {
		fit: .4,
		speed: .22,
		local: .13,
		context: .25
	};
}
function availabilityFactor(live) {
	if (live.availability === "offline" || live.availability === "unavailable") return .32;
	if (live.availability === "rate_limited") return .45;
	if (live.availability === "busy") return .62;
	if (live.availability === "auth_required") return .78;
	return 1;
}
function scoreProvider(id, prompt, mode, live) {
	const features = analyze(prompt, mode);
	const cap = CAP[id];
	const fit = cap[features.task_type];
	const w = weights(mode);
	const contextBoost = features.context_requirement === "high" ? 1 : features.context_requirement === "medium" ? .72 : .5;
	let score = fit * w.fit + cap.speed * w.speed + (cap.local ? 1 : 0) * w.local * (.35 + features.privacy_priority) + cap.context * w.context * contextBoost;
	if (mode === "deep" && features.complexity > .6) score += cap.context * .15 + fit * .1;
	if (mode === "fast" && features.complexity < .4) score += cap.speed * .08 + (cap.local ? .1 : 0);
	if (features.privacy_priority > .7 && !cap.local) score -= .1;
	if (features.privacy_priority > .7 && cap.local) score += .08;
	score *= availabilityFactor(live);
	score -= Math.min(.18, live.active_jobs * .05);
	return score;
}
function noteFor(id, winner, live) {
	if (id === winner) return "Selected";
	if (live.availability === "offline") return "Offline on this host";
	if (live.availability === "auth_required") return "Suitable, but this host has no credential yet";
	if (live.availability === "unavailable") return "Adapter is not installed";
	if (CAP[id].local && !CAP[winner].local) return "Local and faster, weaker fit for this task";
	if (!CAP[id].local && CAP[winner].local) return "Stronger model, higher latency, leaves the machine";
	if (CAP[id].context > CAP[winner].context) return "More context headroom, lower task fit";
	return "Lower score on this task, mode, and host state";
}
function routeTask(input) {
	const features = analyze(input.prompt, input.mode);
	const ranked = input.providers.filter((provider) => !provider.extension || provider.installed).map((provider) => ({
		provider: provider.id,
		score: scoreProvider(provider.id, input.prompt, input.mode, provider),
		live: provider
	})).sort((a, b) => b.score - a.score);
	const auto = ranked[0];
	const chosenId = input.override && input.override !== "auto" ? input.override : auto?.provider ?? "ollama";
	const chosen = ranked.find((row) => row.provider === chosenId) ?? ranked[0];
	const second = ranked.find((row) => row.provider !== chosen?.provider);
	const confidence = clamp(.58 + (chosen && second ? chosen.score - second.score : .2) * 1.4);
	const live = input.providers.find((provider) => provider.id === chosenId);
	const fit = CAP[chosenId][features.task_type];
	const reason = [
		input.override && input.override !== "auto" ? "Manual override." : "Auto route.",
		`${features.task_type} task, complexity ${features.complexity.toFixed(2)}, mode ${input.mode}.`,
		CAP[chosenId].local ? "Stays on this machine." : "Cloud executor.",
		live?.availability === "ready" ? "Provider is ready." : `Provider status: ${live?.availability ?? "unknown"}.`,
		fit >= .85 ? "Strong fit for this task type." : "Best available tradeoff of fit, latency, and privacy."
	].join(" ");
	return {
		...features,
		recommended_provider: chosenId,
		recommended_model: live?.current_model ?? "auto",
		confidence,
		reason,
		alternatives: ranked.filter((row) => row.provider !== chosenId).slice(0, 3).map((row) => ({
			provider: row.provider,
			score: Number(row.score.toFixed(3)),
			note: noteFor(row.provider, chosenId, row.live)
		})),
		scores: ranked.map((row) => ({
			provider: row.provider,
			score: Number(row.score.toFixed(3))
		}))
	};
}
var KEY = "jev.island.v1";
var ACTIVE = [
	"queued",
	"routing",
	"waiting_for_approval",
	"launching",
	"running",
	"waiting_for_input",
	"paused"
];
function load() {
	if (typeof localStorage === "undefined") return {};
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "null") ?? {};
	} catch {
		return {};
	}
}
function save(state) {
	const payload = {
		theme: state.theme,
		projects: state.projects,
		tasks: state.tasks.slice(0, 40),
		drafts: state.drafts,
		extensions: state.extensions,
		autoSubmit: state.autoSubmit,
		cpuWarn: state.cpuWarn,
		gpuWarn: state.gpuWarn,
		audit: state.audit.slice(0, 80)
	};
	localStorage.setItem(KEY, JSON.stringify(payload));
}
function titleOf(prompt) {
	const line = prompt.trim().split("\n")[0] ?? "Task";
	return line.length > 42 ? `${line.slice(0, 41)}…` : line || "Task";
}
function withState(task, state, patch = {}) {
	if (!canTransition(task.state, state) && task.state !== state) return task;
	return {
		...task,
		...patch,
		state
	};
}
function liveProviders(state) {
	const jobs = (id) => state.tasks.filter((task) => task.provider === id && ACTIVE.includes(task.state)).length;
	const base = (id, name, cloud, extension) => ({
		id,
		name,
		availability: "unavailable",
		installed: false,
		authenticated: false,
		local_or_cloud: cloud ? "cloud" : "local",
		supported_task_types: [
			"coding",
			"debug",
			"research",
			"writing",
			"ops",
			"general"
		],
		current_model: null,
		usage: null,
		usage_note: "Usage unavailable",
		active_jobs: jobs(id),
		latency_estimate_ms: null,
		extension,
		detail: "Adapter is not configured on this host.",
		vram: null,
		tokens_per_sec: null
	});
	const ollama = base("ollama", "Ollama", false, false);
	if (state.ollamaUp) {
		ollama.availability = jobs("ollama") > 0 ? "busy" : "ready";
		ollama.installed = true;
		ollama.authenticated = true;
		ollama.current_model = state.ollamaModels[0] ?? null;
		ollama.usage_note = "Local — no quota meter";
		ollama.latency_estimate_ms = 500;
		ollama.detail = state.ollamaModels.length ? state.ollamaModels.join(", ") : "Running, no model pulled.";
		ollama.vram = null;
	} else {
		ollama.availability = "offline";
		ollama.detail = "Offline at 127.0.0.1:11434.";
		ollama.usage_note = "Local — offline";
	}
	const codex = base("codex", "Codex", true, false);
	codex.availability = "auth_required";
	codex.detail = "No Codex credential on this host. Usage unavailable.";
	const claude = base("claude", "Claude", true, false);
	claude.availability = "auth_required";
	claude.detail = "No Claude credential on this host. Usage unavailable.";
	const cline = base("cline", "Cline", true, true);
	cline.installed = false;
	cline.detail = state.extensions.cline ? "Extension slot is on. No Cline adapter is installed." : "Extension is off.";
	const cursor = base("cursor", "Cursor", true, true);
	cursor.detail = state.extensions.cursor ? "Extension slot is on. No Cursor adapter is installed." : "Extension is off.";
	return [
		codex,
		claude,
		ollama,
		cline,
		cursor
	];
}
var useIsland = create((set, get) => ({
	theme: "dark",
	projects: [],
	tasks: [],
	drafts: [],
	extensions: {
		cline: false,
		cursor: false
	},
	autoSubmit: false,
	cpuWarn: 90,
	gpuWarn: 85,
	audit: [],
	sheet: null,
	providerFocus: null,
	decisionTaskId: null,
	prompt: "",
	mode: "balanced",
	autoRoute: true,
	override: "auto",
	projectId: null,
	host: "online",
	samples: [],
	ollamaUp: false,
	ollamaModels: [],
	notice: null,
	filter: "all",
	hydrated: false,
	hydrate: () => {
		if (get().hydrated) return;
		const loaded = load();
		const tasks = (loaded.tasks ?? []).map((task) => task.state === "running" || task.state === "launching" ? {
			...task,
			state: "failed",
			error: "The host restarted before this executor returned.",
			finishedAt: task.finishedAt ?? Date.now()
		} : task);
		set({
			...loaded,
			tasks,
			hydrated: true
		});
	},
	setSheet: (sheet) => set({ sheet }),
	setTheme: (theme) => {
		set({ theme });
		save(get());
	},
	setPrompt: (prompt) => set({ prompt }),
	setMode: (mode) => set({ mode }),
	setAutoRoute: (autoRoute) => set({
		autoRoute,
		override: autoRoute ? "auto" : get().override
	}),
	setOverride: (override) => set({
		override,
		autoRoute: override === "auto"
	}),
	setProjectId: (projectId) => set({ projectId }),
	setProviderFocus: (providerFocus) => set({
		providerFocus,
		sheet: "provider"
	}),
	setFilter: (filter) => set({ filter }),
	setHost: (host) => {
		set({ host });
		get().note(host === "online" ? "Workstation is online." : "Workstation is sleeping. New phone tasks stay queued.");
		if (host === "online" && get().autoSubmit) get().sendDrafts();
	},
	setAutoSubmit: (autoSubmit) => {
		set({ autoSubmit });
		save(get());
		if (autoSubmit && get().host === "online") get().sendDrafts();
	},
	setCpuWarn: (cpuWarn) => {
		set({ cpuWarn });
		save(get());
	},
	setGpuWarn: (gpuWarn) => {
		set({ gpuWarn });
		save(get());
	},
	setExtension: (id, on) => {
		set({ extensions: {
			...get().extensions,
			[id]: on
		} });
		save(get());
		get().note(`${id} extension slot ${on ? "on" : "off"}.`);
	},
	addProject: (name, path) => {
		const project = {
			id: crypto.randomUUID(),
			name: name.trim(),
			path: path.trim(),
			preferred: "auto"
		};
		if (!project.name || !project.path) return;
		set({ projects: [project, ...get().projects] });
		save(get());
		get().note(`Project ${project.name} registered. No disk scan.`);
	},
	removeProject: (id) => {
		set({ projects: get().projects.filter((project) => project.id !== id) });
		save(get());
	},
	dismissNotice: () => set({ notice: null }),
	note: (line) => {
		set({
			audit: [{
				at: Date.now(),
				line
			}, ...get().audit].slice(0, 80),
			notice: line
		});
		save(get());
	},
	refreshOllama: async () => {
		try {
			const probe = await probeExecutors();
			set({
				ollamaUp: probe.up,
				ollamaModels: probe.models
			});
		} catch {
			set({
				ollamaUp: false,
				ollamaModels: []
			});
		}
	},
	pushSample: (sample) => {
		set({ samples: [...get().samples, sample].slice(-60) });
		const cpu = sample.cpu.temperatureC;
		const hotGpu = sample.gpus.find((gpu) => gpu.temperatureC != null && gpu.temperatureC >= get().gpuWarn);
		if (cpu != null && cpu >= get().cpuWarn) get().note(`Thermal warning. CPU ${cpu}°C.`);
		if (hotGpu?.temperatureC != null) get().note(`Thermal warning. ${hotGpu.name} ${hotGpu.temperatureC}°C.`);
	},
	submit: () => {
		const { prompt, mode, projectId, host, autoRoute, override } = get();
		const text = prompt.trim();
		if (!text) return;
		if (host === "sleeping") {
			set({
				drafts: [{
					id: crypto.randomUUID(),
					prompt: text,
					mode,
					projectId,
					createdAt: Date.now()
				}, ...get().drafts],
				prompt: "",
				sheet: "tasks"
			});
			get().note(get().autoSubmit ? "Queued until the workstation is online." : "Queued. Auto-send is off.");
			return;
		}
		const decision = routeTask({
			prompt: text,
			mode,
			providers: liveProviders(get()),
			override: autoRoute ? "auto" : override
		});
		const task = {
			id: crypto.randomUUID(),
			title: titleOf(text),
			prompt: text,
			projectId,
			mode,
			state: "waiting_for_approval",
			provider: decision.recommended_provider,
			model: decision.recommended_model,
			decision,
			manual: !autoRoute && override !== "auto",
			createdAt: Date.now(),
			startedAt: null,
			finishedAt: null,
			output: "",
			error: null,
			logs: [{
				at: Date.now(),
				line: "Routed. Waiting for approval."
			}],
			pauseSupported: false
		};
		set({
			tasks: [task, ...get().tasks],
			prompt: "",
			decisionTaskId: task.id,
			sheet: "decision"
		});
		save(get());
		get().note(`Route ${task.title} → ${decision.recommended_provider}.`);
	},
	sendDrafts: () => {
		const drafts = get().drafts;
		if (!drafts.length || get().host !== "online") return;
		set({ drafts: [] });
		for (const draft of drafts) {
			set({
				prompt: draft.prompt,
				mode: draft.mode,
				projectId: draft.projectId,
				autoRoute: true,
				override: "auto"
			});
			get().submit();
		}
	},
	run: async (id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task || !canTransition(task.state, "launching")) return;
		const launching = withState(task, "launching", {
			startedAt: Date.now(),
			logs: [...task.logs, {
				at: Date.now(),
				line: `Launching ${task.provider}.`
			}]
		});
		set({ tasks: get().tasks.map((item) => item.id === id ? launching : item) });
		const running = withState(launching, "running", { logs: [...launching.logs, {
			at: Date.now(),
			line: "Running."
		}] });
		set({ tasks: get().tasks.map((item) => item.id === id ? running : item) });
		const result = await runExecutor({ data: {
			taskId: id,
			provider: task.provider,
			model: task.model,
			prompt: task.prompt
		} });
		const current = get().tasks.find((item) => item.id === id);
		if (!current || current.state === "stopped") return;
		if (result.stopped) set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "stopped", {
			finishedAt: Date.now(),
			logs: [...item.logs, {
				at: Date.now(),
				line: result.log
			}]
		}) : item) });
		else if (result.ok) {
			set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "completed", {
				finishedAt: Date.now(),
				output: result.output ?? "",
				logs: [...item.logs, {
					at: Date.now(),
					line: result.log
				}]
			}) : item) });
			get().note(`${current.title} completed.`);
		} else {
			set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "failed", {
				finishedAt: Date.now(),
				error: result.error ?? "Failed.",
				logs: [...item.logs, {
					at: Date.now(),
					line: result.log
				}]
			}) : item) });
			get().note(result.error ?? "Task failed.");
		}
		save(get());
	},
	stop: async (id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task || !canTransition(task.state, "stopped")) return;
		await stopExecutor({ data: { taskId: id } }).catch(() => void 0);
		set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "stopped", {
			finishedAt: Date.now(),
			logs: [...item.logs, {
				at: Date.now(),
				line: "Stopped this task only."
			}]
		}) : item) });
		save(get());
		get().note(`Stopped ${task.title}.`);
	},
	pause: (id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task) return;
		if (!task.pauseSupported) {
			get().note("Pause is not supported by this executor. Stop ends only this task.");
			return;
		}
		if (!canTransition(task.state, "paused")) return;
		set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "paused") : item) });
		save(get());
	},
	resume: (id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task || !canTransition(task.state, "running")) return;
		set({ tasks: get().tasks.map((item) => item.id === id ? withState(item, "running") : item) });
		save(get());
	},
	restart: (id) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task) return;
		set({
			prompt: task.prompt,
			mode: task.mode,
			projectId: task.projectId,
			autoRoute: !task.manual,
			override: task.manual ? task.provider : "auto"
		});
		get().submit();
	},
	retarget: (id, provider) => {
		const task = get().tasks.find((item) => item.id === id);
		if (!task || task.state !== "waiting_for_approval") return;
		const providers = liveProviders(get());
		const decision = routeTask({
			prompt: task.prompt,
			mode: task.mode,
			providers,
			override: provider
		});
		set({ tasks: get().tasks.map((item) => item.id === id ? {
			...item,
			provider,
			model: decision.recommended_model,
			decision,
			manual: true,
			logs: [...item.logs, {
				at: Date.now(),
				line: `Changed executor to ${provider}.`
			}]
		} : item) });
		save(get());
	},
	openDecision: (id) => set({
		decisionTaskId: id,
		sheet: "decision"
	})
}));
function activeTasks(tasks) {
	return tasks.filter((task) => ACTIVE.includes(task.state));
}
function Phone() {
	const setSheet = useIsland((state) => state.setSheet);
	const tasks = useIsland((state) => state.tasks);
	const samples = useIsland((state) => state.samples);
	const host = useIsland((state) => state.host);
	const setHost = useIsland((state) => state.setHost);
	const autoSubmit = useIsland((state) => state.autoSubmit);
	const setAutoSubmit = useIsland((state) => state.setAutoSubmit);
	const ollamaUp = useIsland((state) => state.ollamaUp);
	const ollamaModels = useIsland((state) => state.ollamaModels);
	const extensions = useIsland((state) => state.extensions);
	const prompt = useIsland((state) => state.prompt);
	const setPrompt = useIsland((state) => state.setPrompt);
	const mode = useIsland((state) => state.mode);
	const setMode = useIsland((state) => state.setMode);
	const submit = useIsland((state) => state.submit);
	const openDecision = useIsland((state) => state.openDecision);
	const latest = samples[samples.length - 1];
	const providers = liveProviders({
		tasks,
		ollamaUp,
		ollamaModels,
		extensions
	}).filter((provider) => !provider.extension);
	const running = activeTasks(tasks);
	const [composing, setComposing] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 overflow-auto bg-[#f2f2f7] text-[#1d1d1f]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex items-start justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-[#6e6e73]",
							children: "Workstation"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "text-[34px] leading-none font-bold tracking-tight",
							children: "My laptop"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[15px] text-[#248a3d]",
							children: host === "sleeping" ? "Sleeping" : "Online"
						})
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSheet(null),
						className: "tap min-h-11 text-[17px] text-[#007aff]",
						children: "Desktop"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-[#6e6e73]",
					children: "Remote TLS is not configured. This companion shares the workstation session in this browser. Provider secrets are not on the phone."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-2xl bg-white px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[13px] text-[#6e6e73]",
							children: ["CPU ", latest?.cpu.utilization == null ? "—" : `${latest.cpu.utilization}%`]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-[#6e6e73]",
							children: "Temperature unavailable"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-[13px] text-[#6e6e73]",
							children: ["RAM ", latest ? `${Math.round(latest.memory.usedBytes / latest.memory.totalBytes * 100)}%` : "—"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] text-[#6e6e73]",
							children: "No GPU telemetry on this host"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-2 px-1 text-[13px] text-[#6e6e73]",
					children: "Providers"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "overflow-hidden rounded-2xl bg-white",
					children: providers.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex min-h-12 items-center justify-between border-b border-black/10 px-4 last:border-b-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[17px]",
							children: provider.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[15px] text-[#6e6e73]",
							children: provider.usage_note
						})]
					}, provider.id))
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "mb-2 px-1 text-[13px] text-[#6e6e73]",
						children: "Active tasks"
					}),
					running.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-1 text-[15px] text-[#6e6e73]",
						children: "None."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "overflow-hidden rounded-2xl bg-white",
						children: running.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => openDecision(task.id),
							className: "tap flex min-h-12 w-full items-center justify-between px-4 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-[17px]",
								children: task.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[13px] capitalize text-[#6e6e73]",
								children: task.provider
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[13px] capitalize text-[#6e6e73]",
								children: task.state.replaceAll("_", " ")
							})]
						}) }, task.id))
					})
				] }),
				composing ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					className: "flex flex-col gap-3 rounded-2xl bg-white p-4",
					onSubmit: (event) => {
						event.preventDefault();
						submit();
						setComposing(false);
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-[13px] text-[#6e6e73]",
							children: ["New task", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: prompt,
								onChange: (event) => setPrompt(event.target.value),
								rows: 4,
								className: "mt-2 w-full text-[17px] text-[#1d1d1f] outline-none"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex gap-2",
							children: [
								"fast",
								"balanced",
								"deep"
							].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setMode(item),
								className: "tap min-h-11 flex-1 rounded-full text-[13px] capitalize",
								style: {
									background: mode === item ? "#007aff" : "#e5e5ea",
									color: mode === item ? "#fff" : "#1d1d1f"
								},
								children: item
							}, item))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "submit",
							className: "tap min-h-11 rounded-full bg-[#007aff] text-[17px] text-white",
							children: "Submit"
						})
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setComposing(true),
					className: "tap min-h-12 rounded-2xl bg-[#007aff] text-[17px] font-medium text-white",
					children: "New task"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex min-h-11 items-center justify-between text-[15px]",
					children: ["Workstation sleeping", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: host === "sleeping",
						onChange: (event) => setHost(event.target.checked ? "sleeping" : "online")
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex min-h-11 items-center justify-between text-[15px]",
					children: ["Auto-send queue when online", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "checkbox",
						checked: autoSubmit,
						onChange: (event) => setAutoSubmit(event.target.checked)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "pb-6 text-[13px] text-[#6e6e73]",
					children: "Push notifications are not configured. Alerts stay in this session."
				})
			]
		})
	});
}
var STATUS = {
	ready: "Ready",
	busy: "Busy",
	offline: "Offline",
	unavailable: "Unavailable",
	rate_limited: "Rate limited",
	auth_required: "Authentication required"
};
var DOT = {
	ready: "#30d158",
	busy: "#ff9f0a",
	offline: "#8e8e93",
	unavailable: "#8e8e93",
	rate_limited: "#ff9f0a",
	auth_required: "#ff453a"
};
function elapsed(task, now) {
	const end = task.finishedAt ?? now;
	const start = task.startedAt ?? task.createdAt;
	const seconds = Math.max(0, Math.floor((end - start) / 1e3));
	return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function gb(bytes) {
	return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
function Spark({ values }) {
	if (values.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[13px] text-[var(--muted)]",
		children: "Waiting for samples."
	});
	const w = 280;
	const h = 36;
	const max = Math.max(100, ...values);
	const points = values.map((value, index) => {
		const x = index / (values.length - 1) * w;
		const y = h - value / max * 34 - 1;
		return `${x.toFixed(1)},${y.toFixed(1)}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: `0 0 ${w} ${h}`,
		className: "mt-1 h-9 w-full text-[var(--accent)]",
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", {
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			points
		})
	});
}
function Island() {
	const hydrate = useIsland((state) => state.hydrate);
	const theme = useIsland((state) => state.theme);
	const sheet = useIsland((state) => state.sheet);
	useIsland((state) => state.setSheet);
	const tasks = useIsland((state) => state.tasks);
	const notice = useIsland((state) => state.notice);
	const dismissNotice = useIsland((state) => state.dismissNotice);
	const refreshOllama = useIsland((state) => state.refreshOllama);
	const pushSample = useIsland((state) => state.pushSample);
	const ollamaUp = useIsland((state) => state.ollamaUp);
	const ollamaModels = useIsland((state) => state.ollamaModels);
	const extensions = useIsland((state) => state.extensions);
	const [now, setNow] = (0, import_react.useState)(() => Date.now());
	(0, import_react.useEffect)(() => {
		hydrate();
	}, [hydrate]);
	(0, import_react.useEffect)(() => {
		refreshOllama();
		const id = window.setInterval(() => void refreshOllama(), 15e3);
		return () => window.clearInterval(id);
	}, [refreshOllama]);
	(0, import_react.useEffect)(() => {
		let stop = false;
		const tick = async () => {
			try {
				const sample = await readHostTelemetry();
				if (!stop) pushSample(sample);
			} catch {}
		};
		tick();
		const id = window.setInterval(() => void tick(), 2e3);
		return () => {
			stop = true;
			window.clearInterval(id);
		};
	}, [pushSample]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1e3);
		return () => window.clearInterval(id);
	}, []);
	const providers = liveProviders({
		tasks,
		ollamaUp,
		ollamaModels,
		extensions
	});
	const running = activeTasks(tasks);
	const open = sheet != null && sheet !== "phone";
	if (sheet === "phone") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, {});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 overflow-auto",
		style: theme === "dark" ? {
			"--glass": "#2c2c2e",
			"--glass-line": "rgba(255,255,255,0.14)",
			"--fg": "#f5f5f7",
			"--muted": "#98989d",
			"--accent": "#0a84ff",
			"--field": "rgba(255,255,255,0.06)",
			background: "#1c1c1e",
			color: "#f5f5f7"
		} : {
			"--glass": "#ffffff",
			"--glass-line": "rgba(0,0,0,0.08)",
			"--fg": "#1d1d1f",
			"--muted": "#6e6e73",
			"--accent": "#007aff",
			"--field": "rgba(0,0,0,0.04)",
			background: "#d2d2d7",
			color: "#1d1d1f"
		},
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-[min(860px,calc(100%-20px))] pt-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: `glass ${open ? "rounded-[28px]" : "rounded-full"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
						providers,
						running,
						now
					}), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-h-[min(70vh,640px)] overflow-auto border-t border-[var(--glass-line)] px-4 py-4",
						children: [
							sheet === "compose" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Composer, {}) : null,
							sheet === "decision" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Decision, {}) : null,
							sheet === "provider" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProviderPanel, { providers }) : null,
							sheet === "system" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SystemPanel, {}) : null,
							sheet === "tasks" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tasks, { now }) : null,
							sheet === "extensions" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Extensions, { providers }) : null,
							sheet === "project" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Projects, {}) : null
						]
					}) : null]
				}),
				!open && running.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-4 text-center text-[13px] text-[var(--muted)]",
					children: "JEV routes the task. It does not write the answer."
				}) : null,
				notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: dismissNotice,
					className: "glass mx-auto mt-3 block max-w-md rounded-2xl px-4 py-3 text-left text-[13px]",
					children: notice
				}) : null
			]
		})
	});
}
function Bar({ providers, running, now }) {
	const setSheet = useIsland((state) => state.setSheet);
	const sheet = useIsland((state) => state.sheet);
	const setProviderFocus = useIsland((state) => state.setProviderFocus);
	const primary = providers.filter((provider) => !provider.extension);
	const one = running.length === 1 ? running[0] : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-wrap items-center gap-1 px-2 py-1.5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setSheet(sheet === "compose" ? null : "compose"),
				className: "tap min-h-11 rounded-full px-3 text-[15px] font-semibold",
				children: "JEV"
			}),
			one ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSheet("tasks"),
				className: "tap flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 text-left",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-[15px] font-medium",
						children: one.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[13px] text-[var(--muted)]",
						children: providers.find((provider) => provider.id === one.provider)?.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[13px] capitalize text-[var(--muted)]",
						children: one.state.replaceAll("_", " ")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto text-[13px] tabular-nums",
						children: elapsed(one, now)
					})
				]
			}) : running.length > 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setSheet("tasks"),
				className: "tap min-h-11 flex-1 px-2 text-left text-[15px]",
				children: [running.length, " tasks running"]
			}) : primary.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setProviderFocus(provider.id),
				className: "tap inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[14px] font-medium",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "size-1.5 rounded-full",
					style: { background: DOT[provider.availability] }
				}), provider.name]
			}, provider.id)),
			one && (one.state === "running" || one.state === "launching") ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mx-2 h-1 w-full overflow-hidden rounded-full bg-[var(--field)] sm:order-last sm:w-28",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "indeterminate h-full bg-[var(--accent)]" })
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ml-auto flex items-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Extensions",
						onClick: () => setSheet(sheet === "extensions" ? null : "extensions"),
						className: "tap min-h-11 min-w-11 rounded-full text-[20px] leading-none",
						children: "+"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSheet(sheet === "system" ? null : "system"),
						className: "tap min-h-11 rounded-full px-2.5 text-[14px]",
						children: "System"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSheet("phone"),
						className: "tap min-h-11 rounded-full px-2.5 text-[14px]",
						children: "Phone"
					})
				]
			})
		]
	});
}
function Composer() {
	const prompt = useIsland((state) => state.prompt);
	const mode = useIsland((state) => state.mode);
	const autoRoute = useIsland((state) => state.autoRoute);
	const override = useIsland((state) => state.override);
	const projectId = useIsland((state) => state.projectId);
	const projects = useIsland((state) => state.projects);
	const setPrompt = useIsland((state) => state.setPrompt);
	const setMode = useIsland((state) => state.setMode);
	const setAutoRoute = useIsland((state) => state.setAutoRoute);
	const setOverride = useIsland((state) => state.setOverride);
	const setProjectId = useIsland((state) => state.setProjectId);
	const setSheet = useIsland((state) => state.setSheet);
	const submit = useIsland((state) => state.submit);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex flex-col gap-4",
		onSubmit: (event) => {
			event.preventDefault();
			submit();
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-2 text-[13px] text-[var(--muted)]",
				children: ["What do you want done?", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					value: prompt,
					onChange: (event) => setPrompt(event.target.value),
					rows: 4,
					className: "min-h-28 w-full resize-y rounded-2xl bg-[var(--field)] px-3 py-3 text-[17px] text-[var(--fg)] outline-none"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				role: "group",
				"aria-label": "Mode",
				children: [
					"fast",
					"balanced",
					"deep"
				].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": mode === item,
					onClick: () => setMode(item),
					className: "tap min-h-11 rounded-full px-4 text-[15px] capitalize",
					style: {
						background: mode === item ? "var(--accent)" : "var(--field)",
						color: mode === item ? "#fff" : "var(--fg)"
					},
					children: item
				}, item))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-11 items-center justify-between text-[15px]",
				children: ["Auto route", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: autoRoute,
					onChange: (event) => setAutoRoute(event.target.checked)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-1 text-[13px] text-[var(--muted)]",
				children: ["Provider override", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: override,
					"aria-label": "Provider override",
					disabled: autoRoute,
					onChange: (event) => setOverride(event.target.value),
					className: "min-h-11 rounded-xl bg-[var(--field)] px-3 text-[15px] text-[var(--fg)] disabled:opacity-50",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "auto",
						children: "Auto"
					}), [
						"codex",
						"claude",
						"ollama",
						"cline",
						"cursor"
					].map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: id,
						children: id
					}, id))]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex flex-col gap-1 text-[13px] text-[var(--muted)]",
				children: ["Project", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: projectId ?? "",
					"aria-label": "Project",
					onChange: (event) => setProjectId(event.target.value || null),
					className: "min-h-11 rounded-xl bg-[var(--field)] px-3 text-[15px] text-[var(--fg)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: "",
						children: "None"
					}), projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: project.id,
						children: project.name
					}, project.id))]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "tap min-h-11 flex-1 rounded-full bg-[var(--accent)] text-[15px] font-medium text-white",
					children: "Route"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setSheet("project"),
					className: "tap min-h-11 rounded-full px-4 text-[15px] text-[var(--accent)]",
					children: "Projects"
				})]
			})
		]
	});
}
function Decision() {
	const id = useIsland((state) => state.decisionTaskId);
	const task = useIsland((state) => state.tasks.find((item) => item.id === id));
	const run = useIsland((state) => state.run);
	const stop = useIsland((state) => state.stop);
	const retarget = useIsland((state) => state.retarget);
	const setSheet = useIsland((state) => state.setSheet);
	const [changing, setChanging] = (0, import_react.useState)(false);
	if (!task) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-[15px] text-[var(--muted)]",
		children: "No decision open."
	});
	const decision = task.decision;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[17px] font-semibold",
				children: task.title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "JEV router"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[15px]",
				children: [
					decision.task_type,
					" · complexity ",
					decision.complexity.toFixed(2),
					" · ",
					task.mode
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[20px] font-semibold capitalize",
				children: task.provider
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[15px] text-[var(--muted)]",
				children: decision.reason
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[13px] tabular-nums text-[var(--muted)]",
				children: [
					"Confidence ",
					Math.round(decision.confidence * 100),
					"%"
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				children: decision.alternatives.map((alt) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "text-[14px]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "capitalize",
						children: alt.provider
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-[var(--muted)]",
						children: [" — ", alt.note]
					})]
				}, alt.provider))
			}),
			changing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					"codex",
					"claude",
					"ollama",
					"cline",
					"cursor"
				].map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						retarget(task.id, provider);
						setChanging(false);
					},
					className: "tap min-h-11 rounded-full bg-[var(--field)] px-3 text-[14px] capitalize",
					children: provider
				}, provider))
			}) : null,
			task.state === "waiting_for_approval" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void run(task.id),
						className: "tap min-h-11 rounded-full bg-[var(--accent)] px-5 text-[15px] font-medium text-white",
						children: "Run"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setChanging((value) => !value),
						className: "tap min-h-11 rounded-full px-4 text-[15px] text-[var(--accent)]",
						children: "Change"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void stop(task.id),
						className: "tap min-h-11 rounded-full px-4 text-[15px] text-[var(--muted)]",
						children: "Cancel"
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[15px] capitalize",
						children: task.state.replaceAll("_", " ")
					}),
					task.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[15px] text-[var(--muted)]",
						children: task.error
					}) : null,
					task.output ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "max-h-48 overflow-auto whitespace-pre-wrap text-[13px]",
						children: task.output
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setSheet("tasks"),
						className: "tap min-h-11 self-start text-[15px] text-[var(--accent)]",
						children: "Tasks"
					})
				]
			})
		]
	});
}
function ProviderPanel({ providers }) {
	const id = useIsland((state) => state.providerFocus);
	const provider = providers.find((item) => item.id === id);
	const tasks = useIsland((state) => state.tasks.filter((task) => task.provider === id).slice(0, 5));
	const setSheet = useIsland((state) => state.setSheet);
	const setOverride = useIsland((state) => state.setOverride);
	if (!provider) return null;
	const blocks = provider.usage ? Math.round(provider.usage.percent / 12.5) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-2 text-[15px]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[20px] font-semibold",
				children: provider.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mr-2 inline-block size-1.5 rounded-full align-middle",
				style: { background: DOT[provider.availability] }
			}), STATUS[provider.availability]] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[var(--muted)]",
				children: provider.local_or_cloud === "local" ? "Local" : "Cloud"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Model: ", provider.current_model ?? "Unavailable"] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
				"Usage: ",
				provider.usage ? `${provider.usage.label} ${provider.usage.percent}%` : provider.usage_note,
				provider.usage?.reset ? ` · resets ${provider.usage.reset}` : ""
			] }),
			provider.usage ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "tracking-[0.2em]",
				children: `${"■".repeat(blocks)}${"□".repeat(8 - blocks)}`
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[var(--muted)]",
				children: provider.detail
			}),
			provider.id === "ollama" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["VRAM: ", provider.vram ?? "Unavailable"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Tokens/sec: ", provider.tokens_per_sec ?? "Unavailable"] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: "Context size is not exposed by the tags endpoint."
				})
			] }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: ["Latency estimate: ", provider.latency_estimate_ms == null ? "Unavailable" : `${provider.latency_estimate_ms} ms`] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "Recent"
			}),
			tasks.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[var(--muted)]",
				children: "No tasks yet."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: tasks.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex justify-between gap-3 py-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: task.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "capitalize text-[var(--muted)]",
					children: task.state.replaceAll("_", " ")
				})]
			}, task.id)) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => {
					setOverride(provider.id);
					setSheet("compose");
				},
				className: "tap min-h-11 self-start text-[15px] text-[var(--accent)]",
				children: ["Start with ", provider.name]
			})
		]
	});
}
function SystemPanel() {
	const samples = useIsland((state) => state.samples);
	const theme = useIsland((state) => state.theme);
	const setTheme = useIsland((state) => state.setTheme);
	const cpuWarn = useIsland((state) => state.cpuWarn);
	const gpuWarn = useIsland((state) => state.gpuWarn);
	const setCpuWarn = useIsland((state) => state.setCpuWarn);
	const setGpuWarn = useIsland((state) => state.setGpuWarn);
	const latest = samples[samples.length - 1];
	const cpu = samples.map((sample) => sample.cpu.utilization).filter((value) => value != null);
	const ram = samples.map((sample) => sample.memory.totalBytes ? sample.memory.usedBytes / sample.memory.totalBytes * 100 : 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "This preview host is not your Windows PC. Missing sensors stay blank."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: "CPU"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[22px] font-semibold tabular-nums",
					children: latest?.cpu.utilization == null ? "—" : `${latest.cpu.utilization}%`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: [
						latest?.cpu.clockMhz == null ? "Clock unavailable" : `${(latest.cpu.clockMhz / 1e3).toFixed(2)} GHz`,
						" · ",
						latest?.cpu.temperatureC == null ? "Temperature unavailable" : `${latest.cpu.temperatureC}°C`
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, { values: cpu })
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: "RAM"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[22px] font-semibold tabular-nums",
					children: latest ? `${gb(latest.memory.usedBytes)} / ${gb(latest.memory.totalBytes)}` : "—"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Spark, { values: ram })
			] }),
			latest && latest.gpus.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[15px]",
				children: "No GPU telemetry. Intel Arc and RTX 4050 are not on this host."
			}) : null,
			latest?.gpus.map((gpu) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: gpu.name
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[22px] font-semibold tabular-nums",
					children: gpu.utilization == null ? "—" : `${gpu.utilization}%`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[13px] text-[var(--muted)]",
					children: [
						gpu.memoryUsedBytes != null && gpu.memoryTotalBytes != null ? `${gb(gpu.memoryUsedBytes)} / ${gb(gpu.memoryTotalBytes)}` : "Memory unavailable",
						" · ",
						gpu.temperatureC == null ? "Temperature unavailable" : `${gpu.temperatureC}°C`,
						gpu.powerW == null ? "" : ` · ${gpu.powerW} W`
					]
				})
			] }, gpu.name)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex items-center justify-between text-[15px]",
				children: ["CPU warning °C", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: cpuWarn,
					min: 40,
					max: 110,
					onChange: (event) => setCpuWarn(Number(event.target.value)),
					className: "min-h-11 w-20 rounded-xl bg-[var(--field)] px-2 text-right"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex items-center justify-between text-[15px]",
				children: ["NVIDIA warning °C", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "number",
					value: gpuWarn,
					min: 40,
					max: 110,
					onChange: (event) => setGpuWarn(Number(event.target.value)),
					className: "min-h-11 w-20 rounded-xl bg-[var(--field)] px-2 text-right"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "Jobs are not stopped automatically."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
				className: "tap min-h-11 self-start text-[15px] text-[var(--accent)]",
				children: theme === "dark" ? "Light theme" : "Dark theme"
			})
		]
	});
}
function Tasks({ now }) {
	const tasks = useIsland((state) => state.tasks);
	const drafts = useIsland((state) => state.drafts);
	const filter = useIsland((state) => state.filter);
	const setFilter = useIsland((state) => state.setFilter);
	const openDecision = useIsland((state) => state.openDecision);
	const stop = useIsland((state) => state.stop);
	const pause = useIsland((state) => state.pause);
	const resume = useIsland((state) => state.resume);
	const restart = useIsland((state) => state.restart);
	const sendDrafts = useIsland((state) => state.sendDrafts);
	const host = useIsland((state) => state.host);
	const filters = [
		"all",
		"running",
		"completed",
		"failed",
		"stopped"
	];
	const shown = tasks.filter((task) => {
		if (filter === "all") return true;
		if (filter === "running") return activeTasks([task]).length > 0;
		return task.state === filter;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-2",
				children: filters.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-pressed": filter === item,
					onClick: () => setFilter(item),
					className: "tap min-h-11 rounded-full px-3 text-[13px] capitalize",
					style: {
						background: filter === item ? "var(--accent)" : "var(--field)",
						color: filter === item ? "#fff" : "var(--fg)"
					},
					children: item
				}, item))
			}),
			drafts.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-[var(--field)] px-3 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[15px]",
					children: [drafts.length, " queued"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: host !== "online",
					onClick: sendDrafts,
					className: "tap mt-2 min-h-11 text-[15px] text-[var(--accent)] disabled:opacity-40",
					children: "Send queued"
				})]
			}) : null,
			shown.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[15px] text-[var(--muted)]",
				children: "No tasks in this filter."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col",
				children: shown.map((task) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "border-b border-[var(--glass-line)] py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => openDecision(task.id),
							className: "tap block w-full text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-[17px] font-medium",
								children: task.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-[13px] capitalize text-[var(--muted)]",
								children: [
									task.provider,
									" · ",
									task.state.replaceAll("_", " "),
									" · ",
									elapsed(task, now)
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-1 flex flex-wrap gap-1",
							children: [
								task.state === "running" || task.state === "launching" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
									onClick: () => pause(task.id),
									children: "Pause"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
									onClick: () => void stop(task.id),
									children: "Stop"
								})] }) : null,
								task.state === "paused" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
									onClick: () => resume(task.id),
									children: "Resume"
								}) : null,
								task.state === "waiting_for_approval" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
									onClick: () => openDecision(task.id),
									children: "Open"
								}) : null,
								task.state === "completed" || task.state === "failed" || task.state === "stopped" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextButton, {
									onClick: () => restart(task.id),
									children: "Restart"
								}) : null
							]
						}),
						task.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-[13px] text-[var(--muted)]",
							children: task.error
						}) : null
					]
				}, task.id))
			})
		]
	});
}
function TextButton({ children, onClick }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "tap min-h-11 px-2 text-[15px] text-[var(--accent)]",
		children
	});
}
function Extensions({ providers }) {
	const extensions = useIsland((state) => state.extensions);
	const setExtension = useIsland((state) => state.setExtension);
	const setProviderFocus = useIsland((state) => state.setProviderFocus);
	const extra = providers.filter((provider) => provider.extension);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "Cline and Cursor stay off the bar. Enabling a slot does not install an adapter."
			}),
			extra.map((provider) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-11 items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setProviderFocus(provider.id),
					className: "tap text-left text-[17px]",
					children: [provider.name, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-[13px] text-[var(--muted)]",
						children: provider.detail
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					"aria-label": `${provider.name} slot`,
					checked: provider.id === "cline" ? extensions.cline : extensions.cursor,
					onChange: (event) => setExtension(provider.id, event.target.checked)
				})]
			}, provider.id)),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[15px] text-[var(--muted)]",
				children: "Add provider — the adapter interface is in the orchestrator. No extra plugin is installed."
			})
		]
	});
}
function Projects() {
	const projects = useIsland((state) => state.projects);
	const addProject = useIsland((state) => state.addProject);
	const removeProject = useIsland((state) => state.removeProject);
	const [name, setName] = (0, import_react.useState)("");
	const [path, setPath] = (0, import_react.useState)("");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "flex flex-col gap-3",
		onSubmit: (event) => {
			event.preventDefault();
			addProject(name, path);
			setName("");
			setPath("");
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-[var(--muted)]",
				children: "Only paths you type are stored. The disk is not scanned."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: name,
				onChange: (event) => setName(event.target.value),
				placeholder: "Name",
				"aria-label": "Project name",
				className: "min-h-11 rounded-xl bg-[var(--field)] px-3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				value: path,
				onChange: (event) => setPath(event.target.value),
				placeholder: "C:\\Projects\\app",
				"aria-label": "Project path",
				className: "min-h-11 rounded-xl bg-[var(--field)] px-3"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "submit",
				className: "tap min-h-11 self-start text-[15px] text-[var(--accent)]",
				children: "Register"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: projects.map((project) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex items-center justify-between gap-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-[15px]",
					children: project.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-[13px] text-[var(--muted)]",
					children: project.path
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => removeProject(project.id),
					className: "tap min-h-11 text-[15px] text-[var(--muted)]",
					children: "Remove"
				})]
			}, project.id)) })
		]
	});
}
var SplitComponent = Island;
//#endregion
export { SplitComponent as component };
