import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { siteName, siteTagline, siteUrl } from "@/lib/site";
import "./globals.css";

// Runs before first paint so the correct theme is applied without a flash. A
// missing or unrecognized stored value means "follow the system".
const themeInitializer = `
try {
  var stored = localStorage.getItem("notrak-theme");
  var dark = stored === "dark" || stored === "light"
    ? stored === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
} catch {}
`;

// `display: swap` keeps text readable during the font fetch, and the explicit
// fallback stack lets Next generate a metric-adjusted local face so the swap
// does not reflow the page.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

const description =
  "A privacy-first collection of useful browser tools with no accounts, file uploads, or saved history.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — ${siteTagline}`,
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  keywords: ["privacy tools", "browser tools", "local processing", "NoTrak"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: `${siteName} — ${siteTagline}`,
    description,
  },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: siteName, statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#1b2a29" },
  ],
  // Lets the page fill a notched display; the `.page-gutter` safe-area insets
  // keep content out from under the corners and the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
