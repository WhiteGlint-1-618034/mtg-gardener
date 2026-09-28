import { colorIdentityOf, lookup, mainCount } from "../categories";
import { analyzeSoil } from "../manabase";
import type { CachedCard, Deck, DeckEntry } from "../types";
import { parseCard, type Signals } from "./parse";

export type EngineRow = {
  card: CachedCard;
  entry: DeckEntry;
  engineScore: number;
  vital: boolean;
  land: boolean;
  copies: number;
  factors: string[];
  illegal: boolean;
  signals: Signals;
};

export type EngineRead = {
  rows: EngineRow[];
  weight: string;
  need: number;
  commander: Signals | null;
};

function isBasic(card: CachedCard) {
  return /\bbasic\b/i.test(card.typeLine);
}

function anyNumber(card: CachedCard) {
  return /any number of cards named/i.test(card.oracleText);
}

function isLand(card: CachedCard) {
  const t = card.typeLine.toLowerCase();
  return t.includes("land") && !t.includes("creature");
}

function offIdentity(card: CachedCard, identity: string[]) {
  if (!identity.length) return false;
  if (isBasic(card)) {
    const map: Record<string, string> = { plains: "W", island: "U", swamp: "B", mountain: "R", forest: "G" };
    const t = card.typeLine.toLowerCase();
    const col = Object.entries(map).find(([name]) => t.includes(name))?.[1];
    return !!col && !identity.includes(col);
  }
  return (card.colorIdentity ?? []).some((c) => c !== "C" && !identity.includes(c));
}

function firstLine(card: CachedCard) {
  const line = (card.oracleText.split("\n").find((l) => l.trim() && !l.trim().startsWith("(")) ?? card.oracleText)
    .replace(/\s+/g, " ")
    .trim();
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}

function tally(cards: Signals[], pick: (s: Signals) => Set<string>) {
  const map = new Map<string, number>();
  for (const signals of cards) {
    for (const event of pick(signals)) map.set(event, (map.get(event) ?? 0) + 1);
  }
  return map;
}

function topKeys(map: Map<string, number>, n: number) {
  return [...map.entries()]
    .filter(([key]) => !key.startsWith("be."))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => `${key} ×${count}`);
}

/**
 * Oracle produce/consume graph for this list. Intake preferences are not read here.
 */
