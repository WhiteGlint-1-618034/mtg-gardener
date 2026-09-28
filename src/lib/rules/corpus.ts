import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type RuleEntry = { id: string; text: string };

let cache: { effective: string; rules: Map<string, string> } | null = null;

export function indexRules(raw: string): Map<string, string> {
  const rules = new Map<string, string>();
  for (const block of raw.split(/\n\s*\n/)) {
    const text = block.replace(/\s+/g, " ").trim();
    const match = text.match(/^(\d{3}(?:\.\d+)?[a-z]?)\.?\s+(.+)$/);
    if (!match?.[1] || !match[2]) continue;
    rules.set(match[1], match[2]);
  }
  return rules;
}

export function loadRules() {
  if (cache) return cache;
  const path = join(dirname(fileURLToPath(import.meta.url)), "../../../data/rules/MagicCompRules.txt");
  const raw = readFileSync(path, "utf8");
  const effective = raw.match(/effective as of ([^.]+)\./)?.[1] ?? "unknown";
  cache = { effective, rules: indexRules(raw) };
  return cache;
}

export function rule(id: string): string | null {
  return loadRules().rules.get(id) ?? null;
}

const CORE = ["101.1", "113.6", "113.6a", "208.3", "404.2", "604.3", "604.3a", "613.4a", "613.4c", "707.2", "707.9d", "903.3", "903.4", "903.5a", "903.8", "903.9a", "903.10a"];

/** Sections the list actually bumps into. The file is the authority; this is the consult. */
export function rulesExcerpt(oracleBlob: string): string {
  const { effective, rules } = loadRules();
  const blob = oracleBlob.toLowerCase();
  const ids = [...CORE];
  if (/copy|becomes a copy/.test(blob)) ids.push("707.9", "707.9a", "707.9b");
  if (/graveyard/.test(blob)) ids.push("404.1");
  if (/commander/.test(blob)) ids.push("903.1", "903.6", "903.7");
  const seen = new Set<string>();
  const lines = [`Comprehensive Rules, effective ${effective}. These outrank memory.`];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const text = rules.get(id);
    if (text) lines.push(`${id}. ${text}`);
  }
  return lines.join("\n");
}
