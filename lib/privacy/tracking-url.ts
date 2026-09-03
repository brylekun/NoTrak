const TRACKING_PARAMETERS = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "gbraid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_cid",
  "twclid",
  "vero_conv",
  "vero_id",
  "wbraid",
  "yclid",
  "_hsenc",
  "_hsmi",
]);

const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_"];

export type CleanUrlResult = {
  cleanedUrl: string;
  removedParameters: string[];
};

function isTrackingParameter(name: string) {
  const normalized = name.toLowerCase();
  return (
    TRACKING_PARAMETERS.has(normalized) ||
    TRACKING_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

export function cleanTrackingUrl(input: string): CleanUrlResult {
  const value = input.trim();
  if (!value) throw new Error("Paste a link to clean.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete web address beginning with http:// or https://.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// links are supported.");
  }

  if (url.username || url.password) {
    throw new Error("Links containing usernames or passwords are not accepted.");
  }

  const removedParameters: string[] = [];
  const names = [...new Set(url.searchParams.keys())];

  for (const name of names) {
    if (isTrackingParameter(name)) {
      removedParameters.push(name);
      url.searchParams.delete(name);
    }
  }

  return {
    cleanedUrl: url.toString(),
    removedParameters,
  };
}
