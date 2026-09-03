import { hashBytes, type HashAlgorithm } from "@/lib/crypto/hash";

type HashRequest = { algorithm: HashAlgorithm; buffer: ArrayBuffer };
type HashResponse = { digest?: string; error?: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<HashRequest>) => void) | null;
  postMessage: (message: HashResponse) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    scope.postMessage({ digest: await hashBytes(data.buffer, data.algorithm) });
  } catch (reason) {
    scope.postMessage({ error: reason instanceof Error ? reason.message : "Hashing failed." });
  }
};

export {};
