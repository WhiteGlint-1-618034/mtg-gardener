import { GAME_CHANGERS, canSwap } from "../infer";
import { analyzeSoil, landQuality } from "../manabase";
import { isMainZone, mainCount } from "../categories";
import type { CardVerdict, CachedCard, Deck, DeckLine, Suggestion, WatchItem } from "../types";
import { deckSizeRule } from "../types";
import type { Signals } from "../engine/parse";
import { readDeck, type EngineRead, type EngineRow } from "../engine/score";
import { tiltRead } from "../engine/preferences";
import type { Catalog, Line, SigCard } from "./types";
import { isWinCard, templateOf } from "./template";
import { cuttableFromScaffold, fitNote, scaffoldOf } from "../layers/scaffold";
import { groundClaim, readOracle } from "../layers/oracle";

const LINKED = new Set(["fuel", "payoff", "donor", "body"]);

export type Judgment = {
  trim: CardVerdict[];
  grow: Suggestion[];
  watch: WatchItem[];
  lines: DeckLine[];
  protectedNames: string[];
  template: string;
  scaffold: string;
};

function asCached(card: SigCard): CachedCard {
  return {
    oracleId: card.id,
    name: card.n,
    typeLine: card.t,
    oracleText: card.o,
    manaCost: card.mc,
    cmc: card.cmc,
    colors: card.ci,
    colorIdentity: card.ci,
    producedMana: card.prod,
    keywords: card.kw,
    power: card.pw,
    toughness: card.tu,
    legalities: { commander: card.leg },
    image: null,
    imageBack: null,
    releasedAt: card.rel,
    usd: null,
  };
}

function inIdentity(card: SigCard, identity: string[]) {
  if (!identity.length) return true;
  return card.ci.every((c) => c === "C" || identity.includes(c));
}

export function jobsOf(signals: Pick<Signals, "produces" | "consumes" | "implicit" | "roles">, commander: Signals | null): string[] {
  const jobs: string[] = [];
  if (commander) {
    for (const event of signals.produces) {
      if (commander.consumes.has(event)) {
        jobs.push("fuel");
        break;
      }
    }
    for (const event of signals.consumes) {
      if (commander.produces.has(event)) {
        jobs.push("payoff");
        break;
      }
    }
    if (signals.implicit.has("creature.power.graveyard") && commander.consumes.has("creature.power.graveyard")) jobs.push("donor");
    const wantsStock = [...commander.consumes].some((e) => e.startsWith("graveyard.") || e === "creature.power.graveyard");
    const stocks =
      signals.produces.has("graveyard.creature") ||
      signals.produces.has("bins.self") ||
      signals.produces.has("graveyard.artifact") ||
      signals.produces.has("discard.hand") ||
      (signals.produces.has("discard.self") && wantsStock);
    if (stocks && wantsStock) jobs.push("body");
  }
  if (signals.roles.has("draw")) jobs.push("draw");
  if (signals.roles.has("ramp")) jobs.push("ramp");
  if (signals.roles.has("interaction")) jobs.push("interaction");
  return jobs;
}

function demandOf(read: EngineRead): string[] {
  const made = new Map<string, number>();
  for (const row of read.rows) {
    for (const event of row.signals.produces) made.set(event, (made.get(event) ?? 0) + 1);
  }
  const want = [...(read.commander?.consumes ?? [])].filter((event) => (made.get(event) ?? 0) < 8);
  return want.length ? want : [...(read.commander?.consumes ?? [])];
}

function hits(line: Line, names: Set<string>, commander: string | null) {
  if (line.commander && line.commander.toLowerCase() !== (commander ?? "").toLowerCase()) return false;
  return line.cards.every((c) => names.has(c.toLowerCase()));
}

function rulingFor(card: CachedCard, catalog: Catalog | null): string | null {
  if (!catalog) return null;
  const notes = catalog.rulings.get(card.oracleId) ?? catalog.rulings.get(card.name.toLowerCase()) ?? [];
  const hit = notes.find((n) => /battlefield|graveyard|exile|power|cop(y|ies)|zone/i.test(n));
  return hit ?? null;
}

function scarce(rows: EngineRow[], role: string) {
  return rows.filter((r) => r.signals.roles.has(role)).length <= 8;
}

