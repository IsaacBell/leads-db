# LeadsDB V2 — Content Strategy & Inbound Plan

**Date:** 2026-08-30  
**Goal:** Breathe life into Isaac Bell's online presence and generate consulting inbound.

The build is LeadsDB V2 (CT consumer, Rust, Neon, docker-compose). The content feeds from it and wraps around it like a halo — every piece IS the project, not a separate thing you have to stop building to do.

---

## The Insight

You have 33 stars on a dead repo. That's not nothing — it's a signal that people want what the README *promises* even though it was never delivered. The content strategy is: **serialize the rebuild in public, and package every artifact into a sellable/attractable format.**

Every piece of engineering work produces multiple content artifacts. You do the work once; you get blog posts, lead magnets, video scripts, and social snippets out of it.

---

## Content Funnel

```
Top of funnel (awareness)     Engineering blog / Twitter / LinkedIn / Hacker News
Middle of funnel (opt-in)     Lead magnets: Jupyter notebooks, cheat sheets, pocket guides
Bottom of funnel (inbound)    "I need a custom lead-gen pipeline" — consulting inquiry
```

---

---

## Immediate Next Steps (pick up here)

### 1. Polish and publish `CT-CONSUMER-FEASIBILITY.md`

Needs work.

- [ ] Address all feedback noted in document
- [ ] Preservation of the more-professional, less amateurish tone
- [ ] Less use of first person, although some use of it does help to sell the professional tone
- [ ] A 1-2 sentence intro hook that sells why a reader should care (or sharpen what's there)


### 2. Write a Python sampler script (before Rust)

Write a small Python script that:
- Hits one old-style CT log (DigiCert Wyvern or similar)
- Fetches 500 entries
- Extracts domains from SANs
- Does basic signal classification (DNS resolves? HTTP response? landing page has business copy?)
- Outputs a CSV with classification

This serves:
- Validates the thesis before Rust commitment
- Produces data for the "what % of SSL certs belong to real businesses" article
- The notebook itself is a lead magnet

---
