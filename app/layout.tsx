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
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