function soleSuppliers(read: EngineRead) {
  const counts = new Map<string, string[]>();
  for (const row of read.rows) {
    if (row.illegal || row.factors[0] === "extra copy") continue;
    for (const event of row.signals.produces) {
      if (!read.commander?.consumes.has(event)) continue;
      const list = counts.get(event) ?? [];
      if (!list.includes(row.card.name)) list.push(row.card.name);
      counts.set(event, list);
    }
  }
  const sole = new Set<string>();
  for (const names of counts.values()) if (names.length === 1) sole.add(names[0]!.toLowerCase());
  return sole;
}

function isLegality(row: EngineRow, deck: Deck) {
  if (row.illegal || row.factors[0] === "extra copy") return true;
  if (row.card.legalities?.commander === "banned" && deck.format !== "sixty") return true;
  const key = deck.packet.playFormat;
  const status = key ? row.card.legalities?.[key] : undefined;
  return status === "banned" || status === "not_legal";
}

/**
 * The graph decides. A card stays if it fuels the commander, pays off what the commander causes,
 * donates power, stocks a zone the commander uses, holds a scarce structural job, or completes a
 * known line. Everything else is a cut candidate, worst link first. A swap has to be the same
 * kind of card and has to produce something this list actually spends.
 */
export function judgeDeck(deck: Deck, catalog: Catalog | null): Judgment {
  const empty: Judgment = { trim: [], grow: [], watch: [], lines: [], protectedNames: [], template: "", scaffold: "" };
  const read = readDeck(deck);
  if (!read) return empty;

  const names = new Set(deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name.toLowerCase()));
  const commanderCard = deck.cards[(deck.commanderName ?? "").toLowerCase()];
  const identity = commanderCard?.colorIdentity ?? [];
  const remembered = (deck.analysis?.lines ?? []).map((line) => ({ cards: line.cards, produces: line.produces }));
  const lines = [
    ...(catalog?.lines ?? []).filter((line) => hits(line, names, deck.commanderName)),
    ...remembered.filter((line) => hits(line, names, deck.commanderName)),
  ];
  const onLine = new Set(lines.flatMap((line) => line.cards.map((c) => c.toLowerCase())));
  const deckLines = lines.slice(0, 12).map((line) => ({ cards: line.cards, produces: line.produces }));
  const scaffold = scaffoldOf(read, deckLines, commanderCard);
  const readByName = new Map(scaffold.cards.map((card) => [card.name.toLowerCase(), card]));

  const rows = tiltRead(read, deck);
  const demand = demandOf(read);
  const template = templateOf(deck, read, lines);
  const bracket = deck.packet.bracket;
  const changerCap = bracket === 1 ? 0 : bracket === 2 ? 3 : Number.POSITIVE_INFINITY;
  const allowedChangers = new Set(
    rows
      .filter((r) => GAME_CHANGERS.has(r.card.name.toLowerCase()))
      .sort((a, b) => {
        const fast = Number(b.signals.produces.has("mana.fast")) - Number(a.signals.produces.has("mana.fast"));
        return fast || b.engineScore - a.engineScore || a.card.name.localeCompare(b.card.name);
      })
      .slice(0, changerCap)
      .map((r) => r.card.name.toLowerCase()),
  );

  const size = deckSizeRule(deck.packet.playFormat);
  const mainTotal = mainCount(deck.entries);
  const overExact = size.kind === "exact" && mainTotal > size.count;
  const atExact = size.kind === "exact" && mainTotal === size.count;
  const floorOnly = size.kind === "minimum";
  const ranked = [...rows].sort((a, b) => (a.score ?? a.engineScore) - (b.score ?? b.engineScore) || a.card.name.localeCompare(b.card.name));
  const legalWeeds = ranked.filter((row) => isLegality(row, deck));
  const suggestWeeds = ranked.filter((row) => {
    if (isLegality(row, deck) || row.entry.zone === "sideboard" || row.land) return false;
    const forbidden = GAME_CHANGERS.has(row.card.name.toLowerCase()) && !allowedChangers.has(row.card.name.toLowerCase());
    if (forbidden) return true;
    return cuttableFromScaffold(readByName.get(row.card.name.toLowerCase())?.edges ?? []);
  });
  const picked: { row: EngineRow; copies: number; legality: boolean }[] = [];
  let left = overExact ? mainTotal - size.count : 0;
  for (const row of legalWeeds) {
    const copies = row.copies;
    picked.push({ row, copies, legality: true });
    if (row.entry.zone !== "sideboard" && overExact) left = Math.max(0, left - copies);
  }
  if (overExact) {
    for (const row of suggestWeeds) {
      if (left <= 0) break;
      const copies = Math.min(row.copies, left);
      if (copies <= 0) continue;
      picked.push({ row, copies, legality: false });
      left -= copies;
    }
  } else {
    const forbiddenFirst = [...suggestWeeds].sort((a, b) => {
      const ban = (row: EngineRow) =>
        GAME_CHANGERS.has(row.card.name.toLowerCase()) && !allowedChangers.has(row.card.name.toLowerCase()) ? 0 : 1;
      return ban(a) - ban(b);
    });
    for (const row of forbiddenFirst) {
      const bannedChanger = GAME_CHANGERS.has(row.card.name.toLowerCase()) && !allowedChangers.has(row.card.name.toLowerCase());
      if (!bannedChanger && !cuttableFromScaffold(readByName.get(row.card.name.toLowerCase())?.edges ?? [])) continue;
      picked.push({ row, copies: row.copies, legality: false });
      if (picked.filter((p) => !p.legality).length >= 8) break;
    }
  }
  if (deck.format === "sixty") {
    const board = rows.filter((r) => r.entry.zone === "sideboard" && r.factors[0] !== "extra copy");
    let over = board.reduce((n, r) => n + r.entry.count, 0) - 15;
    if (over > 0) {
      const rankedBoard = [...board].sort((a, b) => (a.score ?? a.engineScore) - (b.score ?? b.engineScore));
      for (const row of rankedBoard) {
        if (over <= 0) break;
        if (row.land) continue;
        if (!cuttableFromScaffold(readByName.get(row.card.name.toLowerCase())?.edges ?? [])) continue;
        if (picked.some((p) => p.row.card.name === row.card.name)) continue;
        const copies = Math.min(row.copies, over);
        picked.push({ row, copies, legality: false });
        over -= copies;
      }
    }
  }

  const growPool = growFrom(catalog, names, identity, demand, deck.commanderName, template);
  const overNinetyNine = overExact;
  const usedSwaps = new Set<string>();
  const trim: CardVerdict[] = picked.flatMap(({ row, copies, legality }) => {
    const jobs = jobsOf(row.signals, read.commander);
    const ruling = rulingFor(row.card, catalog);
    const changer = GAME_CHANGERS.has(row.card.name.toLowerCase());
    const readCard = readByName.get(row.card.name.toLowerCase());
    const edges = (readCard?.edges ?? []).filter((edge) => edge.kind !== "none");
    let reason = legality
      ? row.illegal
        ? `Legality. ${row.card.name} is off this commander's identity.`
        : row.factors[0] === "extra copy"
          ? `Legality. ${deck.format === "sixty" ? "Copy limit" : "Singleton"}. Extra copies of ${row.card.name} are not a different card.`
          : `Legality. ${row.card.name} is not legal in this format.`
      : changer
        ? bracket === 1
          ? `${row.card.name} is a Game Changer. Exhibition doesn't allow them. That is the reason, not a missing keyword.`
          : `${row.card.name} is a Game Changer, and bracket 2 keeps three. Fast mana stays ahead of this.`
        : row.entry.zone === "sideboard"
          ? `${row.card.name} is past the sideboard cap. Lowest fit on the board, not a main-deck cut.`
          : edges.length
            ? edges.map((edge) => edge.note).join(" ")
            : `${row.card.name} shares no Oracle produce or cost with the other cards here.`;
    if (!legality && !changer && jobs.length && edges.length === 0) {
      reason = `${row.card.name} is only a ${jobs.join("/")} here, and that job is already covered.`;
    }
    if (ruling) reason = `${reason} Ruling: ${ruling}`;
    let replaceWith: string | undefined;
    if ((atExact || floorOnly) && !legality && row.entry.zone !== "sideboard") {
      const swap = growPool.find((g) => {
        if (usedSwaps.has(g.name.toLowerCase())) return false;
        const add = catalog?.byName.get(g.name.toLowerCase());
        if (!add) return false;
        return canSwap(row.card, asCached(add));
      });
      if (!swap) return [];
      usedSwaps.add(swap.name.toLowerCase());
      replaceWith = swap.name;
      reason = `${reason} Same slot: ${swap.name}.`;
    }
    if (overNinetyNine) replaceWith = undefined;
    reason = groundClaim(reason, readCard?.facts ?? readOracle(row.card));
    return [{ name: row.card.name, kind: "weed" as const, reason, copies, replaceWith }];
  });

  const fresh = growPool.filter((g) => {
    const card = catalog?.byName.get(g.name.toLowerCase());
    if (!card?.rel) return false;
    return Date.now() - Date.parse(card.rel) < 1000 * 60 * 60 * 24 * 180;
  });

  const shifted = rows
    .map((row) => fitNote(row, row.engineScore))
    .filter((n): n is string => !!n)
    .slice(0, 8);
  const boardCount = deck.entries.filter((e) => e.zone === "sideboard").reduce((n, e) => n + e.count, 0);
  const boardNote =
    deck.format === "sixty" && boardCount === 0 ? "\nStructure: this format has a sideboard. The one you pasted is empty." : "";

  return {
    trim,
    grow: growPool.slice(0, 12),
    watch: fresh.slice(0, 8).map((g) => ({
      id: `new-${g.name}`,
      kind: "new" as const,
      name: g.name,
      note: g.reason,
    })),
    lines: deckLines,
    protectedNames: [...onLine],
    template: `${template.text}${boardNote}`,
    scaffold: shifted.length ? `${scaffold.text}\nUser layer moved fit, not link: ${shifted.join("; ")}` : scaffold.text,
  };
}

