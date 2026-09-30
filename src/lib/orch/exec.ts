import { createServerFn } from "@tanstack/react-start";
import type { ExecRequest, ExecResult } from "./types";

export const probeExecutors = createServerFn({ method: "POST" }).handler(async () => {
  const { probeOllama } = await import("./exec.server.ts");
  return probeOllama();
});

export const runExecutor = createServerFn({ method: "POST" })
  .validator((data: ExecRequest) => data)
  .handler(async ({ data }): Promise<ExecResult> => {
    const { execute } = await import("./exec.server.ts");
    return execute(data);
  });

export const stopExecutor = createServerFn({ method: "POST" })
  .validator((data: { taskId: string }) => data)
  .handler(async ({ data }) => {
    const { stopTask } = await import("./exec.server.ts");
    return stopTask(data.taskId);
  });
