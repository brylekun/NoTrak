import type { NextConfig } from "next";

const scriptSources = ["'self'", "'unsafe-inline'"];

// React's development runtime uses eval for debugging support. Keep the
// exception local to development so the production CSP remains strict.
if (process.env.NODE_ENV === "development") {
  scriptSources.push("'unsafe-eval'");
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // This project is pinned to TypeScript 5, whose compiler API is available.
    // Using it also keeps builds reliable in restricted CI environments where
    // the default detached TypeScript CLI process cannot return captured output.
    useTypeScriptCli: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "connect-src 'self' https://speed.cloudflare.com",
              "font-src 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "img-src 'self' data: blob:",
              "object-src 'none'",
              `script-src ${scriptSources.join(" ")}`,
              "style-src 'self' 'unsafe-inline'",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          {
            // Vercel terminates TLS but does not add HSTS itself.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
