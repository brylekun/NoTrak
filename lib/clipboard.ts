// Clipboard writes reject in non-secure contexts, when a browser withholds the
// permission, and in engines that gate the async Clipboard API behind a flag.
// Callers need a definite outcome so they can tell the user to copy manually
// instead of leaving a button that silently does nothing.
export const COPY_FALLBACK_MESSAGE = "Copying was blocked. Select the value and copy it manually.";

export async function copyToClipboard(value: string): Promise<boolean> {
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
