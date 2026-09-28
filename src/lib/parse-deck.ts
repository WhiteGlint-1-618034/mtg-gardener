import type { DeckEntry, Zone } from "./types";

const SECTION =
  /^(land|lands|creature|creatures|instant|instants|sorcery|sorceries|artifact|artifacts|enchantment|enchantments|planeswalker|planeswalkers|battle|battles|commander|commanders|sideboard|maybeboard|considering|nursery|deck|other)\s*(?:\(?\d+\)?)?\s*$/i;

const CARD_LINE =
  /^(?:[*•\-]\s*)?(\d+)\s*x?\s+(.+?)\s*$/i;

const SET_SUFFIX = /\s+\([A-Za-z0-9]{2,5}\)(?:\s+\S+)?\s*$/;

function zoneForSection(section: string): Zone {
  const s = section.toLowerCase();
  if (s.startsWith("commander")) return "commander";
  if (s.startsWith("side")) return "sideboard";
  if (s.startsWith("maybe") || s.startsWith("consider") || s.startsWith("nursery")) return "nursery";
  return "main";
}

function cleanName(raw: string) {
  return raw.replace(SET_SUFFIX, "").replace(/\s+/g, " ").trim();
}

export function parseDeckList(raw: string): DeckEntry[] {
  const merged = new Map<string, DeckEntry>();
  let section = "deck";
  for (const line0 of raw.split(/\r?\n/)) {
    const line = line0.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    if (SECTION.test(line)) {
      section = line.replace(/\(.*\)/, "").trim();
      continue;
    }
    const m = line.match(CARD_LINE);
    if (!m) continue;
    const count = Number(m[1]);
    const name = cleanName(m[2] ?? "");
    if (!name || !count) continue;
    const zone = zoneForSection(section);
    const key = `${zone}::${name.toLowerCase()}`;
    const prev = merged.get(key);
    if (prev) prev.count += count;
    else merged.set(key, { count, name, zone });
  }
  return [...merged.values()];
}

export function uniqueNames(entries: DeckEntry[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const k = e.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e.name);
  }
  return out;
}
