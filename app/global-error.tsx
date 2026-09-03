"use client";

// A root-layout failure bypasses app/error.tsx, so this boundary must render its
// own <html>/<body>. It deliberately avoids the site chrome and any imported
// styles that may themselves be the cause of the failure.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
          lineHeight: 1.6,
          background: "#fbfdfc",
          color: "#12211f",
        }}
      >
        <main style={{ maxWidth: "34rem" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#128571" }}>
            NoTrak
          </p>
          <h1 style={{ margin: "0.75rem 0 0", fontSize: "1.875rem", letterSpacing: "-0.03em" }}>
            NoTrak could not load.
          </h1>
          <p style={{ margin: "1rem 0 0", color: "#4a5c5a" }}>
            NoTrak did not send an application error report. Reload the page to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.75rem",
              padding: "0.6rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#ffffff",
              background: "#128571",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
