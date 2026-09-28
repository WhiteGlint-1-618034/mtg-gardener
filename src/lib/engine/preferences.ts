import { splitCardNames, type Deck, type SeedPacket } from "../types";
import type { EngineRead, EngineRow } from "./score";

const LANE_EVENTS: Record<string, string[]> = {
  voltron: ["be.equipment", "be.aura", "equipment.attach", "aura.attach"],
  wide: ["token.create"],
  alt: ["poison"],
  value: ["draw"],
  control: ["counterspell", "wipe"],
  combo: ["spell.copy", "clone", "cheat.cast"],
  toolbox: ["tutor", "tutor.land"],
  none: [],
  unknown: [],
};

function names(packet: SeedPacket) {
  return new Set(
    [...packet.lockedNames, ...splitCardNames(packet.engines), ...splitCardNames(packet.payoffs), ...splitCardNames(packet.glue), ...splitCardNames(packet.petCards)].map(
      (n) => n.toLowerCase(),
    ),
  );
}

function hitsLane(row: EngineRow, events: string[]) {
  for (const event of events) {
    if (row.signals.produces.has(event) || row.signals.consumes.has(event) || row.signals.implicit.has(event)) return true;
  }
  return false;
}

export type Tilted = EngineRow & { score: number; preference: string | null };

/**
 * Re-rank an engine read. Does not invent synergy. Locks and named lanes only
 * protect or reorder what the graph already scored.
 */
export function tiltRead(read: EngineRead, deck: Deck): Tilted[] {
  const packet = deck.packet;
  const keep = names(packet);
  const lanes = packet.lanes?.length ? packet.lanes : packet.lane ? [packet.lane] : [];
  const laneEvents = lanes.flatMap((lane) => LANE_EVENTS[lane] ?? []);
  const theme = packet.themeIntensity;
  const failing = new Set(packet.failings ?? []);
  const noteWords = new Set(
    `${packet.driveNotes} ${packet.feedback}`.toLowerCase().split(/[^a-z0-9+]+/).filter((w) => w.length > 4),
  );

  const tilted: Tilted[] = read.rows.map((row) => {
    let score = row.engineScore;
    let vital = row.vital;
    let preference: string | null = null;
    const key = row.card.name.toLowerCase();
    if (keep.has(key)) {
      vital = true;
      score += 1000;
      preference = "intake lock, engine, payoff, glue, or pet";
    }
    if (!vital && laneEvents.length && hitsLane(row, laneEvents)) {
      score += 40;
      preference = `lane ${lanes.join("/")} prefers this`;
    }
    if (!vital && failing.has("topdeck") && row.signals.roles.has("draw")) {
      score += 70;
      preference = "you said the deck dies on an empty hand";
    }
    if (!vital && failing.has("interaction") && row.signals.roles.has("interaction")) {
      score += 50;
      preference = "you said one answer folds the pile";
    }
    if (!vital && failing.has("mana") && row.land) {
      vital = true;
      preference = "you said mana is the failure";
    }
    if (!vital && failing.has("flood") && row.land) {
      score -= 30;
      preference = "you said the deck floods";
    }
    if (!vital && theme != null && theme <= 3 && (row.signals.roles.has("draw") || row.signals.roles.has("ramp") || row.signals.roles.has("interaction"))) {
      score += 35;
      preference = "theme slider is loose, so staples stay";
    }
    if (!vital && noteWords.size) {
      const text = `${row.card.name} ${row.card.oracleText}`.toLowerCase();
      let hits = 0;
      for (const word of noteWords) if (text.includes(word)) hits += 1;
      if (hits >= 2) {
        score += 20;
        preference = "drive notes mention this";
      }
    }
    return { ...row, score, vital, preference };
  });

  const budget = packet.job === "budget";
  tilted.sort((a, b) => {
    if (budget && !a.vital && !b.vital) {
      const usd = (b.card.usd ?? 0) - (a.card.usd ?? 0);
      if (usd !== 0 && (a.card.usd ?? 0) > 20 !== ((b.card.usd ?? 0) > 20)) return usd;
    }
    return a.score - b.score || a.card.name.localeCompare(b.card.name);
  });
  return tilted;
}