function growFrom(
  catalog: Catalog | null,
  names: Set<string>,
  identity: string[],
  demand: string[],
  commander: string | null,
  template: { holes: { id: string }[]; landsAreRamp: boolean },
): Suggestion[] {
  if (!catalog) return [];
  const want = new Set(demand);
  const open = new Set(template.holes.map((h) => h.id));
  const scored: { card: SigCard; score: number; why: string }[] = [];
  for (const card of catalog.cards) {
    if (card.leg !== "legal") continue;
    if (names.has(card.n.toLowerCase())) continue;
    if (commander && card.n.toLowerCase() === commander.toLowerCase()) continue;
    if (!inIdentity(card, identity)) continue;
    if (card.t.toLowerCase().includes("land") && !card.t.toLowerCase().includes("creature") && landQuality(asCached(card)) < 20) continue;
    const hit = card.p.filter((event) => want.has(event));
    const fillsWipe = open.has("wipe") && card.p.includes("wipe");
    const fillsWin = open.has("win") && isWinCard(card.o, card.kw);
    if (!hit.length && !fillsWipe && !fillsWin) continue;
    let score = hit.length * 10;
    let why = hit.length ? `Produces ${hit.slice(0, 3).join(", ")}, which this commander spends.` : "";
    if (open.has("draw") && card.r.includes("draw") && hit.length) {
      score += 30;
      why += " It also draws, and draw is short.";
    }
    if (open.has("ramp") && card.r.includes("ramp") && hit.length && !template.landsAreRamp) {
      score += 25;
      why += " It also ramps.";
    }
    if (open.has("interaction") && card.r.includes("interaction") && hit.length) {
      score += 25;
      why += " It also answers.";
    }
    if (fillsWipe) {
      score += 40;
      why = why ? `${why} Board reset, which this pile doesn't have.` : "Board reset. This pile doesn't have one.";
    }
    if (fillsWin) {
      score += 50;
      why = why ? `${why} And it can end the game.` : "A way to actually win.";
    }
    scored.push({ card, score, why });
  }
  scored.sort((a, b) => b.score - a.score || a.card.cmc - b.card.cmc || a.card.n.localeCompare(b.card.n));
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const row of scored) {
    const key = row.card.n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: row.card.n, reason: row.why, role: "synergy" });
    if (out.length >= 24) break;
  }
  return out;
}
