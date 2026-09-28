import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mainCount } from "../categories.ts";
import { judgeDeck } from "../catalog/judge.ts";
import { readDeck } from "../engine/score.ts";
import { scaffoldOf } from "./scaffold.ts";
import { parseDeckList } from "../parse-deck.ts";
import { EMPTY_PACKET, type CachedCard, type Deck } from "../types.ts";

function card(partial: Partial<CachedCard> & { name: string; oracleText: string; typeLine: string }): CachedCard {
  return {
    oracleId: partial.name,
    manaCost: "",
    cmc: 2,
    colors: [],
    colorIdentity: ["G"],
    producedMana: [],
    keywords: [],
    power: "1",
    toughness: "1",
    legalities: { commander: "legal" },
    image: null,
    imageBack: null,
    releasedAt: null,
    usd: null,
    ...partial,
  };
}

describe("layers", () => {
  it("keeps a sideboard out of the nursery and out of the main count", () => {
    const entries = parseDeckList(`1x Llanowar Elves
Sideboard
1x Nature's Claim
Maybeboard
1x Birds of Paradise`);
    assert.equal(entries.find((e) => e.name === "Nature's Claim")?.zone, "sideboard");
    assert.equal(entries.find((e) => e.name === "Birds of Paradise")?.zone, "nursery");
    assert.equal(mainCount(entries), 1);
  });

  it("builds the scaffold from the main deck and the sideboard, not the maybeboard", () => {
    const commander = card({
      name: "Goreclaw",
      typeLine: "Legendary Creature — Bear",
      oracleText: "Whenever a creature you control with power 4 or greater enters, it gains haste and trample.",
      colorIdentity: ["G"],
    });
    const elf = card({ name: "Llanowar Elves", typeLine: "Creature — Elf", oracleText: "{T}: Add {G}." });
    const claim = card({ name: "Nature's Claim", typeLine: "Instant", oracleText: "Destroy target artifact or enchantment." });
    const bird = card({ name: "Birds of Paradise", typeLine: "Creature — Bird", oracleText: "{T}: Add one mana of any color." });
    const cards: Record<string, CachedCard> = {
      goreclaw: commander,
      "llanowar elves": elf,
      "nature's claim": claim,
      "birds of paradise": bird,
    };
    const deck: Deck = {
      id: "l",
      name: "Goreclaw",
      short: "GORE",
      createdAt: 0,
      rawList: "",
      commanderName: "Goreclaw",
      format: "commander",
      packet: { ...EMPTY_PACKET },
      analysis: null,
      soil: null,
      unresolved: [],
      cards,
      entries: [
        { name: "Goreclaw", count: 1, zone: "commander" },
        { name: "Llanowar Elves", count: 1, zone: "main" },
        { name: "Nature's Claim", count: 1, zone: "sideboard" },
        { name: "Birds of Paradise", count: 1, zone: "nursery" },
      ],
    };
    const read = readDeck(deck);
    assert.ok(read);
    assert.equal(read.rows.some((r) => r.card.name === "Nature's Claim"), true);
    assert.equal(read.rows.some((r) => r.card.name === "Birds of Paradise"), false);
    const scaffold = scaffoldOf(read, []);
    assert.match(scaffold.text, /Nature's Claim/);
    assert.doesNotMatch(scaffold.text, /Birds of Paradise/);
    const judged = judgeDeck(deck, null);
    assert.match(judged.scaffold, /Intent from those reads/);
    assert.equal(judged.trim.some((t) => t.name === "Birds of Paradise"), false);
  });

  it("labels an identity break as legality and does not spend a main-deck cut on the sideboard", () => {
    const commander = card({
      name: "Goreclaw",
      typeLine: "Legendary Creature — Bear",
      oracleText: "Whenever Goreclaw attacks, draw a card.",
      colorIdentity: ["G"],
    });
    const red = card({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      colorIdentity: ["R"],
    });
    const board = card({ name: "Nature's Claim", typeLine: "Instant", oracleText: "Destroy target artifact or enchantment." });
    const filler = Array.from({ length: 100 }, (_, i) =>
      card({ name: `Bear ${i}`, typeLine: "Creature — Bear", oracleText: "Flying" }),
    );
    const cards: Record<string, CachedCard> = { goreclaw: commander, "lightning bolt": red, "nature's claim": board };
    for (const c of filler) cards[c.name.toLowerCase()] = c;
    const deck: Deck = {
      id: "l2",
      name: "Goreclaw",
      short: "GORE",
      createdAt: 0,
      rawList: "",
      commanderName: "Goreclaw",
      format: "commander",
      packet: { ...EMPTY_PACKET },
      analysis: null,
      soil: null,
      unresolved: [],
      cards,
      entries: [
        { name: "Goreclaw", count: 1, zone: "commander" },
        { name: "Lightning Bolt", count: 1, zone: "main" },
        ...filler.map((c) => ({ name: c.name, count: 1, zone: "main" as const })),
        { name: "Nature's Claim", count: 1, zone: "sideboard" as const },
      ],
    };
    const judged = judgeDeck(deck, null);
    const bolt = judged.trim.find((t) => t.name === "Lightning Bolt");
    assert.ok(bolt);
    assert.match(bolt.reason, /^Legality\./);
    assert.equal(judged.trim.some((t) => t.name === "Nature's Claim"), false);
  });

  it("does not trim a utility land for a tapland reason it does not have", () => {
    const commander = card({
      name: "Marrow-Gnawer",
      typeLine: "Legendary Creature — Rat",
      oracleText: "Whenever Marrow-Gnawer attacks, draw a card.",
      colorIdentity: ["B"],
    });
    const shizo = card({
      name: "Shizo, Death's Storehouse",
      typeLine: "Legendary Land",
      oracleText: "{T}: Add {B}.\n{B}, {T}: Target legendary creature gains fear until end of turn.",
      colorIdentity: ["B"],
    });
    const swamp = card({
      name: "Swamp",
      typeLine: "Basic Land — Swamp",
      oracleText: "{T}: Add {B}.",
      colorIdentity: ["B"],
    });
    const filler = Array.from({ length: 58 }, (_, i) =>
      card({
        name: `Rat ${i}`,
        typeLine: "Creature — Rat",
        oracleText: "Flying",
        colorIdentity: ["B"],
      }),
    );
    const cards: Record<string, CachedCard> = {
      "marrow-gnawer": commander,
      "shizo, death's storehouse": shizo,
      swamp: swamp,
    };
    for (const c of filler) cards[c.name.toLowerCase()] = c;
    const deck: Deck = {
      id: "shizo",
      name: "Marrow-Gnawer",
      short: "MARR",
      createdAt: 0,
      rawList: "",
      commanderName: "Marrow-Gnawer",
      format: "commander",
      packet: { ...EMPTY_PACKET },
      analysis: null,
      soil: null,
      unresolved: [],
      cards,
      entries: [
        { name: "Marrow-Gnawer", count: 1, zone: "commander" },
        { name: "Shizo, Death's Storehouse", count: 1, zone: "main" },
        { name: "Swamp", count: 40, zone: "main" },
        ...filler.map((c) => ({ name: c.name, count: 1, zone: "main" as const })),
      ],
    };
    const judged = judgeDeck(deck, null);
    const line = judged.scaffold.split("\n").find((row) => row.includes("Shizo, Death's Storehouse"));
    assert.ok(line);
    assert.match(line, /gains fear/);
    assert.match(line, /does not enter tapped/);
    assert.match(line, /no keep-it tax/);
    assert.doesNotMatch(line, /pay just to keep/);
    assert.equal(judged.trim.some((t) => t.name === "Shizo, Death's Storehouse"), false);
  });
});
