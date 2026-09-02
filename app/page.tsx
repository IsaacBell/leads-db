import Header from "@/components/header";

const industries = [
  "Broadcast Media",
  "Capital Markets",
  "Civil Engineering",
  "Computer Hardware",
  "Computer Software",
  "Consumer Goods",
  "Dairy",
  "Education Management",
  "Entertainment",
  "Executive Office",
  "Building Materials",
  "Chemicals",
  "Commercial Real Estate",
  "Computer Networking",
  "Construction",
  "Consumer Services",
  "Defense & Space",
  "E-Learning",
  "Environmental Services",
  "Facilities Services",
  "Business Supplies And Equipment",
  "Civic & Social Organization",
  "Computer Games",
  "Computer & Network Security",
  "Consumer Electronics",
  "Cosmetics",
  "Design",
  "Electrical/Electronic Manufacturing",
  "Events Services",
  "Farming",
];

export default function Home() {
  return (
    <>
      <Header />

      <main className="shell leads-page">
        {/* Hero */}
        <section className="leads-hero">
          <div className="hero-copy">
            <span className="eyebrow">BRAND NEW</span>

            <h1>
              Grow Your Business
              <br />
              With Quality Leads
            </h1>

            <p className="hero-description">
              Expand your outreach with curated contact lists tailored to
              your industry preferences.
            </p>

            <div className="hero-actions">
              <a href="#preferences" className="btn btn-primary">
                Get Leads Today
              </a>
              <a href="#how-it-works" className="btn btn-ghost">
                Learn More
              </a>
            </div>
          </div>

          <div className="hero-card">
            <div className="hero-card-top">
              <span className="status-dot" />
              <span>Live Lead Database</span>
            </div>

            <div className="lead-preview">
              <div className="lead-avatar">CEO</div>
              <div>
                <strong>Decision Maker</strong>
                <span>United States</span>
              </div>
              <span className="lead-check">✓</span>
            </div>

            <div className="lead-preview">
              <div className="lead-avatar lead-avatar-alt">VP</div>
              <div>
                <strong>Business Executive</strong>
                <span>United States</span>
              </div>
              <span className="lead-check">✓</span>
            </div>

            <div className="hero-card-footer">
              <span>Database refreshed regularly</span>
              <strong>● Active</strong>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="how-it-works" className="feature-grid">
          <article className="feature-card">
            <div className="feature-number">01</div>
            <h2>Customized Selection</h2>
            <p>
              Unlock the potential of your sales strategy with access to
              targeted leads in your preferred industry. Our database is
              constantly updated to bring you the most relevant contacts.
            </p>
          </article>

          <article className="feature-card feature-card-dark">
            <div className="feature-number">02</div>
            <h2>Organically Grow</h2>
            <p>
              Searching for new sales leads, networking contacts, or potential
              partners? Filter leads by location, industry, and job title to
              build a list that aligns perfectly with your business goals.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-number">03</div>
            <h2>Straight To Your Inbox</h2>
            <p>
              Benefit from a database that’s regularly refreshed, ensuring you
              have the latest information at your fingertips.
            </p>
          </article>
        </section>

        {/* Lead Form */}
        <section id="preferences" className="lead-section">
          <div className="lead-section-copy">
            <span className="eyebrow">READY TO START?</span>
            <h2>Tell us what kind of leads you need.</h2>
            <p>
              Choose your target locations, industries, job titles,
              qualifications, or anything else that matters to your business.
            </p>

            <div className="mini-stat">
              <strong>Weekly delivery</strong>
              <span>Detailed company information, delivered directly to you.</span>
            </div>
          </div>

          <form className="lead-form">
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
              />
            </div>

            <div className="form-field">
              <label htmlFor="title">Job Title</label>
              <input
                id="title"
                name="title"
                type="text"
                placeholder="CEO, VP Sales, Founder..."
              />
            </div>

            <div className="form-field">
              <label htmlFor="country">Target Country</label>
              <select id="country" name="country" defaultValue="United States">
                <option>United States</option>
                <option>Canada</option>
                <option>United Kingdom</option>
                <option>Australia</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="preferences">Lead Preferences</label>
              <textarea
                id="preferences"
                name="preferences"
                rows={5}
                placeholder="Locations, qualifications, company size, seniority, or anything else..."
              />
            </div>

            <div className="industry-label">Industries</div>

            <div className="industry-list">
              {industries.map((industry) => (
                <label key={industry} className="industry-pill">
                  <input type="checkbox" name="industries" value={industry} />
                  <span>{industry}</span>
                </label>
              ))}
            </div>

            <button type="submit" className="btn btn-primary btn-submit">
              Get Leads Today
              <span>→</span>
            </button>

            <p className="form-note">
              Receive leads directly in your email inbox every week, with
              detailed company info.
            </p>
          </form>
        </section>

        {/* Footer */}
        <footer className="leads-footer">
          <div className="footer-brand">
            <div className="footer-logo">Leads<span>DB</span></div>
            <p>Quality leads. Better outreach. Real growth.</p>
          </div>

          <div className="footer-links">
            <a href="/about">About</a>
            <a href="/api">API</a>
            <a href="/blog">Blog</a>
            <a href="/contact">Contact</a>
          </div>

          <div className="footer-meta">
            <p>© 2024 Soapstone Solutions.</p>
            <p>Developed by Soapstone Solutions</p>
          </div>

          <div className="footer-legal">
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms & Conditions</a>
            <a href="/cookies">Cookie Policy</a>
          </div>
        </footer>
      </main>
    </>
  );
}
