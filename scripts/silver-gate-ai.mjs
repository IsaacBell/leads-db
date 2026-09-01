#!/usr/bin/env node
// Silver-gate AI pass — uses the generic AI gateway to scan files for
// tone/voice violations that deterministic patterns can't catch.
//
// Usage:
//   node scripts/silver-gate-ai.mjs --path docs/apprentice-visit/training/
//   node scripts/silver-gate-ai.mjs --path docs/apprentice-visit/training/nocodb-intro.md
//   node scripts/silver-gate-ai.mjs --staged
//   node scripts/silver-gate-ai.mjs --provider ollama --model llama3.2 --path docs/
//
// Providers (via ai-gateway.mjs):  deepinfra | vercel | openai | ollama
// Defaults to deepinfra with DEEPINFRA_API_KEY from env.
//
// Cost-conscious: skips files that pass deterministic scan (no warnings).
// Only sends content that might have issues to the AI.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, extname, join } from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "./ai-gateway.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_PATH = resolve(REPO_ROOT, "scripts/silver-gate-patterns.json");

const args = process.argv.slice(2);
const stagedOnly = args.includes("--staged");
const providerIdx = args.indexOf("--provider");
const provider = providerIdx >= 0 ? args[providerIdx + 1] : "deepinfra";
const modelIdx = args.indexOf("--model");
const model = modelIdx >= 0 ? args[modelIdx + 1] : null;
const cheap = args.includes("--cheap");

const SCAN_EXTS = new Set([".md", ".mdx"]);
const EXCLUDE = new Set(["node_modules", ".git", ".code-intel-mcp", "pnpm-lock.yaml", "package-lock.json"]);
const MAX_CHUNK_CHARS = 4000;
const MAX_FILE_CHARS = 12000;

function collectFiles(dir) {
  const results = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (EXCLUDE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry.startsWith(".")) continue;
      results.push(...collectFiles(full));
    } else if (SCAN_EXTS.has(extname(entry).toLowerCase())) {
      results.push(full);
    }
  }
  return results;
}

function getFiles() {
  if (stagedOnly) {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", { cwd: REPO_ROOT, encoding: "utf8" });
    return out.trim().split("\n").filter(Boolean).map((f) => resolve(REPO_ROOT, f)).filter((f) => existsSync(f) && SCAN_EXTS.has(extname(f).toLowerCase()));
  }
  const scanPaths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) {
      scanPaths.push(args[i + 1]);
      i++;
    }
  }
  if (scanPaths.length > 0) {
    return scanPaths.flatMap((p) => {
      const full = resolve(p);
      if (!existsSync(full)) return [];
      return statSync(full).isDirectory() ? collectFiles(full) : [full];
    }).filter((f) => SCAN_EXTS.has(extname(f).toLowerCase()));
  }
  return collectFiles(REPO_ROOT);
}

const AI_SYSTEM_PROMPT = `You are a content voice auditor. Scan the provided text for these violations.
For each violation found, return a line with the format: FILENAME:LINE:SEVERITY:TYPE:EXPLANATION

Violation types to detect:

1. DESCRIBING_THE_READER — The text describes who the reader is (age, education level, job role, life stage, skill level). Examples: "Written for a high school student", "If you're a new developer", "For someone who has never used a terminal". The document should describe what it teaches, not who the reader is.

2. YOUR_ROLE — Using "your [role]" to refer to someone. Examples: "your trainer", "your manager", "your supervisor". Use first-person ("I", "me") or the person's name instead.

3. FAKE_CHEERLEADING — Patronizing motivational language. Examples: "That's your first win!", "You've got this!", "Way to go!", "I'm proud of you". The AI cannot feel pride and should not pretend to.

4. FAKE_EMPATHY — The AI pretending to have feelings or understand human experience. Examples: "I understand how you feel", "It's totally normal to feel overwhelmed", "I get it — change is hard". The AI has no feelings and should not claim to share human experience.

5. SCRIPTING_WORDS — Telling someone exactly what to say to another person. Examples: "Send me a message that says 'found it'", "Tell them 'I completed the task'". Give the instruction, don't script the words.

6. I_KNOW_WHO_YOU_ARE — Making assumptions about the reader's background, situation, or context. Examples: "You probably use a phone every day", "As someone new to tech", "You've likely never seen a database before". State facts neutrally; don't assume knowledge of the reader.

7. CREEPY_INTIMACY — Overly familiar or invasive language. Examples: long instructions that end with a single short imperative ("Open NocoDB. Find the MacBook."), text that feels like it's staring at the reader.

Return violations as: FILE:LINE:SEVERITY:TYPE:brief explanation of violation
Severity is BLOCK or WARN.
If no violations, return "CLEAN".`;

