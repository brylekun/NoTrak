import { cleanPdfMetadata } from "@/lib/pdf/metadata";

type Response = { buffer?: ArrayBuffer; pageCount?: number; removedFields?: number; error?: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    const result = await cleanPdfMetadata(data);
    scope.postMessage(
      { buffer: result.bytes, pageCount: result.pageCount, removedFields: result.removedFields },
      [result.bytes],
    );
  } catch (reason) {
    scope.postMessage({ error: reason instanceof Error ? reason.message : "PDF cleaning failed." });
  }
};

export {};
