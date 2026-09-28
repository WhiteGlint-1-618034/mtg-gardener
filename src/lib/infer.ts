import { isMainZone, lookup, mainCount } from "./categories";
import { analyzeSoil, isCheatEngine } from "./manabase";
import type { CachedCard, CardVerdict, Deck, DeckEntry, Lane, Suggestion } from "./types";
import { deckSizeRule } from "./types";

function blob(entries: DeckEntry[], cards: Record<string, CachedCard>) {
  return entries
    .map((e) => lookup(cards, e.name))
    .filter(Boolean)
    .map((c) => `${c!.name} ${c!.typeLine} ${c!.oracleText} ${(c!.keywords ?? []).join(" ")}`)
    .join(" \n ")
    .toLowerCase();
}

export function guessLanes(
  commanderName: string | null,
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
): Lane[] {
  const text = blob(entries, cards);
  const commanderCard = commanderName ? lookup(cards, commanderName) : undefined;
  const commanderText = `${commanderName ?? ""} ${commanderCard?.oracleText ?? ""}`.toLowerCase();
  const scores: { lane: Lane; n: number }[] = [];

  let equipment = 0;
  let auras = 0;
  let creatureTokens = 0;
  for (const e of entries) {
    if (e.zone === "nursery") continue;
    const c = lookup(cards, e.name);
    if (!c) continue;
    const t = c.typeLine.toLowerCase();
    const o = c.oracleText.toLowerCase();
    if (t.includes("equipment")) equipment += e.count;
    if (t.includes("aura")) auras += e.count;
    if (/create .* creature token|create (a|two|three|x) .* token creature|create .* \d\/\d .* token/.test(o)) {
      creatureTokens += e.count;
    }
  }

  const commanderVoltron =
    /commander damage|aura spells you cast|equipped creature|whenever .* becomes equipped|for each aura|for each equipment/.test(
      commanderText,
    );
  const suitUp = equipment + auras;
  const voltronish = commanderVoltron ? suitUp + 6 : suitUp;

  const wheels = (text.match(/each player discards|discard your hand|draw seven|wheel of fortune|windfall/g) ?? []).length;
  const mill = (text.match(/\bmill\b|put the top \d+ cards of .{0,40} into (their|his or her|that player's) graveyard/g) ?? []).length;
  const combo = (text.match(/you win the game|thassa's oracle|laboratory maniac|infinite/g) ?? []).length;
  const infect = (text.match(/\binfect\b|\bpoison counter|\btoxic\b/g) ?? []).length;
  const counters = (text.match(/counter target (spell|ability)/g) ?? []).length;
  const extraDraw = (text.match(/draw two|draw three|draw x|draw cards equal/g) ?? []).length;

  if (voltronish >= 8) scores.push({ lane: "voltron", n: voltronish });
  if (wheels >= 4) scores.push({ lane: "control", n: wheels });
  if (creatureTokens >= 10) scores.push({ lane: "wide", n: creatureTokens });
  if (combo >= 2) scores.push({ lane: "combo", n: combo });
  if (infect >= 4) scores.push({ lane: "alt", n: infect });
  if (mill >= 6) scores.push({ lane: "value", n: mill });
  if (counters >= 6) scores.push({ lane: "control", n: counters });
  if (extraDraw >= 8 && !scores.some((s) => s.lane === "value")) scores.push({ lane: "value", n: extraDraw });

  scores.sort((a, b) => b.n - a.n);
  const unique: Lane[] = [];
  for (const s of scores) {
    if (!unique.includes(s.lane)) unique.push(s.lane);
  }
  if (unique.length === 0) unique.push("unknown");
  return unique.slice(0, 3);
}

function namesMatching(
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
  test: (c: CachedCard) => boolean,
): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.zone === "nursery") continue;
    const c = lookup(cards, e.name);
    if (c && test(c)) out.push(c.name);
  }
  return out;
}

/** Oracle + structure first. User packet layers on after this. */
export function structureBrief(
  commanderName: string | null,
  format: "commander" | "sixty",
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
): string {
  const main = entries.filter((e) => isMainZone(e.zone));
  const board = entries.filter((e) => e.zone === "sideboard");
  const soil = analyzeSoil(main, cards, format);
  const commander = commanderName ? lookup(cards, commanderName) : undefined;
  const cheat = namesMatching(main, cards, isCheatEngine);
  const draw = namesMatching(main, cards, roleTests.draw);
  const ramp = namesMatching(main, cards, roleTests.ramp);
  const interaction = namesMatching(main, cards, roleTests.interaction);
  const wincon = namesMatching(main, cards, roleTests.wincon);
  const lines = [
    `Commander: ${commander ? `${commander.name} — ${commander.typeLine}. ${commander.oracleText.replace(/\n/g, " ")}` : commanderName ?? "none"}`,
    `Counts: ${mainCount(entries)} cards in the main deck. Sideboard ${board.reduce((n, e) => n + e.count, 0)}${board.length ? `: ${board.map((e) => e.name).slice(0, 15).join(", ")}` : ""}. Draw ${draw.length}. Ramp ${ramp.length}. Interaction ${interaction.length}. Printed wincons ${wincon.length}.`,
    cheat.length
      ? `Cheat / copy / reanimate engines (Oracle): ${cheat.join(", ")}. Fat creatures are payloads unless they have to be hardcast.`
      : "No cheat/copy/reanimate engine spotted from Oracle. Big CMC is probably hardcast.",
    `Mana: ${soil.landCount} lands (target ${soil.targetMin}–${soil.targetMax}). Always-tapped on THIS list: ${soil.taplands.join(", ") || "none"} (budget ${soil.tapBudget}). Rocks ${soil.rocks}, dorks ${soil.dorks}. Hardcast 5+ ${soil.highCmc}. Cheated/reduced/cycled 5+ ${soil.cheatHigh}. ${soil.rationale}`,
    soil.colorHoles.length ? `Color holes: ${soil.colorHoles.join("; ")}` : "Colored sources look healthy.",
    draw.length ? `Draw from Oracle: ${draw.slice(0, 12).join(", ")}` : "Draw package looks thin from Oracle.",
    ramp.length ? `Ramp from Oracle: ${ramp.slice(0, 12).join(", ")}` : "Ramp looks thin from Oracle.",
    interaction.length ? `Interaction from Oracle: ${interaction.slice(0, 12).join(", ")}` : "Interaction looks thin from Oracle.",
    wincon.length ? `Wincon-ish from Oracle: ${wincon.slice(0, 12).join(", ")}` : "No obvious Oracle wincon. Find how it actually closes.",
  ];
  return lines.join("\n");
}

export function countRole(
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
  test: (c: CachedCard) => boolean,
) {
  let n = 0;
  for (const e of entries) {
    if (e.zone === "nursery") continue;
    const c = lookup(cards, e.name);
    if (c && test(c)) n += e.count;
  }
  return n;
}

export const roleTests = {
  draw: (c: CachedCard) =>
    /draw (a card|two|three|seven|x cards)/i.test(c.oracleText) && !c.typeLine.toLowerCase().includes("land"),
  ramp: (c: CachedCard) =>
    ((c.producedMana?.length ?? 0) > 0 && !c.typeLine.toLowerCase().includes("land")) ||
    /search your library for.*land/i.test(c.oracleText),
  interaction: (c: CachedCard) =>
    /destroy target|exile target|counter target|fight|deal .* damage to any target/i.test(c.oracleText),
  wincon: (c: CachedCard) =>
    /win the game|you win|infect|commander damage|trample/i.test(c.oracleText) ||
    (Number(c.power) >= 7 && c.keywords.some((k) => /trample|haste/i.test(k))),
};

export function slotOf(c: CachedCard): string {
  const type = c.typeLine.toLowerCase();
  const text = c.oracleText;
  const creature = type.includes("creature");
  const land = type.includes("land") && !creature;

  if (
    /(destroy|exile|return) all (creatures|permanents|nonland)/i.test(text) ||
    (/each creature/i.test(text) && /(destroy|exile|gets\s*-)/i.test(text)) ||
    /overload/i.test(text)
  ) {
    return "wipe";
  }
  if (/counter target/i.test(text)) return "counter";
  if (
    !creature &&
    /destroy target|exile target (creature|permanent|artifact|enchantment)|fight /i.test(text)
  ) {
    return "spot";
  }
  if (roleTests.draw(c)) return "draw";
  if (/search your library for/i.test(text) && !/land/i.test(text)) return "tutor";
  if (creature && (roleTests.ramp(c) || /add \{/.test(text))) return "dork";
  if (!creature && !land && (roleTests.ramp(c) || /add \{/.test(text))) return "rock";
  if (!creature && /search your library for.*land/i.test(text)) return "ramp";
  if (land) return "land";
  if (creature) return "creature";
  return "synergy";
}

export function kindOf(c: CachedCard): string {
  const t = c.typeLine.toLowerCase();
  if (t.includes("land") && !t.includes("creature")) return "land";
  if (t.includes("creature")) return "creature";
  if (t.includes("instant") || t.includes("sorcery")) return "spell";
  if (t.includes("artifact")) return "artifact";
  if (t.includes("enchantment")) return "enchantment";
  if (t.includes("planeswalker")) return "planeswalker";
  return "other";
}

const RAMP_SLOTS = new Set(["ramp", "dork", "rock"]);

export function canSwap(cut: CachedCard, add: CachedCard): boolean {
  const from = slotOf(cut);
  const to = slotOf(add);
  if (from === "wipe" && to !== "wipe") return false;
  if (from === "counter" && to !== "counter") return false;
  if (from === "spot" && to !== "spot") return false;
  if (from === "land" && to !== "land") return false;
  if (from === "creature" && to !== "creature") return false;
  if (kindOf(cut) !== kindOf(add)) {
    if (!(RAMP_SLOTS.has(from) && RAMP_SLOTS.has(to))) return false;
  }
  if (from === to) return true;
  if (RAMP_SLOTS.has(from) && RAMP_SLOTS.has(to)) return true;
  return false;
}

const TAX_CLAIMS = [
  {
    id: "discard-cost",
    reason: /discard/i,
    oracle: /discard a card\s*:|cumulative upkeep[^\n.]{0,80}discard|pay[^\n.]{0,40}discard a card/i,
  },
  {
    id: "self-mill",
    reason: /\bmill(s|ing)?\b/i,
    oracle: /\bmill\b|put the top .{0,30} of your library into/i,
  },
  {
    id: "extra-turn",
    reason: /extra turn/i,
    oracle: /take an extra turn/i,
  },
  {
    id: "skip-untap",
    reason: /doesn't untap|skip(?:s|ping)? (?:your |the )?untap/i,
    oracle: /doesn't untap during|skip your (?:next )?untap/i,
  },
];

export function taxesClaimedByTrim(trim: { reason: string }[]): string[] {
  return TAX_CLAIMS.filter((c) => trim.some((t) => c.reason.test(t.reason))).map((c) => c.id);
}

export function contradictsCuts(card: CachedCard, trim: { reason: string }[]): boolean {
  const claimed = taxesClaimedByTrim(trim);
  if (!claimed.length) return false;
  return TAX_CLAIMS.some((c) => claimed.includes(c.id) && c.oracle.test(card.oracleText));
}

export function pairReplacements(deck: Deck, items: CardVerdict[], onlyNamed = false) {
  const grow = deck.analysis?.grow ?? [];
  const used = new Set<string>();
  const map = new Map<string, Suggestion>();
  if (onlyNamed) {
    for (const t of items) {
      if (!t.replaceWith) continue;
      const g = grow.find((x) => x.name.toLowerCase() === t.replaceWith!.toLowerCase()) ?? {
        name: t.replaceWith,
        reason: "",
        role: "synergy",
      };
      map.set(t.name, g);
    }
    return map;
  }

  const fits = (cutName: string, g: Suggestion) => {
    const cut = lookup(deck.cards, cutName);
    const add = lookup(deck.cards, g.name);
    if (!cut?.oracleText || !add?.oracleText) return false;
    if (contradictsCuts(add, items)) return false;
    return canSwap(cut, add);
  };

  for (const t of items) {
    if (!t.replaceWith) continue;
    const g = grow.find((x) => x.name.toLowerCase() === t.replaceWith!.toLowerCase());
    if (g && fits(t.name, g)) {
      map.set(t.name, g);
      used.add(g.name.toLowerCase());
    }
  }
  if (onlyNamed) return map;
  for (const t of items) {
    if (map.has(t.name)) continue;
    const g = grow.find((x) => !used.has(x.name.toLowerCase()) && fits(t.name, x));
    if (g) {
      map.set(t.name, g);
      used.add(g.name.toLowerCase());
    }
  }
  return map;
}

export function trimSwaps(deck: Deck) {
  const rule = deckSizeRule(deck.packet.playFormat);
  const total = mainCount(deck.entries);
  if (rule.kind === "exact" && total > rule.count) return new Map<string, Suggestion>();
  const main = new Set(
    deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name.toLowerCase()),
  );
  const items = (deck.analysis?.trim ?? []).filter((v) => main.has(v.name.toLowerCase()));
  const onlyNamed = rule.kind === "minimum" || total === rule.count;
  return pairReplacements(deck, items, onlyNamed);
}

export const GAME_CHANGERS = new Set(
  [
    "Rhystic Study",
    "Smothering Tithe",
    "Fierce Guardianship",
    "Deadly Rollick",
    "Cyclonic Rift",
    "Demonic Tutor",
    "Vampiric Tutor",
    "Mystical Tutor",
    "Imperial Seal",
    "Mana Drain",
    "Force of Will",
    "Force of Negation",
    "The One Ring",
    "Gaea's Cradle",
    "Ancient Tomb",
    "Lion's Eye Diamond",
    "Mana Crypt",
    "Chrome Mox",
    "Mox Diamond",
    "Survival of the Fittest",
    "Natural Order",
    "Underworld Breach",
    "Thassa's Oracle",
    "Ad Nauseam",
    "Jeska's Will",
    "Bolas's Citadel",
    "Consecrated Sphinx",
    "Drannith Magistrate",
    "Opposition Agent",
    "Seedborn Muse",
  ].map((n) => n.toLowerCase()),
);
