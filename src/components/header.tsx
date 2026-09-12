import Link from "next/link";

export default function SettingsHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          Leads<span>DB</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/api">API</Link>
          <Link href="/contact">Contact</Link>
        </nav>

        <Link href="/login" className="header-cta">
          Get Started <span>→</span>
        </Link>
      </div>
    </header>
  );
}
