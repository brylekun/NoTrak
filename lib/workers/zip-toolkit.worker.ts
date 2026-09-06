/// <reference lib="webworker" />

import { createZipArchive, extractZipArchive, inspectZipArchive, type ZipInput } from "@/lib/archive/zip";

type Request =
  | { action: "create"; files: Array<{ name: string; size: number; buffer: ArrayBuffer }>; level: 0 | 6 | 9 }
  | { action: "inspect"; buffer: ArrayBuffer }
  | { action: "extract"; buffer: ArrayBuffer };

self.onmessage = (event: MessageEvent<Request>) => {
  try {
    const request = event.data;
    if (request.action === "create") {
      const files: ZipInput[] = request.files.map((file) => ({
        name: file.name,
        size: file.size,
        bytes: new Uint8Array(file.buffer),
      }));
      const output = createZipArchive(files, request.level);
      self.postMessage({ action: "create", buffer: output.buffer }, { transfer: [output.buffer] });
      return;
    }
    if (request.action === "inspect") {
      self.postMessage({ action: "inspect", ...inspectZipArchive(new Uint8Array(request.buffer)) });
      return;
    }

    const entries = extractZipArchive(new Uint8Array(request.buffer));
    const transfer = entries.map((entry) => entry.bytes.buffer);
    self.postMessage({
      action: "extract",
      entries: entries.map((entry) => ({ ...entry, buffer: entry.bytes.buffer, bytes: undefined })),
    }, { transfer });
  } catch (reason) {
    self.postMessage({ error: reason instanceof Error ? reason.message : "The ZIP operation failed." });
  }
};

export {};
