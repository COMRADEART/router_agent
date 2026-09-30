import { createServerFn } from "@tanstack/react-start";
import type { HostSample } from "./types";

export const readHostTelemetry = createServerFn({ method: "POST" }).handler(async (): Promise<HostSample> => {
  const { sampleHost } = await import("./telemetry.server.ts");
  return sampleHost();
});
