import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judgeDeck } from "./judge.ts";
import { templateOf } from "./template.ts";
import { parseCard } from "../engine/parse.ts";
import { landQuality } from "../manabase.ts";
import { readDeck } from "../engine/score.ts";
import type { Catalog, SigCard } from "./types.ts";
import { EMPTY_PACKET, type CachedCard, type Deck, type DeckEntry } from "../types.ts";

function card(partial: Partial<CachedCard> & { name: string; oracleText: string; typeLine: string }): CachedCard {
  return {
    oracleId: partial.name,
    manaCost: "",
    cmc: partial.cmc ?? 2,
    colors: [],
    colorIdentity: partial.colorIdentity ?? ["B"],
    producedMana: [],
    keywords: [],
    power: partial.power ?? "1",
    toughness: partial.toughness ?? "1",
    legalities: { commander: "legal" },
    image: null,
    imageBack: null,
    releasedAt: null,
    usd: null,
    ...partial,
  };
}

function deckOf(list: { card: CachedCard; count?: number; zone?: DeckEntry["zone"] }[], commander: string): Deck {
  const entries: DeckEntry[] = list.map((x) => ({ count: x.count ?? 1, name: x.card.name, zone: x.zone ?? "main" }));
  const cards: Record<string, CachedCard> = {};
  for (const x of list) cards[x.card.name.toLowerCase()] = x.card;
  return {
    id: "j",
    name: commander,
    short: "JUD",
    createdAt: 0,
    rawList: "",
    entries,
    cards,
    unresolved: [],
    commanderName: commander,
    format: "commander",
    packet: { ...EMPTY_PACKET },
    analysis: null,
    soil: null,
  };
}

function sig(partial: Partial<SigCard> & { n: string; o: string; t: string; ci: string[]; p: string[] }): SigCard {
  return {
    id: partial.n,
    cmc: 2,
    mc: "",
    kw: [],
    pw: null,
    tu: null,
    leg: "legal",
    rel: null,
    prod: [],
    c: [],
    i: [],
    r: [],
    ty: [],
    ...partial,
  };
}

