import { afterEach, describe, expect, it, vi } from "vitest";

import { COPY_FALLBACK_MESSAGE, copyToClipboard } from "../../lib/clipboard";

function stubClipboard(writeText: (value: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("copyToClipboard", () => {
  it("reports success when the browser accepts the write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    await expect(copyToClipboard("hunter2")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hunter2");
  });

  it("reports failure instead of throwing when the write is rejected", async () => {
    stubClipboard(vi.fn().mockRejectedValue(new DOMException("Denied", "NotAllowedError")));

    await expect(copyToClipboard("hunter2")).resolves.toBe(false);
  });

  it("reports failure when the Clipboard API is unavailable", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyToClipboard("hunter2")).resolves.toBe(false);
  });

  it("does not attempt to copy an empty value", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    await expect(copyToClipboard("")).resolves.toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("offers a manual-copy fallback message", () => {
    expect(COPY_FALLBACK_MESSAGE).toMatch(/manually/i);
  });
});
