import { decryptFilePayload, encryptFilePayload } from "@/lib/crypto/file-encryption";

type Request =
  | { action: "encrypt"; buffer: ArrayBuffer; filename: string; password: string }
  | { action: "decrypt"; buffer: ArrayBuffer; password: string };

type Response = { buffer?: ArrayBuffer; filename?: string; error?: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: Response, transfer?: Transferable[]) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    if (data.action === "encrypt") {
      const buffer = await encryptFilePayload(data.buffer, data.filename, data.password);
      scope.postMessage({ buffer }, [buffer]);
    } else {
      const result = await decryptFilePayload(data.buffer, data.password);
      scope.postMessage({ buffer: result.bytes, filename: result.filename }, [result.bytes]);
    }
  } catch (reason) {
    scope.postMessage({ error: reason instanceof Error ? reason.message : "File processing failed." });
  }
};

export {};
