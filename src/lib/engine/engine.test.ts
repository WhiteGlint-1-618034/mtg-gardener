import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCard } from "./parse.ts";
import { readDeck } from "./score.ts";
import { EMPTY_PACKET, type CachedCard, type Deck, type DeckEntry } from "../types.ts";

function card(partial: Partial<CachedCard> & { name: string; oracleText: string; typeLine: string }): CachedCard {
  return {
    oracleId: partial.name,
    manaCost: "",
    cmc: partial.cmc ?? 2,
    colors: [],
    colorIdentity: partial.colorIdentity ?? [],
    producedMana: partial.producedMana ?? [],
    keywords: partial.keywords ?? [],
    power: partial.power ?? null,
    toughness: partial.toughness ?? null,
    legalities: {},
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
    id: "e",
    name: commander,
    short: "ENG",
    createdAt: 0,
    rawList: "",
    entries,
    cards,
    unresolved: [],
    commanderName: commander,
    format: "commander",
    packet: { ...EMPTY_PACKET, driveNotes: "artifacts artifacts artifacts please ignore this note" },
    analysis: null,
    soil: null,
  };
}

describe("engine graph", () => {
  it("links artifact sacrifice and artifact enters to a graveyard recursion commander", () => {
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
      oracleText: "Modular 3\nFlying\nWhenever another artifact you control enters, put a +1/+1 counter on Arcbound Condor.",
      keywords: ["Modular", "Flying"],
      power: "0",
      toughness: "0",
    });
    const parsedCommander = parseCard(commander);
    const parsedRavager = parseCard(ravager);
    const parsedCondor = parseCard(condor);
    assert.equal(parsedCommander.consumes.has("graveyard.artifact"), true);
    assert.equal(parsedCommander.produces.has("artifact.enter"), true);
    assert.equal(parsedRavager.produces.has("graveyard.artifact"), true);
    assert.equal(parsedCondor.consumes.has("artifact.enter"), true);
    assert.equal(parsedCommander.produces.has("graveyard.leave"), true);

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
    const deck = deckOf(
      [
        { card: commander, zone: "commander" },
        { card: swamp, count: 36 },
        ...filler.map((c) => ({ card: c })),
        { card: ravager },
        { card: condor },
      ],
      commander.name,
    );
    const read = readDeck(deck);
    const byName = new Map(read!.rows.map((r) => [r.card.name, r]));
    assert.equal(byName.get("Arcbound Ravager")?.vital, true);
    assert.equal(byName.get("Arcbound Condor")?.vital, true);
    assert.equal((byName.get("Lost Goose 0")?.engineScore ?? 0) < 0, true);
  });

  it("treats a graveyard-leave trigger as the payoff for recursion", () => {
    const commander = card({
      name: "Scrap Savant",
      typeLine: "Legendary Creature — Human Artificer",
      oracleText: "Whenever Scrap Savant enters or attacks, return target artifact card from your graveyard to the battlefield.",
      colorIdentity: ["B", "G", "U"],
    });
    const judgment = card({
      name: "Teval's Judgment",
      typeLine: "Enchantment",
      oracleText:
        "Whenever one or more cards leave your graveyard, choose one that hasn't been chosen this turn —\n• Target creature gets +2/+2 until end of turn.\n• Create a Treasure token.",
      colorIdentity: ["B", "G", "U"],
    });
    const parsed = parseCard(judgment);
    assert.equal(parsed.consumes.has("graveyard.leave"), true);
    const read = readDeck(
      deckOf(
        [
          { card: commander, zone: "commander" },
          { card: judgment },
        ],
        commander.name,
      ),
    );
    const row = read!.rows.find((r) => r.card.name === "Teval's Judgment");
    assert.equal(row?.vital, true);
    assert.match(row?.factors.join(" ") ?? "", /graveyard\.leave/);
  });

  it("treats older zone wording as the same action", () => {
    const intoPlay = parseCard(
      card({
        name: "Old Recall",
        typeLine: "Sorcery",
        oracleText: "Put target artifact card from your graveyard into play.",
      }),
    );
    assert.equal(intoPlay.produces.has("graveyard.leave"), true);
    assert.equal(intoPlay.produces.has("artifact.enter"), true);

    const removed = parseCard(
      card({
        name: "Old Strip",
        typeLine: "Instant",
        oracleText: "Remove target artifact card in your graveyard from the game.",
      }),
    );
    assert.equal(removed.produces.has("graveyard.leave"), true);

    const comesIntoPlay = parseCard(
      card({
        name: "Old Beast",
        typeLine: "Creature — Beast",
        oracleText: "When Old Beast comes into play, draw a card.",
        power: "2",
        toughness: "2",
      }),
    );
    assert.equal(comesIntoPlay.produces.has("draw"), true);

    const animate = parseCard(
      card({
        name: "Animate Dead",
        typeLine: "Enchantment — Aura",
        oracleText:
          "Enchant creature card in a graveyard\nWhen Animate Dead enters, return enchanted creature card to the battlefield under your control.",
      }),
    );
    assert.equal(animate.produces.has("graveyard.leave"), true);
    assert.equal(animate.produces.has("creature.enter"), true);
  });

  it("donates printed power from the graveyard when the shrink only works on the battlefield", () => {
    const commander = card({
      name: "The Ooze",
      typeLine: "Legendary Creature — Ooze",
      oracleText:
        "As The Ooze enters, you may exile two creature cards from graveyards. If you do, it enters as a copy of one of those cards with a number of additional +1/+1 counters on it equal to the power of the other card.",
      colorIdentity: ["B", "G", "U"],
    });
    const shadow = card({
      name: "Death's Shadow",
      typeLine: "Creature — Avatar",
      oracleText: "Death's Shadow gets -X/-X, where X is your life total.",
      colorIdentity: ["B"],
      power: "13",
      toughness: "13",
    });
    const parsed = parseCard(shadow);
    assert.equal(parsed.produces.has("graveyard.creature"), true);
    assert.equal(parsed.implicit.has("creature.power.graveyard"), true);
    assert.equal(parsed.implicit.has("power.battlefield.only"), true);
    const read = readDeck(
      deckOf(
        [
          { card: commander, zone: "commander" },
          { card: shadow },
        ],
        commander.name,
      ),
    );
    const row = read!.rows.find((r) => r.card.name === "Death's Shadow");
    assert.equal(row?.vital, true);
    assert.match(row?.factors.join(" ") ?? "", /printed power/);
    assert.doesNotMatch(row?.factors.join(" ") ?? "", /minus your life/);
  });

  it("does not let drive notes invent an artifact plan", () => {
    const commander = card({
      name: "Plain Sage",
      typeLine: "Legendary Creature — Human Wizard",
      oracleText: "When Plain Sage enters, draw a card.",
      colorIdentity: ["U"],
    });
    const ravager = card({
      name: "Arcbound Ravager",
      typeLine: "Artifact Creature — Beast",
      oracleText: "Sacrifice an artifact: Put a +1/+1 counter on Arcbound Ravager.",
      keywords: ["Modular"],
      power: "0",
      toughness: "0",
    });
    const read = readDeck(
      deckOf(
        [
          { card: commander, zone: "commander" },
          { card: ravager },
        ],
        commander.name,
      ),
    );
    const row = read!.rows.find((r) => r.card.name === "Arcbound Ravager");
    assert.equal(row?.vital, false);
    assert.equal(row?.factors.some((f) => f.includes("commander spends")), false);
  });

  it("treats instants as fuel for a spell commander and payoffs as linked", () => {
    const commander = card({
      name: "Spell Brand",
      typeLine: "Legendary Creature — Wizard",
      oracleText: "Whenever you cast an instant or sorcery spell, Spell Brand deals 1 damage to any target.",
      colorIdentity: ["R"],
    });
    const guttersnipe = card({
      name: "Guttersnipe",
      typeLine: "Creature — Elemental Shaman",
      oracleText: "Whenever you cast an instant or sorcery spell, Guttersnipe deals 2 damage to each opponent.",
      colorIdentity: ["R"],
      power: "2",
      toughness: "2",
    });
    const bolt = card({
      name: "Lightning Bolt",
      typeLine: "Instant",
      oracleText: "Lightning Bolt deals 3 damage to any target.",
      colorIdentity: ["R"],
    });
    const bear = card({
      name: "Grizzly Bears",
      typeLine: "Creature — Bear",
      oracleText: "",
      colorIdentity: ["R"],
      power: "2",
      toughness: "2",
    });
    const parsed = parseCard(commander);
    assert.equal(parsed.consumes.has("spell.cast"), true);
    assert.equal(parsed.produces.has("damage"), true);
    const read = readDeck(
      deckOf(
        [
          { card: commander, zone: "commander" },
          { card: guttersnipe },
          { card: bolt },
          { card: bear },
        ],
        commander.name,
      ),
    );
    const byName = new Map(read!.rows.map((r) => [r.card.name, r]));
    assert.equal((byName.get("Guttersnipe")?.engineScore ?? 0) > (byName.get("Grizzly Bears")?.engineScore ?? 0), true);
    assert.equal((byName.get("Lightning Bolt")?.engineScore ?? 0) > (byName.get("Grizzly Bears")?.engineScore ?? 0), true);
  });

  it("reads prose mana and does not treat a mox as a signet", () => {
    const led = parseCard(card({
      name: "Lion's Eye Diamond",
      typeLine: "Artifact",
      oracleText: "Discard your hand, Sacrifice Lion's Eye Diamond: Add three mana of any one color. Activate only as an instant.",
      cmc: 0,
    }));
    const ring = parseCard(card({
      name: "Sol Ring",
      typeLine: "Artifact",
      oracleText: "{T}: Add {C}{C}.",
      cmc: 1,
    }));
    const signet = parseCard(card({
      name: "Arcane Signet",
      typeLine: "Artifact",
      oracleText: "{T}: Add one mana of any color in your commander's color identity.",
      cmc: 2,
    }));
    const birds = parseCard(card({
      name: "Birds of Paradise",
      typeLine: "Creature — Bird",
      oracleText: "Flying\n{T}: Add one mana of any color.",
      cmc: 1,
    }));
    assert.equal(led.produces.has("mana.fast"), true);
    assert.equal(led.roles.has("ramp"), true);
    assert.equal(ring.produces.has("mana.fast"), true);
    assert.equal(signet.produces.has("mana.fast"), false);
    assert.equal(signet.roles.has("ramp"), true);
    assert.equal(birds.produces.has("mana.fast"), false);
  });

  it("treats discarding your hand as stocking the graveyard a commander copies from", () => {
    const led = parseCard(card({
      name: "Lion's Eye Diamond",
      typeLine: "Artifact",
      oracleText: "Discard your hand, Sacrifice Lion's Eye Diamond: Add three mana of any one color. Activate only as an instant.",
      cmc: 0,
    }));
    assert.equal(led.produces.has("discard.hand"), true);
    assert.equal(led.produces.has("graveyard.card"), true);
    const forced = parseCard(card({
      name: "Mind Rot",
      typeLine: "Sorcery",
      oracleText: "Target player discards two cards.",
    }));
    assert.equal(forced.produces.has("discard.self"), false);
    assert.equal(forced.produces.has("discard.opponent"), true);

    const commander = card({
      name: "Grave Copy",
      typeLine: "Legendary Creature — Ooze",
      oracleText: "As Grave Copy enters, you may exile two creature cards from graveyards. If you do, it enters as a copy of one of those cards with a number of additional +1/+1 counters on it equal to the power of the other card.",
    });
    const idle = card({
      name: "Idle Leader",
      typeLine: "Legendary Creature — Human",
      oracleText: "Whenever Idle Leader attacks, draw a card.",
    });
    const diamond = card({
      name: "Lion's Eye Diamond",
      typeLine: "Artifact",
      oracleText: "Discard your hand, Sacrifice Lion's Eye Diamond: Add three mana of any one color. Activate only as an instant.",
      cmc: 0,
    });
    const yard = readDeck(deckOf([{ card: commander, zone: "commander" }, { card: diamond }], commander.name));
    const row = yard?.rows.find((r) => r.card.name === "Lion's Eye Diamond");
    assert.match(row?.factors.join(" ") ?? "", /cost is the setup/);
    assert.equal(row?.vital, true);
    const other = readDeck(deckOf([{ card: idle, zone: "commander" }, { card: diamond }], idle.name));
    const plain = other?.rows.find((r) => r.card.name === "Lion's Eye Diamond");
    assert.match(plain?.factors.join(" ") ?? "", /real cost/);
    assert.doesNotMatch(plain?.factors.join(" ") ?? "", /cost is the setup/);
  });
});
