import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Dist, StepStatus } from "@/lib/jev/types";
import { pct } from "@/lib/jev/engine";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Button({
  tone = "quiet",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "quiet" | "moss" | "plain" }) {
  return (
    <button
      type={type}
      className={cn(
        "tap inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium disabled:opacity-40",
        tone === "primary" && "bg-brass text-brass-ink",
        tone === "moss" && "bg-moss text-moss-ink",
        tone === "quiet" && "bg-raised text-fg",
        tone === "plain" && "bg-transparent px-3 text-[17px] text-brass",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({
  title,
  eyebrow,
  action,
  flush = false,
  children,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="mb-1.5 flex items-end justify-between gap-3 px-4">
        <h2 className="text-[13px] font-normal text-muted">{title}</h2>
        {action}
      </header>
      <div className={cn("group-card", flush ? "" : "px-4 py-3")}>{children}</div>
      {eyebrow ? <p className="mt-1.5 px-4 text-[13px] leading-snug text-muted">{eyebrow}</p> : null}
    </section>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn("relative inline-flex h-[31px] w-[51px] shrink-0 rounded-full", on ? "bg-moss" : "bg-raised")}
      aria-hidden="true"
    >
      <span
        className={cn(
          "absolute top-[2px] size-[27px] rounded-full bg-white shadow-sm",
          on ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </span>
  );
}

export function Pill({ status, children }: { status?: StepStatus; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        status === "allow" && "bg-moss/10 text-moss",
        status === "hold" && "bg-brass/10 text-brass",
        status === "deny" && "bg-raised text-muted",
        (!status || status === "info") && "bg-raised text-fg",
      )}
    >
      {children}
    </span>
  );
}

export function DistBars({ dist }: { dist: Dist[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {dist.map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          <span className="w-28 shrink-0 truncate text-sm text-muted">{row.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <span className="block h-full bg-brass" style={{ width: `${Math.round(row.p * 100)}%` }} />
          </span>
          <span className="w-12 shrink-0 text-right text-sm text-fg tabular-nums">{pct(row.p)}</span>
        </li>
      ))}
    </ul>
  );
}

export function FieldLabel({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-fg tabular-nums">{value}</span>
    </span>
  );
}
