# Wiki

---

A "registrable domain" is the domain you actually own and control. For `google.com`, that's `google.com`. For `google.co.uk`, that's `google.co.uk` — because `.co.uk` is a public suffix (like `.com`), not something you can register.

The Public Suffix List (`publicsuffix.org`) is the canonical list that tells you: is this suffix a TLD (`.com`), a managed suffix (`.co.uk`, `.com.au`), or a registrable domain? It's maintained by Mozilla and gets updated regularly.

**Why it matters:**

When you extract domains from a CT log entry like:
- `sub1.awesome-company.co.uk`
- `sub2.awesome-company.co.uk`
- `mail.awesome-company.com`

You want to normalize them down to:
- `awesome-company.co.uk`
- `awesome-company.com`

Without the PSL, you'd have to maintain your own list of every country-code second-level domain. With the PSL, you use a standard library.

---

## Reading List

### Domain Infrastructure & DNS

| Resource | Why |
|---|---|
| **DNS & BIND** (O'Reilly, Cricket Liu) | The DNS bible. Old but foundational. Chapters on zone files, resolution, and DNSSEC. |
| **How DNS Works** (Cloudflare docs, free) | Shorter, more modern. Good refresher on the resolution chain. |
| **Public Suffix List** (publicsuffix.org) | The list itself. Read the FAQ to understand how it's maintained. |
| **The Public Suffix List Explained** (blog post by Jens Ole Lauridsen) | Why the PSL exists and how to use it. |

### Certificate Transparency & PKI

| Resource | Why |
|---|---|
| **RFC 6962** (Certificate Transparency) | The original CT specification. Dense but the source of truth. |
| **RFC 9162** (Static CT API) | The newer spec for Google's modern logs. |
| **Let's Encrypt's CT Log docs** (letsencrypt.org/docs) | Practical overview of how LE submits to logs. Good context. |
| **Certificate Transparency in the Chromium Project** (chromium.org/Home/security/certificate-transparency) | Google's practical explainer. |
| **Bulletproof TLS Newsletter** (Feisty Duck) | Monthly newsletter on TLS/PKI. Good for staying current. |

### B2B Lead Gen & Data

| Resource | Why |
|---|---|
| **Data-Driven Lead Generation** (book, Chris Golec) | Practical strategies. |
| **H2O.ai / Open-source ML classification guides** | Interest reading. |

---

## Communities

### Slack / Discord

| Community | Where | Vibe |
|---|---|---|
| **CTlog** (community discussion) | GitHub issues on the CT log list repo | Low traffic, very technical. The CT log operators sometimes chime in. |
| **Let's Encrypt Community** (community.letsencrypt.org) | Discourse forum | Active. Not specifically CT-oriented but the operators of the biggest logs hang out there. |
| **DNS-OARC** (dns-oarc.net) | Members' Slack, meetings | The DNS operations crowd. High signal, but some meetings require membership. |
| **Hacker News** (news.ycombinator.com) | Web | Not a community per se, but CT-related posts reliably draw domain experts in the comments. |
| **r/netsec** and **r/sysadmin** on Reddit | Reddit | Broader but occasionally has excellent CT/DNS discussions. |
| **CA/Browser Forum** (cabforum.org) | Public mailing list | This is where the actual standards are debated. Monitoring this list gives you advance warning of log policy changes. |

### Email / Mailing Lists

| List | Why |
|---|---|
| **CA/Browser Forum Public List** | Policy changes that affect which logs are trusted. |
| **DNS-OARC mailing lists** | For deep DNS infrastructure discussions. |
| **IETF ACME Working Group** | Where Let's Encrypt's protocol is discussed. ACME is how certs get issued, which is upstream of CT log entries. |

### Conferences / Meetups

| Event | Why |
|---|---|
| **IETF meetings** (quarterly) | Where the CT specs are debated. Expensive but the archives are public. |
| **Let's Encrypt Community Calls** (monthly) | Free, virtual. Good pulse on cert issuance trends. |
| **DNS-OARC workshops** | Twice yearly, virtual option. Deep DNS operations. |

---

## How to Find More

- **Search for "certificate transparency monitoring" on GitHub** — there are several open-source monitoring projects; the people maintaining them are potential peers.
- **Follow Let's Encrypt's blog** — they announce log changes, new log operators, and deprecations.
- **Subscribe to Google's CT log status page** — Google's logs process the majority of certificates, so their status is your status.
