import type { UsageWindow } from "../orch/types.ts";

const kindOf = (window: UsageWindow) => window.kind ?? (window.label === "Weekly" ? "weekly" : /hour/i.test(window.label) ? "short" : "other");

/**
 * Where provider-reported usage goes on a quota ring: the short window inside, the weekly window
 * outside. One exposed window draws one ring; none draws no ring and says "Usage unavailable".
 */
export function ringPlacement(windows: UsageWindow[] | undefined): { inner: UsageWindow | null; outer: UsageWindow | null; label: string | null } {
  const list = (windows ?? []).filter((window) => typeof window.usedPercent === "number" && Number.isFinite(window.usedPercent));
  if (!list.length) return { inner: null, outer: null, label: "Usage unavailable" };
  const short = list.find((window) => kindOf(window) === "short") ?? null;
  const weekly = list.find((window) => kindOf(window) === "weekly") ?? null;
  if (short && weekly) return { inner: short, outer: weekly, label: null };
  return { inner: null, outer: short ?? weekly ?? list[0], label: null };
}
