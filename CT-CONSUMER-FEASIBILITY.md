# Mining Free Data for B2B Leads - A Practical Guide

**Author:** Isaac Bell

**Date:** 2026-08-30

---

Scraping business directories is slow. Buying lists is expensive and full of stale data. Can we pull free data instead? Yes we can, by piggybacking on Certificate Transparency (CT) logs.

Every time a company gets a certificate for their website, that certificate gets published to public record. That means every new website, every renewed website; all of them are listed. 

The idea sounds good. 

What's the catch? Millions of new websites are created each day. That's a lot to sort through - too much for a human to process. Too much for a computer to process, without help. But with the right approach, we can make our machine do more with less.

Let's build our system. Our inputs and outputs are:

1. We take in web domains, for example, my-website.com. 
  a. For the domains that belong to real businesses, we want to add them to our business registry and do business research on them
2. Our output is final list of businesses, with enhanced data

Before we create an entire app experience around this, let's do some exploration and try to figure out what this would *actually* cost to bring to market. This is the exploration phase, before committing to a build.

---

## Setting Expectations

There are three questions to answer before making our solution:

1. **Can we technically get that log data?** 
2. **What is the data useful for?** 
3. **Is it worth the time and effort?** 



---

## What Is a CT Log?

When a Certificate Authority (CA) issues a certificate, they submit it to one or more Certificate Transparency logs. These logs are public and verifiable. Anyone can monitor them. This was designed for security researchers, but they are also handy for other purposes. In our case, we want to use them to build out our catalogue of B2B leads.

Google keeps a published list of all recognized logs, available as a ~30KB JSON file at:

```
https://www.gstatic.com/ct/log_list/v3/all_logs_list.json
```

This list covers **7 major operators** and a handful of smaller ones. Think of these operators like different record depositories — they each run their own set of filing cabinets:

| Operator | Notes |
|---|---|
| Google | Operates multiple logs (Pilot, ParcelYard, etc.) |
| Let's Encrypt | Multiple logs (Sycamore, Oak, etc.) |
| DigiCert | Multiple logs (Wyvern, etc.) |
| Cloudflare | Operates logs including Nimbus |
| Sectigo | Multiple logs |
| TrustAsia | Primarily Asian market |
| Geomys | Community-managed log |
| *Also:* IPng Networks, Microsec, GoDaddy | Small operators, some regional |

> **Visual idea:** A simple diagram showing: CA issues cert → cert goes to log (the filing cabinet) → we read from log → we extract domains → domains go to enrichment pipeline. Let me know if you want me to describe one for a graphic designer.

Each log has a **state** field (`usable`, `readonly`, `rejected`, `retired`, or `pending`). You only want to consume from `usable` logs. The list changes over time as logs are phased out.

### A Quick Naming Note

Logs have names like `Sycamore2026h2`. That breaks down as:

- **Sycamore** = the log's actual name. Let's Encrypt names their logs after trees for some reason — Oak, Sycamore, etc.
- **2026h2** = second half of 2026. Logs are sharded by time — they only cover rolling six-month windows. This keeps the filing cabinet from growing infinitely large. When the window closes, a new shard opens for the next six months.

So `Sycamore2026h2` means "the Sycamore log's shard for the second half of 2026." Each shard starts fresh.

### The Two API Flavors

There are **two API types** in the wild:

- **Old-style (RFC 6962):** The original CT protocol. Logs expose endpoints like `/ct/v1/get-sth`, `/ct/v1/get-entries`, etc. These logs have a *maximum merge delay* (MMD) measured in hours or days. They're still used by some operators.
- **New-style (Static CT API):** Google's modern approach. Logs are backed by Google Cloud Storage tiles. MMD is 60 seconds. These are much faster, and the spec is cleaner&mdash;but the access patterns are less obvious.

---

## Live-Fetching the Old-Style Logs: What We Actually Saw

Theory is fine. I wanted to see what these logs actually return when you hit them. A real endpoint call tells you things a spec sheet can't — response times, data sizes, error behaviors. Plus it's free to try.

I picked an old-style log because it's the easiest to query. Let's hit the DigiCert Wyvern log for the `2026h2` shard. The get-sth (Signed Tree Head) endpoint tells you how many entries the log contains:

