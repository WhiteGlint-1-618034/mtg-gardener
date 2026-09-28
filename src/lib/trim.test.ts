import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sizeCuts } from "./trim.ts";
import { EMPTY_PACKET, type CachedCard, type Deck, type DeckEntry } from "./types.ts";

function card(partial: Partial<CachedCard> & { name: string; oracleText: string; typeLine: string }): CachedCard {
  return {
    oracleId: partial.name,
    manaCost: "",
    cmc: 2,
    colors: [],
    colorIdentity: [],
    producedMana: [],
    keywords: [],
    power: "2",
    toughness: "2",
    legalities: {},
    image: null,
    imageBack: null,
    releasedAt: null,
    usd: null,
    ...partial,
  };
}

function pile(list: { card: CachedCard; count?: number; zone?: DeckEntry["zone"] }[], commander: string): Deck {
  const entries: DeckEntry[] = list.map((x) => ({
    count: x.count ?? 1,
    name: x.card.name,
    zone: x.zone ?? "main",
  }));
  const cards: Record<string, CachedCard> = {};
  for (const x of list) cards[x.card.name.toLowerCase()] = x.card;
  return {
    id: "t",
    name: commander,
    short: "TEST",
    createdAt: 0,
    rawList: "",
    entries,
    cards,
    unresolved: [],
    commanderName: commander,
    format: "commander",
    packet: EMPTY_PACKET,
    analysis: null,
    soil: null,
  };
}

describe("sizeCuts", () => {
  it("lists enough real cuts to reach 100 and does not count a swap", () => {
    const commander = card({
      name: "Goreclaw, Terror of Qal Sisma",
      typeLine: "Legendary Creature — Bear Warrior",
      oracleText: "Whenever a creature with power 4 or greater you control attacks, it gains trample.",
      colorIdentity: ["G"],
    });
    const filler = Array.from({ length: 80 }, (_, i) =>
      card({
        name: `Lonely Bird ${i}`,
        typeLine: `Creature — Minion${i}`,
        oracleText: "Flying",
        colorIdentity: ["G"],
        power: "2",
        toughness: "2",
      }),
    );
    const forests = card({
      name: "Forest",
      typeLine: "Basic Land — Forest",
      oracleText: "({T}: Add {G}.)",
      colorIdentity: ["G"],
      producedMana: ["G"],
    });
    const red = card({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      colorIdentity: ["R"],
    });
    const comboA = card({
      name: "Squirrel Nest",
      typeLine: "Enchantment — Aura",
      oracleText: "Enchant land\n{G}, {T}: Create a 1/1 green Squirrel token.",
      colorIdentity: ["G"],
    });
    const comboB = card({
      name: "Earthcraft",
      typeLine: "Enchantment",
      oracleText: "Tap an untapped creature you control: Untap target basic land. This pairs with Squirrel Nest.",
      colorIdentity: ["G"],
    });
    const bear = card({
      name: "Bearer of the Claw",
      typeLine: "Creature — Bear",
      oracleText: "Trample",
      colorIdentity: ["G"],
      power: "6",
      toughness: "6",
      cmc: 6,
    });
    const deck = pile(
      [
        { card: commander, zone: "commander" },
        { card: forests, count: 40 },
        ...filler.map((c) => ({ card: c })),
        { card: red },
        { card: comboA },
        { card: comboB },
        { card: bear },
      ],
      commander.name,
    );
    const cuts = sizeCuts(deck);
    const copies = cuts.reduce((n, c) => n + (c.copies ?? 1), 0);
    const total = deck.entries.reduce((n, e) => n + e.count, 0);
    assert.equal(copies, total - 100);
    assert.equal(cuts.some((c) => c.name === "Lightning Bolt"), true);
    assert.equal(cuts.some((c) => c.name === "Bearer of the Claw"), false);
    assert.equal(cuts.every((c) => !c.replaceWith), true);
    assert.equal(
      cuts.some((c) => c.name === "Squirrel Nest" || c.name === "Earthcraft"),
      false,
    );
  });

  it("keeps artifact sacrifice and artifact-enters payoffs in a recursion list", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
      colorIdentity: ["B"],
    });
    const filler = Array.from({ length: 70 }, (_, i) =>
      card({
        name: `Lost Goose ${i}`,
        typeLine: `Creature — Minion${i}`,
        oracleText: "Flying",
        colorIdentity: ["B"],
        power: "1",
        toughness: "1",
      }),
    );
    const swamp = card({
      name: "Swamp",
      typeLine: "Basic Land — Swamp",
      oracleText: "({T}: Add {B}.)",
      colorIdentity: ["B"],
      producedMana: ["B"],
    });
    const ravager = card({
      name: "Arcbound Ravager",
      typeLine: "Artifact Creature — Beast",
      oracleText: "Modular 1\nSacrifice an artifact: Put a +1/+1 counter on Arcbound Ravager.",
      keywords: ["Modular"],
      colorIdentity: [],
      power: "0",
      toughness: "0",
    });
    const condor = card({
      name: "Arcbound Condor",
      typeLine: "Artifact Creature — Bird",
      oracleText: "Modular 3\nFlying\nWhenever another artifact you control enters, put a +1/+1 counter on Arcbound Condor.",
      keywords: ["Modular", "Flying"],
      colorIdentity: [],
      power: "0",
      toughness: "0",
    });
    const deck = pile(
      [
        { card: commander, zone: "commander" },
        { card: swamp, count: 36 },
        ...filler.map((c) => ({ card: c })),
        { card: ravager },
        { card: condor },
      ],
      commander.name,
    );
    const cuts = sizeCuts(deck);
    assert.equal(cuts.some((c) => c.name === "Arcbound Ravager"), false);
    assert.equal(cuts.some((c) => c.name === "Arcbound Condor"), false);
    assert.equal(cuts.some((c) => c.name.startsWith("Lost Goose")), true);
  });
});
