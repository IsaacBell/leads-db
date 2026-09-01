# leads-db Agent Rules

## PII / Secret Guard (Always-On, Non-Negotiable)

The sub-harness at `scripts/guard-secrets.sh` enforces PII/secret protection in agent output. It is always active.

### Never Do These

- **Never print personal names** abbreviated names like ABC only
- **Never print emails, phone numbers, SSNs, street addresses**.
- **Never print family/relationship references** (my mom, dad, wife, son, daughter, sister, brother, etc.).
- **Never print internal role references** (boss, intern, coworker).
- **Never print compensation** (`$X/hr`, `$X/year`, etc.).
- **Never read `.env` files, `credentials/` directories, or any secret files.**
- **Never print, access, or display env vars in any way.**
- **Never try to run bare `env`, `printenv`, or `export`** — these dump the whole environment.
- **Never run `vercel env pull` raw.** — this writes secrets to disk. there are secure pre-written commands for these kinds of actions.
- **Never run `infisical secrets`, `infisical get`, `infisical export`, or any `infisical` command except `infisical run`.**
- **Never use `pg_dump`/`psql`/`pg_restore` with inline connection strings.**

### How to Use a Secret

```
% infisical run -- <cmd>
% infisical run --env dev -- <cmd>
% infisical run --env prod -- <cmd>
```


### How to Guard Risky Command Output

```
just check-secrets "<command-string>"
just guard-pii
```

---

## Package Manager

- **pnpm only.** Use `pnpm dlx` instead of `npx`.
