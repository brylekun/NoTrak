import { Globe2, ShieldCheck } from "lucide-react";

import type { ToolMode } from "@/lib/tools/registry";

export function PrivacyNotice({ mode, children }: { mode: ToolMode; children: React.ReactNode }) {
  const local = mode === "local";
  const Icon = local ? ShieldCheck : Globe2;

  return (
    <div className="flex gap-3 rounded-2xl border border-border/75 bg-muted/45 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-semibold">{local ? "Processed locally" : "External lookup"}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
