import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const themeInitializer = `
try {
  const storedTheme = localStorage.getItem("notrak-theme");
  const dark = storedTheme ? storedTheme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
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

export const metadata: Metadata = {
  title: {
    default: "NoTrak — Private tools. Nothing stored.",
    template: "%s | NoTrak",
  },
  description:
    "A privacy-first collection of useful browser tools with no accounts, file uploads, or saved history.",
  applicationName: "NoTrak",
  keywords: ["privacy tools", "browser tools", "local processing", "NoTrak"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