function chunkText(text, maxChars) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const warnPatterns = [
  ...(config.pii || []).filter((p) => p.severity === "warn"),
  ...(config.internal_framing || []),
  ...(config.family_references || []).filter((p) => p.severity === "warn"),
  ...(config.reader_description || []).filter((p) => p.severity === "warn"),
];

function hasDeterministicWarnings(content) {
  for (const p of warnPatterns) {
    if (new RegExp(p.pattern, "gi").test(content)) return true;
  }
  return false;
}

function addLineNumbers(text) {
  const lines = text.split("\n");
  return lines.map((l, i) => `${String(i + 1).padStart(4)}| ${l}`).join("\n");
}

const files = getFiles();
if (files.length === 0) {
  console.log("No files to scan.");
  process.exit(0);
}

const client = createClient({
  provider,
  ...(model ? { model } : {}),
  ...(cheap ? { model: "microsoft/Phi-4" } : {}),
});

const COLOR = !!process.stdout.isTTY;
const red = (s) => COLOR ? `\x1b[31m${s}\x1b[0m` : s;
const yellow = (s) => COLOR ? `\x1b[33m${s}\x1b[0m` : s;
const bold = (s) => COLOR ? `\x1b[1m${s}\x1b[0m` : s;
const dim = (s) => COLOR ? `\x1b[2m${s}\x1b[0m` : s;

let totalScanned = 0;
let totalAIScanned = 0;
let totalBlockers = 0;
let totalWarnings = 0;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const rel = relative(REPO_ROOT, file);

  // In cheap mode, scan everything — the model costs under $0.001/run.
  // Without cheap, only scan files with deterministic warnings to keep costs down.
  if (!cheap && !hasDeterministicWarnings(content)) {
    console.log(`${dim("✓")} ${rel}  ${dim("(clean — skipped)")}`);
    totalScanned++;
    continue;
  }

  if (content.length > MAX_FILE_CHARS) {
    console.log(`${dim("⊘")} ${rel}  ${dim("(too large, skipped)")}`);
    totalScanned++;
    continue;
  }

  totalAIScanned++;
  const chunks = chunkText(content, MAX_CHUNK_CHARS);
  const violations = [];

  for (let i = 0; i < chunks.length; i++) {
    const numbered = addLineNumbers(chunks[i]);
    const baseLine = content.slice(0, content.indexOf(chunks[i])).split("\n").length;

    try {
      const result = await client.chat({
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: `File: ${rel}\n\n${numbered}` },
        ],
        maxTokens: 1024,
        temperature: 0,
      });

      if (!result || result.trim() === "CLEAN") continue;

      for (const line of result.trim().split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "CLEAN") continue;
        const parts = trimmed.split(":");
        if (parts.length < 3) continue;
        const lineNum = parseInt(parts[parts.length - 3] || "0", 10);
        const severity = parts[parts.length - 2];
        violations.push({
          line: isNaN(lineNum) ? baseLine + 1 : lineNum,
          severity: severity === "BLOCK" ? "block" : "warn",
          text: trimmed,
        });
      }
    } catch (err) {
      console.error(`${red("✗")} ${rel}  API error: ${err.message}`);
    }
  }

  if (violations.length === 0) {
    console.log(`${dim("✓")} ${rel}  ${dim("(AI: clean)")}`);
    totalScanned++;
    continue;
  }

  console.log(`\n${bold(rel)}`);
  const blockers = violations.filter((v) => v.severity === "block");
  const warns = violations.filter((v) => v.severity !== "block");
  totalBlockers += blockers.length;
  totalWarnings += warns.length;

  for (const v of blockers) {
    console.log(`  ${red("❌")} L${v.line}  ${red(v.text)}`);
  }
  for (const v of warns) {
    console.log(`  ⚠  L${v.line}  ${v.text}`);
  }
  totalScanned++;
}

console.log("");
console.log(`${totalScanned} files scanned  (${totalAIScanned} via AI)`);
if (totalBlockers > 0) {
  console.log(`${red(`❌ ${totalBlockers} blocker(s)`)}  ⚠ ${totalWarnings} warning(s)`);
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log(`⚠ ${totalWarnings} warning(s)`);
} else {
  console.log(`${dim("No violations found.")}`);
}
