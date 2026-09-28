import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog, Line, SigCard } from "./types";

const built = join(dirname(fileURLToPath(import.meta.url)), "../../../data/catalog/built");

async function linesOf(file: string): Promise<string[]> {
  const out: string[] = [];
  const rl = createInterface({ input: createReadStream(join(built, file)), crlfDelay: Infinity });
  for await (const line of rl) if (line) out.push(line);
  return out;
}

let pending: Promise<Catalog> | null = null;

export function loadCatalog(): Promise<Catalog> {
  if (!pending) pending = read();
  return pending;
}

async function read(): Promise<Catalog> {
  const [cardLines, rulingLines, lineLines] = await Promise.all([
    linesOf("cards.sig.jsonl"),
    linesOf("rulings.jsonl"),
    linesOf("lines.jsonl"),
  ]);
  const cards = cardLines.map((line) => JSON.parse(line) as SigCard);
  const byName = new Map(cards.map((card) => [card.n.toLowerCase(), card]));
  const rulings = new Map<string, string[]>();
  for (const line of rulingLines) {
    const row = JSON.parse(line) as { id: string; c: string[] };
    rulings.set(row.id, row.c);
  }
  const lines = lineLines.map((line) => JSON.parse(line) as Line);
  return { cards, byName, rulings, lines };
}
