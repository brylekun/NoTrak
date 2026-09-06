import { createScannedPdf, type ScannerPageSize, type ScannerPdfPage } from "@/lib/pdf/document-scanner";

type Request = { pages: ScannerPdfPage[]; pageSize: ScannerPageSize };
type Response = { buffer: ArrayBuffer } | { error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    const buffer = await createScannedPdf(data.pages, data.pageSize);
    scope.postMessage({ buffer }, [buffer]);
  } catch (reason) {
    scope.postMessage({ error: reason instanceof Error ? reason.message : "The PDF could not be created." });
  }
};

export {};