describe("judge", () => {
  it("keeps artifact fuel and payoffs, and will not grow an off-identity or off-job card", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
      colorIdentity: ["B"],
    });
    const ravager = card({
      name: "Arcbound Ravager",
      typeLine: "Artifact Creature — Beast",
      oracleText: "Modular 1\nSacrifice an artifact: Put a +1/+1 counter on Arcbound Ravager.",
      keywords: ["Modular"],
      power: "0",
      toughness: "0",
    });
    const condor = card({
      name: "Arcbound Condor",
      typeLine: "Artifact Creature — Bird",
      oracleText: "Whenever another artifact you control enters, put a +1/+1 counter on Arcbound Condor.",
      power: "0",
      toughness: "0",
    });
    const filler = Array.from({ length: 70 }, (_, i) =>
      card({
        name: `Lost Goose ${i}`,
        typeLine: `Creature — Minion${i}`,
        oracleText: "Flying",
        power: "1",
        toughness: "1",
      }),
    );
    const swamp = card({
      name: "Swamp",
      typeLine: "Basic Land — Swamp",
      oracleText: "({T}: Add {B}.)",
      producedMana: ["B"],
    });
    const deck = deckOf(
      [
        { card: commander, zone: "commander" },
        { card: ravager },
        { card: condor },
        ...filler.map((c) => ({ card: c })),
        ...Array.from({ length: 40 }, () => ({ card: swamp, count: 1 })),
      ],
      commander.name,
    );
    const catalog: Catalog = {
      cards: [
        sig({
          n: "Rogue's Passage",
          t: "Land",
          o: "{T}: Target creature can't be blocked this turn.",
          ci: [],
          p: ["evasion"],
          ty: ["land"],
        }),
        sig({
          n: "Lightning Bolt",
          t: "Instant",
          o: "Lightning Bolt deals 3 damage to any target.",
          ci: ["R"],
          p: ["removal"],
        }),
        sig({
          n: "Junk Diver",
          t: "Artifact Creature — Bird",
          o: "Flying\nWhen Junk Diver dies, return another target artifact card from your graveyard to its owner's hand.",
          ci: [],
          p: ["graveyard.artifact", "artifact.leave"],
          ty: ["artifact", "creature"],
        }),
      ],
      byName: new Map(),
      rulings: new Map(),
      lines: [],
    };
    for (const c of catalog.cards) catalog.byName.set(c.n.toLowerCase(), c);
    const judged = judgeDeck(deck, catalog);
    const cut = new Set(judged.trim.map((t) => t.name));
    assert.equal(cut.has("Arcbound Ravager"), false);
    assert.equal(cut.has("Arcbound Condor"), false);
    assert.equal(judged.grow.some((g) => g.name === "Lightning Bolt"), false);
    assert.equal(judged.grow.some((g) => g.name === "Rogue's Passage"), false);
    assert.equal(judged.grow.some((g) => g.name === "Junk Diver"), true);
  });

  it("does not cut a power donor for a graveyard copy commander", () => {
    const commander = card({
      name: "Copy Ooze",
      typeLine: "Legendary Creature — Ooze",
      oracleText:
        "As Copy Ooze enters, you may exile two creature cards from graveyards. If you do, it enters as a copy of one of those cards with a number of additional +1/+1 counters on it equal to the power of the other card.",
      colorIdentity: ["B", "G", "U"],
    });
    const shadow = card({
      name: "Death's Shadow",
      typeLine: "Creature — Avatar",
      oracleText: "Death's Shadow gets -X/-X, where X is your life total.",
      power: "13",
      toughness: "13",
      colorIdentity: ["B"],
    });
    const filler = Array.from({ length: 80 }, (_, i) =>
      card({
        name: `Lost Goose ${i}`,
        typeLine: `Creature — Minion${i}`,
        oracleText: "Flying",
        colorIdentity: ["B"],
      }),
    );
    const deck = deckOf([{ card: commander, zone: "commander" }, { card: shadow }, ...filler.map((c) => ({ card: c }))], commander.name);
    const cut = new Set(judgeDeck(deck, null).trim.map((t) => t.name));
    assert.equal(cut.has("Death's Shadow"), false);
  });

  it("keeps both cards of a complete line even when neither links on its own", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
    });
    const left = card({ name: "Blank Left", typeLine: "Creature — Minion", oracleText: "Flying" });
    const right = card({ name: "Blank Right", typeLine: "Creature — Minion", oracleText: "Flying" });
    const filler = Array.from({ length: 70 }, (_, i) =>
      card({ name: `Lost Goose ${i}`, typeLine: `Creature — Minion${i}`, oracleText: "Flying" }),
    );
    const deck = deckOf(
      [{ card: commander, zone: "commander" }, { card: left }, { card: right }, ...filler.map((c) => ({ card: c }))],
      commander.name,
    );
    const catalog: Catalog = {
      cards: [],
      byName: new Map(),
      rulings: new Map(),
      lines: [{ cards: ["Blank Left", "Blank Right"], produces: ["Infinite flying geese"] }],
    };
    const cut = new Set(judgeDeck(deck, catalog).trim.map((t) => t.name));
    assert.equal(cut.has("Blank Left"), false);
    assert.equal(cut.has("Blank Right"), false);
    assert.equal(judgeDeck(deck, catalog).lines.length, 1);
  });

  it("does not cut draw spells while draw is under the template", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
    });
    const draw = card({ name: "Night's Whisper", typeLine: "Instant", oracleText: "You draw two cards and you lose 2 life." });
    const filler = Array.from({ length: 110 }, (_, i) =>
      card({ name: `Lost Goose ${i}`, typeLine: `Creature — Minion${i}`, oracleText: "Flying" }),
    );
    const deck = deckOf([{ card: commander, zone: "commander" }, { card: draw }, ...filler.map((c) => ({ card: c }))], commander.name);
    const cut = new Set(judgeDeck(deck, null).trim.map((t) => t.name));
    assert.equal(cut.has("Night's Whisper"), false);
    assert.equal(cut.size > 0, true);
  });

  it("treats lands as the ramp in a landfall deck and does not demand a wrath from a go-wide pile", () => {
    const commander = card({
      name: "Tatyova, Benthic Druid",
      typeLine: "Legendary Creature — Merfolk Druid",
      oracleText: "Landfall — Whenever a land you control enters, you gain 1 life and draw a card.",
      keywords: ["Landfall"],
      colorIdentity: ["G", "U"],
    });
    const rocks = Array.from({ length: 4 }, (_, i) =>
      card({
        name: `Signet ${i}`,
        typeLine: "Artifact",
        oracleText: "{1}, {T}: Add {G}{U}.",
        cmc: 2,
        colorIdentity: ["G", "U"],
      }),
    );
    const filler = Array.from({ length: 40 }, (_, i) =>
      card({ name: `Bird ${i}`, typeLine: "Creature — Bird", oracleText: "Flying", colorIdentity: ["G"], power: "1", toughness: "1" }),
    );
    const deck = deckOf(
      [{ card: commander, zone: "commander" }, ...rocks.map((c) => ({ card: c })), ...filler.map((c) => ({ card: c }))],
      commander.name,
    );
    deck.packet.lanes = ["wide"];
    const read = readDeck(deck);
    assert.ok(read);
    const template = templateOf(deck, read, []);
    assert.equal(template.landsAreRamp, true);
    assert.equal(template.holes.some((h) => h.id === "ramp"), false);
    assert.equal(template.holes.some((h) => h.id === "wipe"), false);
  });

  it("asks for a win when the user said it doesn't, and will not add a staple that misses the commander's job", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
    });
    const filler = Array.from({ length: 20 }, (_, i) =>
      card({ name: `Bird ${i}`, typeLine: "Creature — Bird", oracleText: "Flying" }),
    );
    const deck = deckOf([{ card: commander, zone: "commander" }, ...filler.map((c) => ({ card: c }))], commander.name);
    deck.packet.lanes = ["none"];
    const catalog: Catalog = {
      cards: [
        sig({ n: "Night's Whisper", t: "Instant", o: "You draw two cards and you lose 2 life.", ci: ["B"], p: ["draw"], r: ["draw"] }),
        sig({
          n: "Junk Diver",
          t: "Artifact Creature — Bird",
          o: "When Junk Diver dies, return another target artifact card from your graveyard to its owner's hand.",
          ci: [],
          p: ["graveyard.artifact"],
        }),
        sig({
          n: "Workshop Assistant",
          t: "Artifact Creature — Bird",
          o: "When Workshop Assistant dies, return another target artifact card from your graveyard to its owner's hand. Draw a card.",
          ci: [],
          p: ["graveyard.artifact", "draw"],
          r: ["draw"],
        }),
      ],
      byName: new Map(),
      rulings: new Map(),
      lines: [],
    };
    for (const c of catalog.cards) catalog.byName.set(c.n.toLowerCase(), c);
    const judged = judgeDeck(deck, catalog);
    assert.match(judged.template, /doesn't win/);
    assert.equal(judged.grow.some((g) => g.name === "Night's Whisper"), false);
    assert.equal(judged.grow[0]?.name, "Workshop Assistant");
  });

  it("does not call a tax tapland an upgrade over a fast land", () => {
    const tomb = card({
      name: "Ancient Tomb",
      typeLine: "Land",
      oracleText: "{T}: Add {C}{C}. This land deals 2 damage to you.",
    });
    const tower = card({
      name: "Command Tower",
      typeLine: "Land",
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
    });
    const pool = card({
      name: "Reflecting Pool",
      typeLine: "Land",
      oracleText: "{T}: Add one mana of any type that a land you control could produce.",
    });
    const archway = card({
      name: "Archway Commons",
      typeLine: "Land",
      oracleText: "This land enters tapped.\nWhen this land enters, sacrifice it unless you pay {1}.\n{T}: Add one mana of any color.",
    });
    const parsed = parseCard(archway);
    assert.equal(parsed.produces.has("bins.self"), false);
    assert.equal(parsed.produces.has("graveyard.creature"), false);
    assert.ok(landQuality(tomb) >= landQuality(archway) + 15);
    assert.ok(landQuality(tower) >= landQuality(archway) + 15);
    assert.ok(landQuality(pool) >= landQuality(archway) + 15);

    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
    });
    const filler = Array.from({ length: 30 }, (_, i) =>
      card({ name: `Bird ${i}`, typeLine: "Creature — Bird", oracleText: "Flying" }),
    );
    const deck = deckOf(
      [
        { card: commander, zone: "commander" },
        { card: tomb },
        { card: tower },
        { card: pool },
        ...filler.map((c) => ({ card: c })),
      ],
      commander.name,
    );
    const catalog: Catalog = {
      cards: [
        sig({
          n: "Archway Commons",
          t: "Land",
          o: archway.oracleText,
          ci: [],
          p: ["graveyard.creature", "bins.self", "land.enter"],
          ty: ["land"],
        }),
      ],
      byName: new Map(),
      rulings: new Map(),
      lines: [],
    };
    catalog.byName.set("archway commons", catalog.cards[0]!);
    const judged = judgeDeck(deck, catalog);
    const cut = judged.trim.map((t) => t.name);
    assert.equal(cut.includes("Ancient Tomb"), false);
    assert.equal(cut.includes("Command Tower"), false);
    assert.equal(cut.includes("Reflecting Pool"), false);
    assert.equal(judged.trim.some((t) => t.replaceWith === "Archway Commons"), false);
    assert.equal(judged.grow.some((g) => g.name === "Archway Commons"), false);
  });

  it("does not cut fast mana or a tutor for having no keyword link, unless the bracket forbids the Game Changer", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
    });
    const led = card({
      name: "Lion's Eye Diamond",
      typeLine: "Artifact",
      oracleText: "Discard your hand, Sacrifice Lion's Eye Diamond: Add three mana of any one color. Activate only as an instant.",
      cmc: 0,
    });
    const tutor = card({
      name: "Worldly Tutor",
      typeLine: "Instant",
      oracleText: "Search your library for a creature card, reveal it, then shuffle and put that card on top.",
      cmc: 1,
      colorIdentity: ["B"],
    });
    const filler = Array.from({ length: 40 }, (_, i) =>
      card({ name: `Bird ${i}`, typeLine: "Creature — Bird", oracleText: "Flying" }),
    );
    const deck = deckOf(
      [{ card: commander, zone: "commander" }, { card: led }, { card: tutor }, ...filler.map((c) => ({ card: c }))],
      commander.name,
    );
    const open = judgeDeck(deck, null);
    assert.equal(open.trim.some((t) => t.name === "Lion's Eye Diamond"), false);
    assert.equal(open.trim.some((t) => t.name === "Worldly Tutor"), false);

    deck.packet.bracket = 1;
    const exhibition = judgeDeck(deck, null);
    const cut = exhibition.trim.find((t) => t.name === "Lion's Eye Diamond");
    assert.ok(cut);
    assert.match(cut.reason, /Game Changer/);
    assert.doesNotMatch(cut.reason, /No link/);
  });

  it("at 99 requires a same-slot replacement, and over 99 a cut stands alone", () => {
    const commander = card({
      name: "Spell Warden",
      typeLine: "Legendary Creature — Human Wizard",
      oracleText: "Whenever you cast an instant or sorcery spell, draw a card.",
      colorIdentity: ["U"],
    });
    const islands = card({
      name: "Island",
      typeLine: "Basic Land — Island",
      oracleText: "({T}: Add {U}.)",
      colorIdentity: ["U"],
    });
    const bird = card({
      name: "Lost Bird",
      typeLine: "Creature — Bird",
      oracleText: "Flying",
      colorIdentity: ["U"],
    });
    const blank = card({
      name: "Blank Page",
      typeLine: "Sorcery",
      oracleText: "Draw a card.",
      colorIdentity: ["U"],
    });
    const draw = card({
      name: "Real Draw",
      typeLine: "Instant",
      oracleText: "Draw a card.",
      colorIdentity: ["U"],
    });
    const replacement = sig({
      n: "Better Bird",
      t: "Creature — Bird",
      o: "Flying\nWhenever you cast an instant or sorcery spell, this creature gets +1/+1 until end of turn.",
      ci: ["U"],
      p: ["spell.cast"],
    });
    const catalog: Catalog = { cards: [replacement], byName: new Map([["better bird", replacement]]), rulings: new Map(), lines: [] };
    const exact = deckOf(
      [
        { card: commander, zone: "commander" },
        { card: islands, count: 36 },
        { card: bird },
        { card: blank },
        { card: draw },
        ...Array.from({ length: 60 }, (_, i) => ({
          card: card({ name: `Wall ${i}`, typeLine: "Creature — Wall", oracleText: "Defender", colorIdentity: ["U"] }),
        })),
      ],
      commander.name,
    );
    const judged = judgeDeck(exact, catalog);
    const birdCut = judged.trim.find((t) => t.name === "Lost Bird");
    assert.equal(birdCut?.replaceWith, "Better Bird");
    assert.equal(judged.trim.some((t) => t.name === "Blank Page"), false);
    assert.equal(judged.trim.filter((t) => !t.reason.startsWith("Legality.")).every((t) => t.replaceWith), true);

    exact.entries.push({ name: "Wall Extra", count: 1, zone: "main" });
    exact.cards["wall extra"] = card({ name: "Wall Extra", typeLine: "Creature — Wall", oracleText: "Defender", colorIdentity: ["U"] });
    const over = judgeDeck(exact, catalog);
    assert.ok(over.trim.length > 0);
    assert.equal(over.trim.every((t) => !t.replaceWith), true);
  });

  it("does not bare-cut a 60-card format just for being over 60", () => {
    const bird = card({ name: "Lost Bird", typeLine: "Creature — Bird", oracleText: "Flying", colorIdentity: ["U"] });
    const islands = card({ name: "Island", typeLine: "Basic Land — Island", oracleText: "({T}: Add {U}.)", colorIdentity: ["U"] });
    const deck = deckOf(
      [
        { card: islands, count: 24 },
        { card: bird },
        ...Array.from({ length: 40 }, (_, i) => ({
          card: card({ name: `Wall ${i}`, typeLine: "Creature — Wall", oracleText: "Defender", colorIdentity: ["U"] }),
        })),
      ],
      "",
    );
    deck.format = "sixty";
    deck.commanderName = null;
    deck.packet.playFormat = "modern";
    const judged = judgeDeck(deck, null);
    assert.equal(judged.trim.filter((t) => !t.reason.startsWith("Legality.")).length, 0);
  });
});
