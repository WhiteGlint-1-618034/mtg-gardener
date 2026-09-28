import type { CachedCard, DeckEntry } from "./types";

export const CATEGORY_ORDER = [
  "Commander",
  "Planeswalkers",
  "Creatures",
  "Instants",
  "Sorceries",
  "Enchantments",
  "Artifacts",
  "Battles",
  "Lands",
  "Other",
  "Sideboard",
  "Nursery",
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

export function categoryFor(entry: DeckEntry, card: CachedCard | undefined): Category {
  if (entry.zone === "nursery") return "Nursery";
  if (entry.zone === "sideboard") return "Sideboard";
  if (entry.zone === "commander") return "Commander";
  const t = (card?.typeLine ?? "").toLowerCase();
  if (t.includes("land")) return "Lands";
  if (t.includes("planeswalker")) return "Planeswalkers";
  if (t.includes("creature")) return "Creatures";
  if (t.includes("instant")) return "Instants";
  if (t.includes("sorcery")) return "Sorceries";
  if (t.includes("enchantment")) return "Enchantments";
  if (t.includes("artifact")) return "Artifacts";
  if (t.includes("battle")) return "Battles";
  return "Other";
}

export function groupedEntries(
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
): { category: Category; rows: DeckEntry[]; count: number }[] {
  const buckets = new Map<Category, DeckEntry[]>();
  for (const cat of CATEGORY_ORDER) buckets.set(cat, []);
  for (const e of entries) {
    const card = cards[e.name.toLowerCase()];
    const cat = categoryFor(e, card);
    buckets.get(cat)!.push(e);
  }
  for (const rows of buckets.values()) {
    rows.sort((a, b) => {
      const ca = cards[a.name.toLowerCase()];
      const cb = cards[b.name.toLowerCase()];
      const cmc = (ca?.cmc ?? 99) - (cb?.cmc ?? 99);
      if (cmc !== 0) return cmc;
      return a.name.localeCompare(b.name);
    });
  }
  return CATEGORY_ORDER.map((category) => {
    const rows = buckets.get(category) ?? [];
    const count = rows.reduce((n, r) => n + r.count, 0);
    return { category, rows, count };
  }).filter((g) => g.rows.length > 0);
}

export function lookup(cards: Record<string, CachedCard>, name: string) {
  return cards[name.toLowerCase()];
}

export function colorIdentityOf(
  commanderName: string | null,
  cards: Record<string, CachedCard>,
  entries: DeckEntry[],
): string[] {
  if (commanderName) {
    const c = lookup(cards, commanderName);
    if (c) return c.colorIdentity;
  }
  const set = new Set<string>();
  for (const e of entries) {
    if (e.zone === "nursery") continue;
    const card = lookup(cards, e.name);
    for (const col of card?.colorIdentity ?? []) set.add(col);
  }
  const order = ["W", "U", "B", "R", "G"];
  return order.filter((c) => set.has(c));
}

export function detectCommander(entries: DeckEntry[], cards: Record<string, CachedCard>): string | null {
  const tagged = entries.find((e) => e.zone === "commander");
  if (tagged) return tagged.name;
  const legends: DeckEntry[] = [];
  for (const e of entries) {
    const c = lookup(cards, e.name);
    if (!c) continue;
    const t = c.typeLine.toLowerCase();
    if (t.includes("legendary") && t.includes("creature")) legends.push(e);
  }
  if (legends.length === 1) return legends[0]!.name;
  return null;
}

export function isMainZone(zone: DeckEntry["zone"]) {
  return zone === "main" || zone === "commander";
}

export function mainCount(entries: DeckEntry[]) {
  return entries.filter((e) => isMainZone(e.zone)).reduce((n, e) => n + e.count, 0);
}