> **Interactive version:** This will end up in a Jupyter notebook at some point so you can run it yourself. For now, here's what I got.

```
https://wyvern.ct.digicert.com/2026h2/ct/v1/get-sth
```

The response:

The response reports a tree size of roughly 1.8 billion entries.

**That's ~1.8B entries.** One log shard, covering roughly six months. 1.8 billion certificates.

To consume this log, you'd maintain a cursor (your last-fetched position) and repeatedly fetch batches of entries from your cursor up to `tree_size`. The log tells you the current size; you fetch sequentially.

RFC 6962 requires logs to provide sufficient capacity for monitoring above the normal growth rate. In practice, I suspect the bottleneck is going to be how fast I can *process* the data, not how fast the log serves it.

---

## Live-Fetching the New-Style Static CT API Logs

Google's logs use the Static CT API, backed by GCS (Google Cloud Storage). Same goes for Let's Encrypt's, a well-known security company. 

I'll check both of them to see what data they return.

### Google's ParcelYard

```
https://storage.googleapis.com/parcelyard2026h2.prod.certificate.transparency.goog/checkpoint
```

The response (plaintext, not JSON):

The checkpoint reports a tree size of roughly 1.1 billion entries.

### Let's Encrypt's Sycamore

```
https://mon.sycamore.ct.letsencrypt.org/2026h2/checkpoint
```

Tree size: roughly 715 million entries.

This checkpoint format is defined by the Static CT API: first line is the log name, second line is the tree size, third line is the root hash, followed by signature data.

### Where I Hit a Wall

The new-style logs store their actual certificate data in chunks called tiles — basically pages of the filing cabinet stored in Google Cloud Storage. I tried to guess the URL pattern to download tiles directly. Got 403s on one, 404s on the other.

> **Quick aside on tiles:** Think of tiles like pages torn out of the filing cabinet. Each page has a fixed number of certificates on it. To get the data, you have to know which page to ask for and how to identify it. The pattern is well-defined in the spec, but it's not something you can guess by looking at the URL.

To save time working on these details, use a client library. Libraries exist in Go, Rust, and Python that handle tile addressing automatically. Trying to do it by hand was a waste of time — a lesson I should have known going in.

**The takeaway here:** you can't just curl your way into the static logs. Use a client library or fall back to old-style logs that serve traditional HTTP endpoints.

---

## The Volume Problem (in Plain Numbers)

Let's put the 1-2 billion entries per log shard in context.

| Scale | Number |
|---|---|
| Certificates Let's Encrypt issues per day | ~10 million |
| Unique domains per typical cert | 1-10 (SANs) |
| Logs each cert appears in | 2-3 |
| Entries in one 6-month log shard | 700 million - 1.8 billion |

Rough math: the internet issues around 10 million new/updated certificates daily. Each appears in 2-3 different logs. Each cert typically has 1-10 domain names listed as Subject Alternative Names (SANs).

After deduplication across logs and shards, you're looking at maybe **5-10 million unique domains per day**.

To give you a sense: that's more domains in a week than there are businesses in New York City. Most of them are noise — parked domains, default hosting pages, personal projects, internal subdomains. The challenge isn't getting the data. It's finding the signal in 10 million new entries a day.

---

## What We Still Don't Know (And Can't Know Without Running It)

These are the open questions that a day of endpoint poking cannot answer. They require actually processing entries and running enrichment.

### 1. Signal-to-Noise Ratio: How Many Domains Are Real Businesses?

This is THE question. The CT log tells you a web domain was registered. It does *not* tell you:

- Whether the domain resolves to a real website
- Whether that website represents a business
- What kind of business it is (SaaS, e-commerce, local services, etc.)
- Whether it's a new domain or a renewal

A massive percentage of issued certificates will be for parked domains, renewals, personal projects, or junk domains.

### 2. How Many Are Renewals vs. New Registrations?

A company that has had the same website for 5 years gets a new certificate every 90 days (for Let's Encrypt) or every 1-2 years (for paid CAs). The CT log entry for a renewal looks identical to the entry for the original registration.

This means a significant fraction of daily entries are duplicates of domains you've already seen. Any code solution needs to handle:

- The same domain appearing in multiple logs (same cert, different log)
- The same domain appearing multiple times in the same log (renewals)
- The same domain with different subdomains (different certs)
