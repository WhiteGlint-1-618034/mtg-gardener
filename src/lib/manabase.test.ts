import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeSoil } from "./manabase.ts";
import type { CachedCard, DeckEntry } from "./types.ts";

function card(partial: Partial<CachedCard> & { name: string; oracleText: string; typeLine: string }): CachedCard {
  return {
    oracleId: partial.name,
    manaCost: "",
    cmc: 0,
    colors: [],
    colorIdentity: [],
    producedMana: [],
    keywords: [],
    power: null,
    toughness: null,
    legalities: {},
    image: null,
    imageBack: null,
    releasedAt: null,
    usd: null,
    ...partial,
  };
}

function deck(list: CachedCard[]): { entries: DeckEntry[]; cards: Record<string, CachedCard> } {
  const entries = list.map((c) => ({ count: 1, name: c.name, zone: "main" as const }));
  const cards: Record<string, CachedCard> = {};
  for (const c of list) cards[c.name.toLowerCase()] = c;
  return { entries, cards };
}

describe("analyzeSoil taplands", () => {
  it("does not treat shock lands as always tapped", () => {
    const { entries, cards } = deck([
      card({
        name: "Overgrown Tomb",
        typeLine: "Land — Swamp Forest",
        oracleText: "({T}: Add {B} or {G}.)\nAs Overgrown Tomb enters, you may pay 2 life. If you don't, it enters tapped.",
        producedMana: ["B", "G"],
      }),
      card({ name: "Forest", typeLine: "Basic Land — Forest", oracleText: "({T}: Add {G}.)", producedMana: ["G"] }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.equal(soil.taplands.includes("Overgrown Tomb"), false);
  });

  it("treats guildgates as always tapped", () => {
    const { entries, cards } = deck([
      card({
        name: "Golgari Guildgate",
        typeLine: "Land — Gate",
        oracleText: "Golgari Guildgate enters tapped.\n{T}: Add {B} or {G}.",
        producedMana: ["B", "G"],
      }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.ok(soil.taplands.includes("Golgari Guildgate"));
  });

  it("treats walker-gated lands as always tapped when the list has no walkers", () => {
    const { entries, cards } = deck([
      card({
        name: "Interplanar Beacon",
        typeLine: "Land",
        oracleText: "Interplanar Beacon enters tapped unless you control two or more planeswalkers.\n{T}: Add {C}.",
        producedMana: ["C"],
      }),
      card({ name: "Llanowar Elves", typeLine: "Creature — Elf Druid", oracleText: "{T}: Add {G}.", cmc: 1 }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.ok(soil.taplands.includes("Interplanar Beacon"));
  });

  it("does not treat check lands as tapped when the types exist", () => {
    const { entries, cards } = deck([
      card({
        name: "Hinterland Harbor",
        typeLine: "Land",
        oracleText: "Hinterland Harbor enters tapped unless you control a Forest or an Island.\n{T}: Add {G} or {U}.",
        producedMana: ["G", "U"],
      }),
      card({ name: "Forest", typeLine: "Basic Land — Forest", oracleText: "({T}: Add {G}.)", producedMana: ["G"] }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.equal(soil.taplands.includes("Hinterland Harbor"), false);
  });
});

describe("analyzeSoil high cmc", () => {
  it("does not tax Ghalta as a hardcast 5+", () => {
    const { entries, cards } = deck([
      card({
        name: "Ghalta, Primal Hunger",
        typeLine: "Legendary Creature — Elder Dinosaur",
        oracleText: "This spell costs {X} less to cast, where X is the greatest power among creatures you control.\nTrample",
        cmc: 12,
        keywords: ["Trample"],
      }),
      card({ name: "Forest", typeLine: "Basic Land — Forest", oracleText: "({T}: Add {G}.)", producedMana: ["G"] }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.equal(soil.highCmc, 0);
    assert.equal(soil.cheatHigh, 1);
  });

  it("treats giant creatures as payloads when the commander cheats them in", () => {
    const { entries, cards } = deck([
      card({
        name: "Kaalia of the Vast",
        typeLine: "Legendary Creature — Human Cleric",
        oracleText:
          "Flying\nWhenever Kaalia of the Vast attacks, you may put an Angel, Demon, or Dragon creature card from your hand onto the battlefield tapped and attacking.",
        cmc: 4,
        keywords: ["Flying"],
      }),
      card({
        name: "Avacyn, Angel of Hope",
        typeLine: "Legendary Creature — Angel",
        oracleText: "Flying, vigilance\nOther permanents you control have indestructible.",
        cmc: 8,
        keywords: ["Flying", "Vigilance"],
      }),
      card({ name: "Forest", typeLine: "Basic Land — Forest", oracleText: "({T}: Add {G}.)", producedMana: ["G"] }),
    ]);
    const soil = analyzeSoil(entries, cards, "commander");
    assert.equal(soil.highCmc, 0);
    assert.ok(soil.cheatHigh >= 1);
  });
});
