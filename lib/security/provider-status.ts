export type ProviderFailureStatus =
  | "not_configured"
  | "rate_limited"
  | "quota_exceeded"
  | "authentication_failed"
  | "timed_out"
  | "unavailable"
  | "invalid_response";

export type UrlProviderStatus = "match" | "not_found" | ProviderFailureStatus;
export type MalwareProviderStatus = "known_malicious" | "not_found" | ProviderFailureStatus;

export type ProviderStatusPresentation = {
  label: string;
  detail: string;
  incomplete: boolean;
};

const presentations: Record<UrlProviderStatus | "known_malicious", ProviderStatusPresentation> = {
  match: {
    label: "Match",
    detail: "The provider reported this URL as a known threat.",
    incomplete: false,
  },
  known_malicious: {
    label: "Known malicious",
    detail: "The provider recognizes this hash as malware.",
    incomplete: false,
  },
  not_found: {
    label: "Not found",
    detail: "The provider did not report a match. This does not prove the item is safe.",
    incomplete: false,
  },
  not_configured: {
    label: "Not configured",
    detail: "This provider is not active on this deployment.",
    incomplete: true,
  },
  rate_limited: {
    label: "Rate limited",
    detail: "The provider is temporarily refusing additional checks. Try again later.",
    incomplete: true,
  },
  quota_exceeded: {
    label: "Quota reached",
    detail: "The provider quota is currently exhausted. Try again after it resets.",
    incomplete: true,
  },
  authentication_failed: {
    label: "Configuration issue",
    detail: "The provider credentials need operator attention. No result was returned.",
    incomplete: true,
  },
  timed_out: {
    label: "Timed out",
    detail: "The provider did not respond in time. Try again later.",
    incomplete: true,
  },
  unavailable: {
    label: "Temporarily unavailable",
    detail: "The provider could not complete this check. Try again later.",
    incomplete: true,
  },
  invalid_response: {
    label: "Unexpected response",
    detail: "The provider returned a response NoTrak could not safely interpret.",
    incomplete: true,
  },
};

export function getProviderStatusPresentation(status: UrlProviderStatus | MalwareProviderStatus) {
  return presentations[status];
}

export function isProviderResultIncomplete(status: UrlProviderStatus | MalwareProviderStatus) {
  return presentations[status].incomplete;
}
