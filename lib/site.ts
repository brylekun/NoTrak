// Public origin used for canonical URLs, the sitemap, robots, and social cards.
// Vercel exposes the production domain at build time; the localhost fallback
// keeps development and tests self-consistent.
function resolveSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();
export const siteName = "NoTrak";
export const siteTagline = "Private tools. Nothing stored.";
