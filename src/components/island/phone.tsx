import { useState } from "react";
import type { Mode } from "@/lib/orch/types";
import { activeTasks, liveProviders, useIsland } from "@/store/use-island";

export function Phone() {
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
  const providers = liveProviders({ tasks, ollamaUp, ollamaModels, extensions }).filter((provider) => !provider.extension);
  const running = activeTasks(tasks);
  const [composing, setComposing] = useState(false);
  const presence = host === "sleeping" ? "Sleeping" : "Online";

  return (
    <div className="fixed inset-0 overflow-auto bg-[#f2f2f7] text-[#1d1d1f]">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-[#6e6e73]">Workstation</p>
            <h1 className="text-[34px] leading-none font-bold tracking-tight">My laptop</h1>
            <p className="mt-1 text-[15px] text-[#248a3d]">{presence}</p>
          </div>
          <button type="button" onClick={() => setSheet(null)} className="tap min-h-11 text-[17px] text-[#007aff]">
            Desktop
          </button>
        </header>
        <p className="text-[13px] text-[#6e6e73]">
          Remote TLS is not configured. This companion shares the workstation session in this browser. Provider secrets are not on the phone.
        </p>
        <section className="rounded-2xl bg-white px-4 py-3">
          <p className="text-[13px] text-[#6e6e73]">CPU {latest?.cpu.utilization == null ? "—" : `${latest.cpu.utilization}%`}</p>
          <p className="text-[13px] text-[#6e6e73]">Temperature unavailable</p>
          <p className="text-[13px] text-[#6e6e73]">
            RAM {latest ? `${Math.round((latest.memory.usedBytes / latest.memory.totalBytes) * 100)}%` : "—"}
          </p>
          <p className="text-[13px] text-[#6e6e73]">No GPU telemetry on this host</p>
        </section>
        <section>
          <h2 className="mb-2 px-1 text-[13px] text-[#6e6e73]">Providers</h2>
          <ul className="overflow-hidden rounded-2xl bg-white">
            {providers.map((provider) => (
              <li key={provider.id} className="flex min-h-12 items-center justify-between border-b border-black/10 px-4 last:border-b-0">
                <span className="text-[17px]">{provider.name}</span>
                <span className="text-[15px] text-[#6e6e73]">{provider.usage_note}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-2 px-1 text-[13px] text-[#6e6e73]">Active tasks</h2>
          {running.length === 0 ? <p className="px-1 text-[15px] text-[#6e6e73]">None.</p> : null}
          <ul className="overflow-hidden rounded-2xl bg-white">
            {running.map((task) => (
              <li key={task.id}>
                <button type="button" onClick={() => openDecision(task.id)} className="tap flex min-h-12 w-full items-center justify-between px-4 text-left">
                  <span>
                    <span className="block text-[17px]">{task.title}</span>
                    <span className="text-[13px] capitalize text-[#6e6e73]">{task.provider}</span>
                  </span>
                  <span className="text-[13px] capitalize text-[#6e6e73]">{task.state.replaceAll("_", " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {composing ? (
          <form
            className="flex flex-col gap-3 rounded-2xl bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
              setComposing(false);
            }}
          >
            <label className="text-[13px] text-[#6e6e73]">
              New task
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} className="mt-2 w-full text-[17px] text-[#1d1d1f] outline-none" />
            </label>
            <div className="flex gap-2">
              {(["fast", "balanced", "deep"] as Mode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className="tap min-h-11 flex-1 rounded-full text-[13px] capitalize"
                  style={{ background: mode === item ? "#007aff" : "#e5e5ea", color: mode === item ? "#fff" : "#1d1d1f" }}
                >
                  {item}
                </button>
              ))}
            </div>
            <button type="submit" className="tap min-h-11 rounded-full bg-[#007aff] text-[17px] text-white">
              Submit
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setComposing(true)} className="tap min-h-12 rounded-2xl bg-[#007aff] text-[17px] font-medium text-white">
            New task
          </button>
        )}
        <label className="flex min-h-11 items-center justify-between text-[15px]">
          Workstation sleeping
          <input type="checkbox" checked={host === "sleeping"} onChange={(event) => setHost(event.target.checked ? "sleeping" : "online")} />
        </label>
        <label className="flex min-h-11 items-center justify-between text-[15px]">
          Auto-send queue when online
          <input type="checkbox" checked={autoSubmit} onChange={(event) => setAutoSubmit(event.target.checked)} />
        </label>
        <p className="pb-6 text-[13px] text-[#6e6e73]">Push notifications are not configured. Alerts stay in this session.</p>
      </div>
    </div>
  );
}
