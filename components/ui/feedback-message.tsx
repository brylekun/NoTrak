import type { ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type FeedbackTone = "neutral" | "success" | "error";

const toneStyles: Record<FeedbackTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-primary",
  error: "text-destructive",
};

const toneIcons = {
  neutral: Info,
  success: CheckCircle2,
  error: CircleAlert,
};

export function FeedbackMessage({
  children,
  tone = "neutral",
  className,
}: {
  children?: ReactNode;
  tone?: FeedbackTone;
  className?: string;
}) {
  const Icon = toneIcons[tone];
  const hasContent = Boolean(children);

  return (
    <p
      className={cn("feedback-message min-h-5 text-sm", toneStyles[tone], className)}
      role={hasContent ? tone === "error" ? "alert" : "status" : undefined}
      aria-live={hasContent ? tone === "error" ? "assertive" : "polite" : undefined}
      aria-atomic={hasContent ? "true" : undefined}
    >
      {hasContent ? (
        <>
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{children}</span>
        </>
      ) : null}
    </p>
  );
}
