import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useIsland } from "@/store/use-island";
import { BunnyOrb } from "./motion";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }>;
      }) => void)
    | null;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useVoiceInput() {
  const [state, setState] = useState<"idle" | "starting" | "listening" | "unavailable">("idle");
  const [transcript, setTranscript] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const base = useRef("");
  const stop = () => {
    try {
      recognition.current?.stop();
    } catch {
      /* Capture already ended. */
    }
  };
  const start = () => {
    if (recognition.current) return;
    const Speech =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) {
      setState("unavailable");
      useIsland
        .getState()
        .note("Voice input unavailable in this browser. Type your task to continue.");
      return;
    }
    base.current = useIsland.getState().prompt;
    const instance = new Speech();
    recognition.current = instance;
    instance.continuous = false;
    instance.interimResults = true;
    instance.lang = navigator.language;
    instance.onstart = () => setState("listening");
    instance.onresult = (event) => {
      const words = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setTranscript(words);
      const final = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript)
        .join(" ");
      if (final)
        useIsland
          .getState()
          .setPrompt([base.current, final].filter(Boolean).join(" ").slice(0, 16000));
    };
    instance.onerror = (event) => {
      setState("unavailable");
      useIsland
        .getState()
        .note(`Voice input unavailable (${event.error}). You can type and route the same task.`);
    };
    instance.onend = () => {
      recognition.current = null;
      setState((current) => (current === "unavailable" ? current : "idle"));
    };
    setTranscript("");
    setState("starting");
    try {
      instance.start();
    } catch {
      recognition.current = null;
      setState("unavailable");
      useIsland.getState().note("Voice service unavailable. Type your task to continue.");
    }
  };
  useEffect(
    () => () => {
      const instance = recognition.current;
      if (instance) {
        instance.onend = null;
        instance.onresult = null;
        instance.onerror = null;
        instance.abort();
      }
    },
    [],
  );
  return { state, transcript, start, stop };
}
export function VoicePanel({
  state,
  transcript,
  onStop,
}: {
  state: "idle" | "starting" | "listening" | "unavailable";
  transcript: string;
  onStop: () => void;
}) {
  return (
    <section className="voice-panel" aria-live="polite">
      <BunnyOrb state={state === "listening" ? "listening" : "idle"} large />
      <h2>
        {state === "listening"
          ? "Listening…"
          : state === "starting"
            ? "Connecting voice input…"
            : state === "unavailable"
              ? "Voice input unavailable"
              : "Ready to review"}
      </h2>
      {state === "listening" ? (
        <span className="voice-wave" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} />
          ))}
        </span>
      ) : null}
      <p>{transcript || "Hold Bunny to speak. Release to finish."}</p>
      <p className="caption">Speech becomes a draft. Review the route before execution.</p>
      <button className="btn secondary" onClick={onStop}>
        {state === "listening" || state === "starting" ? <MicOff size={16} /> : <Mic size={16} />}
        Return to composer
      </button>
    </section>
  );
}
