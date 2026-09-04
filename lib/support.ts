/*
 * Funding destinations, kept in one place so the footer, the support page, and
 * the README describe the same targets.
 *
 * Privacy constraint: these are outbound links only. NoTrak never embeds a
 * badge image, script, or widget from a funding platform, because that would
 * send every visitor's IP address and referring page to a third party on page
 * load — exactly the tracking NoTrak exists to avoid. The Content-Security
 * Policy in `next.config.ts` keeps `img-src` at `'self' data: blob:`, so a
 * remote badge would be blocked even if one were added by mistake.
 */

export type SupportLink = {
  id: string;
  label: string;
  /** Short line shown on the support page. */
  detail: string;
  href: string;
};

/**
 * Monero address for direct donations.
 *
 * Leave this empty rather than guessing: an incorrect address sends funds
 * nowhere recoverable. The footer link and the support page's Monero section
 * both stay hidden while it is empty, so nothing renders a placeholder that
 * could be mistaken for a real address.
 */
export const moneroAddress = "";

export const supportLinks: SupportLink[] = [
  {
    id: "github-sponsors",
    label: "GitHub Sponsors",
    detail: "Recurring or one-time, billed through your existing GitHub account.",
    href: "https://github.com/sponsors/brylekun",
  },
  {
    id: "paypal",
    label: "PayPal",
    detail: "One-time contribution with a card or PayPal balance.",
    href: `https://paypal.me/BryleMartin`,
  },
];

/**
 * Standard Monero addresses are 95 Base58 characters starting with 4 or 8;
 * integrated addresses are 106 and also start with 4. This is a shape check
 * that catches a truncated or mistyped paste, not a checksum validation.
 */
export function isLikelyMoneroAddress(value: string) {
  return /^[48][1-9A-HJ-NP-Za-km-z]{94}$/u.test(value) || /^4[1-9A-HJ-NP-Za-km-z]{105}$/u.test(value);
}

export const hasMoneroAddress = isLikelyMoneroAddress(moneroAddress);

/** URI form a wallet app can open, used for the locally generated QR code. */
export function moneroUri(address: string) {
  return `monero:${address}`;
}
