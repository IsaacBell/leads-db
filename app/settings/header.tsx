export default function Header() {
  return (
    <div className="shell">
      <div className="header">
        <a href="/" className="wordmark">
          leads<span>db</span>
        </a>
        <nav style={{ display: "flex", gap: 16 }}>
          <a
            href="/settings"
            style={{
              color: "var(--ink)",
              font: "700 11px ui-monospace, monospace",
              letterSpacing: ".04em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Settings
          </a>
        </nav>
      </div>
    </div>
  );
}
