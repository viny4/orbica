"use client";

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it can't rely on globals.css or fonts — inline styles only.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", background: "#03050a", color: "#e8eeff", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center" }}>
        <div style={{ maxWidth: 520, padding: 24 }}>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.28em", textTransform: "uppercase", color: "#7df9ff" }}>Orbica</p>
          <h1 style={{ fontWeight: 300, fontSize: 32, textTransform: "uppercase", margin: "12px 0" }}>Something went wrong</h1>
          <p style={{ color: "rgba(232,238,255,0.6)", fontSize: 14, lineHeight: 1.6 }}>The page failed to load. Please try again.</p>
          <button
            onClick={reset}
            style={{ marginTop: 24, background: "#fff", color: "#03050a", border: 0, padding: "12px 22px", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
