#!/usr/bin/env node
// Silver-gate repo-wide scanner. Scans all markdown/text files against
// shared pattern config. Use for CI or manual pre-publish checks.
//
// Usage:
//   node scripts/silver-gate-repo.mjs                    # scan entire repo
//   node scripts/silver-gate-repo.mjs --staged            # scan staged files only
//   node scripts/silver-gate-repo.mjs --path docs/        # scan a specific path
//   node scripts/silver-gate-repo.mjs --block-only        # only print blockers
//
// Severity guide:
//   block = reader descriptions, PII secrets, AI-speak — must fix before publish
//   warn  = internal framing, personal names — flag for review

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, extname, join } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = resolve(REPO_ROOT, "scripts/silver-gate-patterns.json");
const COLOR = !!process.stdout.isTTY;

const red = (s) => COLOR ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = (s) => COLOR ? `\x1b[33m${s}\x1b[0m` : s;
const bold = (s) => COLOR ? `\x1b[1m${s}\x1b[0m` : s;

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const allPatterns = [
  ...(config.pii || []).map((p) => ({ ...p, category: "pii" })),
  ...(config.internal_framing || []).map((p) => ({ ...p, category: "internal_framing" })),
  ...(config.family_references || []).map((p) => ({ ...p, category: "family_references" })),
  ...(config.reader_description || []).map((p) => ({ ...p, category: "reader_description" })),
];

const excludeGlobs = config.exclude_paths || [];
const TEXT_EXTS = new Set([".md", ".mdx", ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml", ".toml", ".html", ".css", ".mjs", ".cjs", ".sh", ".bash", ".zsh", ".txt", ".csv", ".tsv"]);

const args = process.argv.slice(2);
const stagedOnly = args.includes("--staged");
const blockOnly = args.includes("--block-only");
const scanPaths = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--path" && args[i + 1]) {
    scanPaths.push(args[i + 1]);
    i++;
  }
}

function isExcluded(filePath) {
  const rel = relative(REPO_ROOT, filePath);
  return excludeGlobs.some((g) => {
    if (g.includes("*")) return new RegExp("^" + g.replace(/\*/g, ".*").replace(/\./g, "\\.") + "$").test(rel);
    return rel.startsWith(g) || rel.includes("/" + g + "/") || rel.includes("/" + g);
  });
}

function collectFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    if (isExcluded(full)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry.startsWith(".") && entry !== ".") continue;
      results.push(...collectFiles(full));
    } else if (TEXT_EXTS.has(extname(entry).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function getFiles() {
  if (stagedOnly) {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", { cwd: REPO_ROOT, encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean).map((f) => resolve(REPO_ROOT, f)).filter((f) => existsSync(f) && !isExcluded(f) && TEXT_EXTS.has(extname(f).toLowerCase()));
  }
  if (scanPaths.length > 0) {
    return scanPaths.flatMap((p) => {
      const full = resolve(p);
      return statSync(full).isDirectory() ? collectFiles(full) : [full];
    }).filter((f) => TEXT_EXTS.has(extname(f).toLowerCase()));
  }
  return collectFiles(REPO_ROOT);
}

const files = getFiles();
let totalBlockers = 0;
let totalWarnings = 0;
let filesWithHits = 0;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  const rel = relative(REPO_ROOT, file);
  const fileHits = [];

  for (const pattern of allPatterns) {
    const regex = new RegExp(pattern.pattern, "gi");
    const matches = [...content.matchAll(regex)];
    if (matches.length === 0) continue;

    for (const match of matches) {
      const idx = match.index;
      const before = content.slice(0, idx);
      const lineNum = (before.match(/\n/g) || []).length + 1;
      const ctx = lines[lineNum - 1].trim().slice(0, 120);
      fileHits.push({ ...pattern, line: lineNum, match: match[0], context: ctx });
    }
  }

  if (fileHits.length === 0) continue;
  filesWithHits++;

  const blockers = fileHits.filter((h) => h.severity === "block");
  const warns = fileHits.filter((h) => h.severity !== "block");
  totalBlockers += blockers.length;
  totalWarnings += warns.length;

  if (blockOnly && blockers.length === 0) continue;

  console.log(`\n${bold(rel)}`);
  for (const h of blockers) {
    console.log(`  ${red("❌")} ${h.note || h.name}:${h.line}  ${yellow(h.context)}`);
  }
  if (!blockOnly) {
    for (const h of warns) {
      console.log(`  ⚠  ${h.note || h.name}:${h.line}  ${h.context}`);
    }
  }
}

console.log("");
if (totalBlockers > 0) {
  console.log(`${red(`❌ ${totalBlockers} blocker(s)`)}  ⚠ ${totalWarnings} warning(s)  across ${filesWithHits} file(s)`);
  process.exit(1);
} else {
  console.log(`${files.length} files scanned  ⚠ ${totalWarnings} warning(s)  across ${filesWithHits} file(s)`);
  process.exit(0);
}
