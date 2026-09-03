// Parameters that are tracking-only on every host. A parameter is listed here
// only when removing it cannot change which page a link opens.
const TRACKING_PARAMETERS = new Set([
  "_branch_match_id",
  "_hsenc",
  "_hsmi",
  "_openstat",
  "action_object_map",
  "action_ref_map",
  "action_type_map",
  "cmpid",
  "dclid",
  "epik",
  "fb_action_ids",
  "fb_action_types",
  "fb_source",
  "fbclid",
  "gad_source",
  "gbraid",
  "gclid",
  "gclsrc",
  "guccounter",
  "guce_referrer",
  "guce_referrer_sig",
  "igshid",
  "li_fat_id",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "msclkid",
  "ncid",
  "oly_anon_id",
  "oly_enc_id",
  "rb_clickid",
  "s_cid",
  "sc_cid",
  "scid",
  "srsltid",
  "ttclid",
  "twclid",
  "vero_conv",
  "vero_id",
  "wbraid",
  "wickedid",
  "wt_mc",
  "xtor",
  "yclid",
]);

const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_", "at_custom", "matomo_", "piwik_"];

/**
 * Parameters that are tracking on a specific service but carry meaning
 * elsewhere. `si`, for example, is a share identifier on YouTube and Spotify but
 * an ordinary parameter on plenty of other sites.
 */
const HOST_TRACKING_PARAMETERS: Array<{ hosts: string[]; parameters: string[] }> = [
  { hosts: ["youtube.com", "youtu.be", "music.youtube.com"], parameters: ["si", "feature", "pp", "kw"] },
  { hosts: ["spotify.com", "open.spotify.com"], parameters: ["si", "nd", "_branch_referrer"] },
  // `img_index` selects a carousel image and is intentionally preserved.
  { hosts: ["instagram.com"], parameters: ["igsh"] },
  { hosts: ["twitter.com", "x.com"], parameters: ["s", "t", "ref_src", "ref_url"] },
  { hosts: ["tiktok.com"], parameters: ["is_from_webapp", "sender_device", "web_id"] },
  { hosts: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.co.jp", "amazon.in"], parameters: ["pd_rd_r", "pd_rd_w", "pd_rd_wg", "pf_rd_i", "pf_rd_m", "pf_rd_p", "pf_rd_r", "pf_rd_s", "pf_rd_t", "psc", "th", "linkCode", "creativeASIN", "tag"] },
  { hosts: ["aliexpress.com", "taobao.com", "tmall.com"], parameters: ["spm", "scm", "pvid", "algo_pvid"] },
  { hosts: ["ebay.com", "ebay.co.uk"], parameters: ["_trkparms", "_trksid", "hash"] },
  { hosts: ["bbc.com", "bbc.co.uk"], parameters: ["at_medium", "at_campaign", "at_custom1", "at_custom2", "at_custom3", "at_custom4", "at_link_id", "at_link_origin", "at_link_type"] },
  { hosts: ["reddit.com"], parameters: ["share_id", "correlation_id", "ref_campaign", "ref_source", "rdt"] },
  { hosts: ["linkedin.com"], parameters: ["trk", "trkInfo", "originalSubdomain", "midToken", "midSig"] },
  { hosts: ["facebook.com"], parameters: ["comment_tracking", "notif_t", "notif_id", "ref"] },
];

/**
 * Path segments that only carry referral data. Amazon's `/ref=` segment is the
 * common case: it records how you arrived, and the product page resolves without
 * it.
 */
const HOST_PATH_PREFIXES: Array<{ hosts: string[]; segmentPrefixes: string[] }> = [
  {
    hosts: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.ca", "amazon.co.jp", "amazon.in"],
    segmentPrefixes: ["ref="],
  },
];

export type CleanUrlResult = {
  cleanedUrl: string;
  removedParameters: string[];
  removedFragmentParameters: string[];
  removedPathSegments: string[];
};

function matchesHost(hostname: string, hosts: string[]) {
  const normalized = hostname.toLowerCase().replace(/^www\./u, "");
  return hosts.some((host) => normalized === host || normalized.endsWith(`.${host}`));
}

function hostParametersFor(hostname: string) {
  const parameters = new Set<string>();
  for (const rule of HOST_TRACKING_PARAMETERS) {
    if (!matchesHost(hostname, rule.hosts)) continue;
    for (const parameter of rule.parameters) parameters.add(parameter.toLowerCase());
  }
  return parameters;
}

function isTrackingParameter(name: string, hostParameters: Set<string>) {
  const normalized = name.toLowerCase();
  return (
    TRACKING_PARAMETERS.has(normalized) ||
    hostParameters.has(normalized) ||
    TRACKING_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

function stripParameters(params: URLSearchParams, hostParameters: Set<string>) {
  const removed: string[] = [];
  for (const name of [...new Set(params.keys())]) {
    if (isTrackingParameter(name, hostParameters)) {
      removed.push(name);
      params.delete(name);
    }
  }
  return removed;
}

/**
 * Cleans a `#`-fragment that is itself a query string, which some sites use to
 * keep campaign data out of server logs while still reading it in JavaScript.
 * A fragment that is an ordinary anchor is left untouched.
 */
function cleanFragment(hash: string, hostParameters: Set<string>) {
  const raw = hash.replace(/^#/u, "");
  if (!raw.includes("=")) return { hash, removed: [] as string[] };

  // Only treat it as a parameter list when every segment looks like key=value.
  const segments = raw.split("&");
  if (!segments.every((segment) => /^[^=&]+=[^=]*$/u.test(segment))) return { hash, removed: [] as string[] };

  const params = new URLSearchParams(raw);
  const removed = stripParameters(params, hostParameters);
  if (removed.length === 0) return { hash, removed };

  const rest = params.toString();
  return { hash: rest ? `#${rest}` : "", removed };
}

function cleanPath(pathname: string, hostname: string) {
  const removed: string[] = [];
  const rules = HOST_PATH_PREFIXES.filter((rule) => matchesHost(hostname, rule.hosts));
  if (rules.length === 0) return { pathname, removed };

  const prefixes = rules.flatMap((rule) => rule.segmentPrefixes);
  const segments = pathname.split("/").filter((segment) => {
    if (!prefixes.some((prefix) => segment.startsWith(prefix))) return true;
    removed.push(segment);
    return false;
  });

  const rebuilt = segments.join("/") || "/";
  return { pathname: rebuilt.startsWith("/") ? rebuilt : `/${rebuilt}`, removed };
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

  const hostParameters = hostParametersFor(url.hostname);
  const removedParameters = stripParameters(url.searchParams, hostParameters);

  const fragment = cleanFragment(url.hash, hostParameters);
  url.hash = fragment.hash;

  const path = cleanPath(url.pathname, url.hostname);
  url.pathname = path.pathname;

  return {
    cleanedUrl: url.toString(),
    removedParameters,
    removedFragmentParameters: fragment.removed,
    removedPathSegments: path.removed,
  };
}
