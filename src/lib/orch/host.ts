import { createServerFn } from "@tanstack/react-start";
import type { HostSnapshot } from "../bunny-host/contracts.ts";
import type { OrchTask } from "./types";

export const readBunnyHost=createServerFn({method:"POST"}).validator((data:{after?:number})=>data).handler(async({data}):Promise<HostSnapshot>=>{
  const {hostRequest}=await import("./host-bridge.server.ts");return await hostRequest(`/state?after=${Number(data.after ?? 0)}`) as HostSnapshot;
});
export const commandBunnyHost=createServerFn({method:"POST"}).validator((data:{action:string;data:Record<string,unknown>})=>data).handler(async({data}):Promise<{snapshot:HostSnapshot;task?:OrchTask;pairCode?:string}>=>{
  const {hostRequest}=await import("./host-bridge.server.ts");return await hostRequest("/command",data) as {snapshot:HostSnapshot;task?:OrchTask;pairCode?:string};
});
