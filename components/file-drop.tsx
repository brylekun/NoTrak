"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

type FileDropProps = {
  label: string;
  hint?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

/**
 * A labelled file picker that also accepts a drag-and-drop. The underlying
 * <input type="file"> stays in the accessibility tree and keeps keyboard
 * operation, so the drop zone is an addition rather than a replacement.
 */
export function FileDrop({ label, hint, accept, multiple = false, disabled = false, onFiles }: FileDropProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function deliver(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) onFiles(multiple ? files : files.slice(0, 1));
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-sm font-semibold">{label}</label>
      <div
        className={cn(
          "mt-2 rounded-2xl border border-dashed p-4 transition-colors motion-reduce:transition-none",
          dragging ? "border-primary bg-primary/8" : "border-border/80",
          disabled && "pointer-events-none opacity-60",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          // Ignore a leave fired while moving between child elements.
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          deliver(event.dataTransfer?.files ?? null);
        }}
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <UploadCloud className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm">
              Drag {multiple ? "files" : "a file"} here, or{" "}
              <button
                type="button"
                disabled={disabled}
                className="font-semibold text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => inputRef.current?.click()}
              >
                browse
              </button>
              .
            </p>
            {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
          </div>
        </div>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="mt-3 h-10 w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-sm"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(event) => deliver(event.target.files)}
        />
      </div>
    </div>
  );
}
