import {
  combinePdfToolkitPages,
  inspectPdfToolkitSources,
  splitPdfToolkitPages,
  type PdfToolkitPage,
} from "@/lib/pdf/toolkit";

type Request =
  | { action: "inspect"; buffers: ArrayBuffer[]; names: string[] }
  | { action: "combine"; buffers: ArrayBuffer[]; pages: PdfToolkitPage[] }
  | { action: "split"; buffers: ArrayBuffer[]; pages: PdfToolkitPage[] };

type Response =
  | { action: "inspect"; pages: PdfToolkitPage[] }
  | { action: "combine"; buffer: ArrayBuffer }
  | { action: "split"; results: Array<{ buffer: ArrayBuffer; name: string }> }
  | { error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    if (data.action === "inspect") {
      const pages = await inspectPdfToolkitSources(data.buffers, data.names);
      scope.postMessage({ action: "inspect", pages });
      return;
    }

    if (data.action === "combine") {
      const buffer = await combinePdfToolkitPages(data.buffers, data.pages);
      scope.postMessage({ action: "combine", buffer }, [buffer]);
      return;
    }

    const results = await splitPdfToolkitPages(data.buffers, data.pages);
    scope.postMessage(
      { action: "split", results },
      results.map((result) => result.buffer),
    );
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "PDF processing failed.";
    scope.postMessage({
      error: detail.toLowerCase().includes("encrypted")
        ? "Password-protected PDFs are not supported. Unlock a copy first."
        : detail,
    });
  }
};

export {};