export function readDeck(deck: Deck): EngineRead | null {
  const commanderFormat = deck.format !== "sixty";
  const target = commanderFormat ? 100 : 60;
  const copyCap = commanderFormat ? 1 : 4;
  const entries = deck.entries.filter((e) => e.zone !== "nursery");
  const need = mainCount(deck.entries) - target;
  const packed = entries
    .map((e) => ({ e, c: lookup(deck.cards, e.name) }))
    .filter((x): x is { e: DeckEntry; c: CachedCard } => !!x.c);
  const commanderCard = lookup(deck.cards, deck.commanderName ?? "");
  const commander = commanderCard ? parseCard(commanderCard) : null;
  const commanderKey = deck.commanderName?.toLowerCase() ?? "";
  const identity = colorIdentityOf(deck.commanderName, deck.cards, entries);
  const soil = analyzeSoil(entries.filter((e) => e.zone !== "sideboard"), deck.cards, deck.format);
  const parsed = packed
    .filter(({ c }) => c.name.toLowerCase() !== commanderKey)
    .map(({ c }) => parseCard(c));
  const produced = tally(parsed, (s) => s.produces);
  const consumed = tally(parsed, (s) => s.consumes);
  const keywordCounts = tally(parsed, (s) => s.keywords);
  const tribeCounts = tally(parsed, (s) => s.tribes);
  if (commander) {
    for (const event of commander.produces) produced.set(event, (produced.get(event) ?? 0) + 3);
    for (const event of commander.consumes) consumed.set(event, (consumed.get(event) ?? 0) + 3);
  }

  const payload = new Set<string>();
  for (const event of commander?.consumes ?? []) {
    if (event.startsWith("graveyard.")) {
      const type = event.slice("graveyard.".length);
      if (type !== "card") payload.add(type);
    }
  }
  for (const event of commander?.produces ?? []) {
    if (event.endsWith(".enter")) payload.add(event.slice(0, -".enter".length));
  }

  const weightParts = [
    ...topKeys(consumed, 3).map((s) => `wants ${s}`),
    ...topKeys(produced, 2).map((s) => `makes ${s}`),
  ];
  const weight = weightParts.join("; ") || "no repeated trigger";

  const proper = packed
    .map(({ c }) => c.name)
    .filter((n) => n.length > 6 && !/\bbasic\b/i.test(lookup(deck.cards, n)?.typeLine ?? "basic"));
  const mentioned = new Set<string>();
  for (const { c } of packed) {
    const text = c.oracleText.toLowerCase();
    for (const name of proper) {
      if (name.toLowerCase() === c.name.toLowerCase()) continue;
      if (text.includes(name.toLowerCase())) {
        mentioned.add(c.name.toLowerCase());
        mentioned.add(name.toLowerCase());
      }
    }
  }

  const roleCount = (role: string) => parsed.reduce((n, s) => n + (s.roles.has(role) ? 1 : 0), 0);
  const drawN = roleCount("draw");
  const rampN = roleCount("ramp");
  const answerN = roleCount("interaction");

  const rows: EngineRow[] = [];
  for (const { e, c } of packed) {
    if (e.zone === "commander" || c.name.toLowerCase() === commanderKey) continue;
    const signals = parseCard(c);
    const illegal = commanderFormat && offIdentity(c, identity);
    const extra = !isBasic(c) && !anyNumber(c) && e.count > copyCap ? e.count - copyCap : 0;
    if (illegal) {
      rows.push({
        card: c,
        entry: e,
        engineScore: -800,
        vital: false,
        land: isLand(c),
        copies: e.count,
        factors: ["off-identity"],
        illegal: true,
        signals,
      });
      continue;
    }
    if (extra > 0) {
      rows.push({
        card: c,
        entry: e,
        engineScore: -600,
        vital: false,
        land: false,
        copies: extra,
        factors: ["extra copy"],
        illegal: false,
        signals,
      });
    }

    let score = 0;
    let vital = false;
    const factors: string[] = [];
    const note = (points: number, text: string, keep = false) => {
      score += points;
      factors.push(text);
      if (keep) vital = true;
    };

    for (const event of signals.produces) {
      if (commander?.consumes.has(event)) note(90, `makes ${event}, which the commander spends`, true);
      else if ((consumed.get(event) ?? 0) >= 4) note(16, `makes ${event}, which the list wants`);
    }
    for (const event of signals.consumes) {
      if (commander?.produces.has(event)) note(80, `triggers off ${event}, which the commander causes`, true);
      else if (commander?.consumes.has(event)) note(42, `watches ${event}, same as the commander`);
      else if ((produced.get(event) ?? 0) >= 4) note(14, `triggers off ${event}, which the list makes`);
    }
    for (const event of signals.implicit) {
      if (commander?.consumes.has(event)) note(36, `is ${event}, which the commander asks for`);
      else if ((consumed.get(event) ?? 0) >= 4) note(12, `is ${event}, which the list asks for`);
    }
    if (signals.implicit.has("power.battlefield.only") && commander?.consumes.has("creature.power.graveyard")) {
      note(
        20,
        "113.6: that ability does not function off the battlefield (613.4c modifies, it does not define under 604.3), so the other card donates the printed power. The commander copies one card, not both",
      );
    }
    for (const type of payload) {
      if (type === "card" || type === "spell") continue;
      if (signals.types.has(type) || signals.implicit.has(`be.${type}`)) note(30, `${type} the commander can replay`);
    }
    for (const kw of signals.keywords) {
      if ((keywordCounts.get(kw) ?? 0) >= 4) note(18, `keyword ${kw} is a motif here`);
    }
    for (const tribe of signals.tribes) {
      if ((tribeCounts.get(tribe) ?? 0) >= 6) note(40, `${tribe} is a real tribe in this list`);
    }
    if (mentioned.has(c.name.toLowerCase())) note(400, "named by another card here, or names one", true);
    if (signals.roles.has("draw") && drawN <= 8) note(50, `draw is short (${drawN})`);
    if (signals.roles.has("ramp") && rampN <= 8) note(50, `ramp is short (${rampN})`);
    if (signals.roles.has("interaction") && answerN <= 8) note(40, `interaction is short (${answerN})`);
    if (signals.produces.has("mana.fast")) note(80, "fast mana, not a signet", true);
    const wantsBodies =
      !!commander?.consumes.has("graveyard.creature") || !!commander?.consumes.has("creature.power.graveyard");
    if (signals.produces.has("discard.hand") && wantsBodies) {
      note(
        95,
        "discarding your hand puts those cards in the graveyard, and this commander spends creature cards from graveyards. The cost is the setup",
        true,
      );
    } else if (signals.produces.has("discard.self") && wantsBodies) {
      note(70, "you choose to discard, so a body can reach the graveyard this commander spends", true);
    } else if (signals.produces.has("discard.hand") && !wantsBodies) {
      note(-15, "discarding your hand is a real cost. Nothing here spends the graveyard");
    }
    if (signals.roles.has("draw") && drawN <= 3) vital = true;
    if (signals.roles.has("ramp") && rampN <= 3) vital = true;

    const land = isLand(c);
    if (land && (commander?.consumes.has("land.enter") || (consumed.get("land.enter") ?? 0) >= 4)) {
      note(40, "land in a list that triggers off lands");
    } else if (land && soil.landCount > soil.targetMax) {
      score -= 45;
      factors.push(`land count ${soil.landCount} is over target ${soil.targetMax}`);
    } else if (land) {
      score += 25;
      vital = true;
      factors.push("land the manabase still needs");
    }
    if (!factors.length) score -= 45;

    const copies = extra > 0 ? Math.max(0, e.count - extra) : e.count;
    if (copies <= 0) continue;
    rows.push({
      card: c,
      entry: e,
      engineScore: score,
      vital,
      land,
      copies,
      factors,
      illegal: false,
      signals,
    });
  }

  rows.sort((a, b) => a.engineScore - b.engineScore || a.card.name.localeCompare(b.card.name));
  return { rows, weight, need, commander };
}

export function engineReason(row: EngineRow, weight: string) {
  const oracle = firstLine(row.card);
  if (row.illegal) return `Illegal. ${row.factors.join(" ")} Oracle: “${oracle}”.`;
  if (row.factors[0] === "extra copy") {
    return `Singleton. Oracle doesn't say a deck can have any number of ${row.card.name}. Cut ${row.copies}.`;
  }
  if (!row.factors.length || row.engineScore < 0) {
    return `No produce/consume link to this list. Oracle: “${oracle}”. The deck ${weight}.`;
  }
  return `Engine link is thin. Oracle: “${oracle}”. ${row.factors.join("; ")}. Deck: ${weight}.`;
}
