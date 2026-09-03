export type SecurityApiErrorCode =
  | "rate_limited"
  | "unsupported_media_type"
  | "body_too_large"
  | "invalid_json"
  | "invalid_input"
  | "request_failed";

const errorMessages: Record<SecurityApiErrorCode, string> = {
  rate_limited: "Too many checks were requested. Wait a minute and try again.",
  unsupported_media_type: "The request format was not accepted. Reload the page and try again.",
  body_too_large: "The request was too large to process.",
  invalid_json: "The request could not be read. Reload the page and try again.",
  invalid_input: "The submitted value could not be checked.",
  request_failed: "The reputation check could not be completed. Try again later.",
};

export class SecurityApiError extends Error {
  override name = "SecurityApiError";
}

function fail(message: string): never {
  throw new SecurityApiError(message);
}

function isErrorCode(value: unknown): value is SecurityApiErrorCode {
  return typeof value === "string" && value in errorMessages;
}

export async function readSecurityApiResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    if (response.status === 429) fail(errorMessages.rate_limited);
    fail(response.ok
      ? "NoTrak received an unreadable response. Try again later."
      : errorMessages.request_failed);
  }

  if (!response.ok) {
    const code = payload && typeof payload === "object" && "code" in payload
      ? (payload as { code?: unknown }).code
      : undefined;
    fail(isErrorCode(code) ? errorMessages[code] : response.status === 429
      ? errorMessages.rate_limited
      : errorMessages.request_failed);
  }

  return payload as T;
}
