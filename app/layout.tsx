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

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        {/* The vendor listens for DOMContentLoaded; a deferred parser script
            registers it before that event, including on direct tool visits. */}
        <script
          defer
          data-name="BMC-Widget"
          data-cfasync="false"
          src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
          data-id="NoTrak"
          data-description="Support me on Buy me a coffee!"
          data-message=""
          data-color="#40DCA5"
          data-position="Right"
          data-x_margin="18"
          data-y_margin="18"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
