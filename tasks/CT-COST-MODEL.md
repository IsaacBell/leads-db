# CT Consumer: Cost & Architecture Model

**Question:** What does "consuming CT logs" actually mean operationally, and what does it cost?

---

## The Architecture Models

### Model A: Polling (pull-based, what the Rust consumer does)

```
Every N minutes:  
  GET /ct/v1/get-sth                      (1 request, tells you tree_size)
  For each new entry since your cursor:
    GET /ct/v1/get-entries?start=X&end=Y  (1 request per batch)
    Parse cert, extract domains
    Store in Postgres
```

- **Latency:** Minutes to hours behind real-time (depends on poll interval)
- **Cost:** ~free (bandwidth is negligible, no API billing)
- **Setup complexity:** Low-moderate (HTTP client + cert parser)
- **Incremental cost:** ~$0/month in API fees, maybe a few dollars for compute

You start at the beginning of the log and catch up over days/weeks, then poll for new entries every few minutes.

### Model B: Streaming (push-based, like certstream)

```
Connect to WebSocket → receive certs in real-time as they're issued
```

- **Latency:** Seconds behind real-time
- **Cost:** Free (certstream is a free public service)
- **Setup complexity:** Low (WebSocket client)
- **Downside:** You only get future certs, no historical data. Someone else's infrastructure (certstream goes down sometimes).

https://certstream.calidog.io/

https://certstream.dev/

### Model C: Hybrid

Use certstream for real-time signals (new businesses launching today = hot leads), plus poll old-style logs for historical catch-up (building the database).

---

## The Real Cost Breakdown

### One-time setup (before a single lead)

| Item | Cost | Notes |
|---|---|---|
| Rust learning curve | Your time | You're already committing to this |
| Python sampler (one afternoon) | $0 | Validate thesis before Rust |
| Domain + hosting (isaacbell.io) | ~$10-15/mo | Already have this |
| Neon Postgres free tier | $0 | 0.5GB storage, scale-to-zero |
| Total one-time | $0 cash + your time | |

### Ongoing (when the Rust consumer is running)

| Item | Monthly | Notes |
|---|---|---|
| Neon Postgres (production) | $0-19/mo | Free tier covers light usage; $19/mo for 1GB RAM / 10GB storage |
| Compute (CT consumer) | $0-5/mo | Runs on a cheap VPS ($5/mo DigitalOcean/Linode) or your own machine |
| Enrichment API | $0-99/mo | Free tier for sampler, paid only if you go to production |
| Total ongoing | $0-123/mo | Ranges from $0 for hobby to $123/mo for full production |

### At scale (10M+ domains/day, full pipeline)

| Item | Cost |
|---|---|
| Postgres (scale up) | $50-200/mo (Neon or similar serverless) |
| Enrichment API | $1,000-3,000/mo (if you use a paid provider) |
| Compute | $20-50/mo |
| **Total** | **$1,070-3,250/mo** (but only after you have paying users) |

---

## The Sampler Cost (Before You Write Any Rust)

Building a Python sampler to validate signal-to-noise:
- **Time:** 4-6 hours
- **Money:** $0 (free tier APIs + DNS + HTTP)
- **Outputs:** A CSV of 500-1000 sampled domains with preliminary classification
- **Answer to:** "Is the signal-to-noise ratio good enough to build the full pipeline?"

This is the equivalent of a market research call that costs you nothing.

---

## Real Talk About Pricing

The full production pipeline at scale costs money — but that's future-you's problem. The Phase 1 pipeline (docker-compose up, demo with seed data) costs nothing. The Rust consumer against one log costs nothing in API fees. The only cost is your time and whatever compute you run it on.

The expensive parts (enrichment APIs, scaled Postgres) only kick in when you have users who are actually getting value from the data. That's the right order: prove value → get users → spend money on scale.
