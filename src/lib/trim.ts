import type { CardVerdict, Deck } from "./types";
import { judgeDeck } from "./catalog/judge";
import { tiltRead } from "./engine/preferences";
import { readDeck } from "./engine/score";

/** Engine read first. Intake only explains a stay the graph already earned. */
export function cardStays(deck: Deck, name: string): string | null {
  const read = readDeck(deck);
  if (!read) return null;
  const cut = judgeDeck(deck, null).trim.some((t) => t.name.toLowerCase() === name.toLowerCase());
  if (cut) return null;
  const row = tiltRead(read, deck).find((r) => r.card.name.toLowerCase() === name.toLowerCase());
  if (!row) return null;
  const why = row.factors.join("; ") || "the graph links it to this commander";
  return row.preference ? `${row.card.name} stays. ${why}. Then intake: ${row.preference}.` : `${row.card.name} stays. ${why}.`;
}

/**
 * Least-linked cards first, enough to reach 100.
 * A swap is not a cut. Known lines and commander fuel are not cuts.
 */
export function sizeCuts(deck: Deck): CardVerdict[] {
  const read = readDeck(deck);
  if (!read || read.need <= 0) return [];
  return judgeDeck(deck, null).trim;
}