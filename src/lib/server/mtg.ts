import { createServerFn } from "@tanstack/react-start";
import { GAME_CHANGERS } from "../infer";
import { rulesExcerpt } from "../rules/corpus";
import {
  EMPTY_PACKET,
  bracketOf,
  budgetCapOf,
  complexityHint,
  complexityOf,
  complexityTick,
  themeIntensityHint,
  themeIntensityOf,
  themeTick,
  formatLabel,
  type Analysis,
  type CachedCard,
  type Deck,
  type Lane,
  type SeedPacket,
  type WatchItem,
  type Zone,
} from "../types";
import { sleep } from "../utils";

const UA = "TheGardener/1.0 (MTG deck tender)";
const SCRY = "https://api.scryfall.com";
const EDH = "https://json.edhrec.com/pages";

type ScryCard = {
  id?: string;
  oracle_id?: string;
  name: string;
  type_line?: string;
  oracle_text?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  produced_mana?: string[];
  keywords?: string[];
  power?: string | null;
  toughness?: string | null;
  legalities?: Record<string, string>;
  released_at?: string;
  prices?: { usd?: string | null };
  image_uris?: { normal?: string; small?: string };
  card_faces?: { oracle_id?: string; oracle_text?: string; mana_cost?: string; power?: string; toughness?: string; image_uris?: { normal?: string; small?: string } }[];
};

async function scryfall(path: string, init?: RequestInit) {
  const res = await fetch(`${SCRY}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": UA,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

function fromScry(card: ScryCard): CachedCard {
  const faces = card.card_faces ?? [];
  const face0 = faces[0];
  const oracle =
    card.oracle_text ??
    faces.map((f) => f.oracle_text ?? "").filter(Boolean).join("\n//\n");
  const usd = card.prices?.usd ? Number(card.prices.usd) : null;
  return {
    oracleId: String(card.oracle_id ?? face0?.oracle_id ?? card.id ?? ""),
    name: card.name,
    typeLine: card.type_line ?? "",
    oracleText: oracle,
    manaCost: card.mana_cost ?? face0?.mana_cost ?? "",
    cmc: card.cmc ?? 0,
    colors: card.colors ?? [],
    colorIdentity: card.color_identity ?? [],
    producedMana: card.produced_mana ?? [],
    keywords: card.keywords ?? [],
    power: card.power ?? face0?.power ?? null,
    toughness: card.toughness ?? face0?.toughness ?? null,
    legalities: card.legalities ?? {},
    image: card.image_uris?.normal ?? face0?.image_uris?.normal ?? null,
    imageSmall: card.image_uris?.small ?? face0?.image_uris?.small ?? null,
    imageBack: faces[1]?.image_uris?.normal ?? null,
    releasedAt: card.released_at ?? null,
    usd: Number.isFinite(usd) ? usd : null,
  };
}

function slug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const resolveCardNames = createServerFn({ method: "POST" })
  .validator((data: { names: string[] }) => data)
  .handler(async ({ data }) => {
    const unique = [...new Set((data.names ?? []).map((n) => n.trim()).filter(Boolean))];
    const cards: Record<string, CachedCard> = {};
    const unresolved: string[] = [];
    for (let i = 0; i < unique.length; i += 75) {
      const chunk = unique.slice(i, i + 75);
      const res = await scryfall("/cards/collection", {
        method: "POST",
        body: JSON.stringify({ identifiers: chunk.map((name) => ({ name })) }),
      });
      if (!res.ok) {
        unresolved.push(...chunk);
      } else {
        const json = (await res.json()) as { data?: ScryCard[]; not_found?: { name?: string }[] };
        for (const card of json.data ?? []) {
          const cached = fromScry(card);
          cards[cached.name.toLowerCase()] = cached;
        }
        const found = new Set((json.data ?? []).map((c) => c.name.toLowerCase()));
        for (const name of chunk) if (!found.has(name.toLowerCase())) unresolved.push(name);
        for (const miss of json.not_found ?? []) if (miss.name) unresolved.push(miss.name);
      }
      if (i + 75 < unique.length) await sleep(80);
    }
    return { cards, unresolved: [...new Set(unresolved)] };
  },
);

type EdhCard = { name?: string; synergy?: number };
type EdhList = { header?: string; cardviews?: EdhCard[] };

export const fetchCommanderMeta = createServerFn({ method: "POST" })
  .validator((data: { commander: string }) => data)
  .handler(async ({ data }) => {
    const empty = { ok: false as const, high: [] as EdhCard[], top: [] as EdhCard[], fresh: [] as EdhCard[] };
    if (!data.commander) return empty;
    const res = await fetch(`${EDH}/commanders/${slug(data.commander)}.json`, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { json_dict?: { cardlists?: EdhList[] }; container?: { json_dict?: { cardlists?: EdhList[] } } };
    const lists = json.json_dict?.cardlists ?? json.container?.json_dict?.cardlists ?? [];
    const take = (header: string) =>
      (lists.find((l) => (l.header ?? "").toLowerCase() === header)?.cardviews ?? [])
        .filter((c): c is { name: string; synergy?: number } => !!c.name)
        .slice(0, 24);
    return { ok: true as const, high: take("high synergy cards"), top: take("top cards"), fresh: take("new cards") };
  },
);

const LANDS: { name: string; bucket: "fast" | "utility" | "rainbow"; header: string }[] = [
  ["Arid Mesa", "fast", "Fetch"],
  ["Bloodstained Mire", "fast", "Fetch"],
  ["Flooded Strand", "fast", "Fetch"],
  ["Marsh Flats", "fast", "Fetch"],
  ["Misty Rainforest", "fast", "Fetch"],
  ["Polluted Delta", "fast", "Fetch"],
  ["Scalding Tarn", "fast", "Fetch"],
  ["Verdant Catacombs", "fast", "Fetch"],
  ["Windswept Heath", "fast", "Fetch"],
  ["Wooded Foothills", "fast", "Fetch"],
  ["Prismatic Vista", "fast", "Fetch"],
  ["Fabled Passage", "fast", "Fetch"],
  ["Terramorphic Expanse", "fast", "Fetch"],
  ["Evolving Wilds", "fast", "Fetch"],
  ["Command Tower", "fast", "Rainbow"],
  ["City of Brass", "rainbow", "Pain rainbow"],
  ["Mana Confluence", "rainbow", "Pain rainbow"],
  ["Exotic Orchard", "rainbow", "Rainbow"],
  ["Reflecting Pool", "rainbow", "Rainbow"],
  ["Plaza of Heroes", "fast", "Rainbow"],
  ["Path of Ancestry", "rainbow", "Rainbow"],
  ["Secluded Courtyard", "fast", "Rainbow"],
  ["Unclaimed Territory", "fast", "Rainbow"],
  ["Ancient Tomb", "fast", "Sol land"],
  ["Gemstone Caverns", "fast", "Fast"],
  ["Boseiju, Who Endures", "utility", "Utility"],
  ["Otawara, Soaring City", "utility", "Utility"],
  ["Strip Mine", "utility", "Utility"],
  ["Wasteland", "utility", "Utility"],
  ["Cavern of Souls", "utility", "Utility"],
  ["Urborg, Tomb of Yawgmoth", "utility", "Utility"],
  ["Yavimaya, Cradle of Growth", "utility", "Utility"],
  ["Reliquary Tower", "utility", "Utility"],
  ["Bojuka Bog", "utility", "Utility"],
  ["Field of the Dead", "utility", "Utility"],
].map(([name, bucket, header]) => ({ name, bucket: bucket as "fast" | "utility" | "rainbow", header }));

const SHOCKS = [
  "Blood Crypt",
  "Breeding Pool",
  "Godless Shrine",
  "Hallowed Fountain",
  "Overgrown Tomb",
  "Sacred Foundry",
  "Steam Vents",
  "Stomping Ground",
  "Temple Garden",
  "Watery Grave",
];
const BONDS = [
  "Bountiful Promenade",
  "Luxury Suite",
  "Morphic Pool",
  "Sea of Clouds",
  "Spire Garden",
  "Spectator Seating",
  "Rejuvenating Springs",
  "Training Center",
  "Undergrowth Stadium",
  "Vault of Champions",
];
const TRIOMES = [
  "Indatha Triome",
  "Jetmir's Garden",
  "Raffine's Tower",
  "Spara's Headquarters",
  "Xander's Lounge",
  "Ziatora's Proving Ground",
  "Zagoth Triome",
  "Savai Triome",
  "Ketria Triome",
];

for (const name of [...SHOCKS, ...BONDS]) LANDS.push({ name, bucket: "fast", header: "Typed dual" });
for (const name of TRIOMES) LANDS.push({ name, bucket: "fast", header: "Typed triome" });

export const fetchLandPlants = createServerFn({ method: "POST" })
  .validator((data: { identity: string[]; exclude: string[] }) => data)
  .handler(async ({ data }) => {
    const skip = new Set((data.exclude ?? []).map((n) => n.toLowerCase()));
    const items = LANDS.filter((l) => !skip.has(l.name.toLowerCase()));
    return { items };
  },
);

type TendName = {
  name: string;
  count?: number;
  typeLine: string;
  oracleText: string;
  cmc: number;
  manaCost: string;
  zone?: string;
  usd: number | null;
  keywords: string[];
  colorIdentity?: string[];
  producedMana?: string[];
  power?: string | null;
  toughness?: string | null;
  legalities?: Record<string, string>;
  oracleId?: string;
};

type TendCandidate = TendName & { kind?: string; synergy?: number };

function deckFrom(data: { commander: string | null; format: string; packet: SeedPacket; names: TendName[] }): Deck {
  const cards: Record<string, CachedCard> = {};
  const entries = (data.names ?? []).map((n) => {
    cards[n.name.toLowerCase()] = {
      oracleId: n.oracleId || n.name,
      name: n.name,
      typeLine: n.typeLine,
      oracleText: n.oracleText,
      manaCost: n.manaCost,
      cmc: n.cmc,
      colors: n.colorIdentity ?? [],
      colorIdentity: n.colorIdentity ?? [],
      producedMana: n.producedMana ?? [],
      keywords: n.keywords ?? [],
      power: n.power ?? null,
      toughness: n.toughness ?? null,
      legalities: n.legalities ?? {},
      image: null,
      imageBack: null,
      releasedAt: null,
      usd: n.usd,
    };
    const zone: Zone = n.zone === "commander" || n.zone === "nursery" || n.zone === "sideboard" ? n.zone : "main";
    return { count: n.count ?? 1, name: n.name, zone };
  });
  return {
    id: "tend",
    name: data.commander ?? "deck",
    short: "TEND",
    createdAt: 0,
    rawList: "",
    entries,
    cards,
    unresolved: [],
    commanderName: data.commander,
    format: data.format === "sixty" ? "sixty" : "commander",
    packet: data.packet ?? EMPTY_PACKET,
    analysis: null,
    soil: null,
  };
}

function lineOf(c: { name: string; typeLine?: string; oracleText?: string; manaCost?: string; cmc?: number; usd?: number | null; keywords?: string[] }, mark = "") {
  const usd = c.usd != null ? ` $${c.usd}` : "";
  const kw = c.keywords?.length ? ` [${c.keywords.join(", ")}]` : "";
  return `${mark}${c.name} | ${c.typeLine ?? ""} | ${c.manaCost ?? ""} CMC ${c.cmc ?? "?"}${usd}${kw} | ${(c.oracleText || "(no oracle — do not suggest this)").replace(/\n/g, " ")}`;
}

export const tendDeck = createServerFn({ method: "POST" })
  .validator(
    (data: {
      commander: string | null;
      format: string;
      packet: SeedPacket;
      names: TendName[];
      inDeck: string[];
      candidates: TendCandidate[];
      scan: string;
      soil: {
        landCount: number;
        targetMin: number;
        targetMax: number;
        taplands: string[];
        tapBudget: number;
        basicNeed: string;
        colorHoles: string[];
        rationale: string;
        highCmc: number;
        cheatHigh: number;
      } | null;
      deckSize: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const packet = data.packet ?? EMPTY_PACKET;
    const inDeck = new Set((data.inDeck ?? []).map((n) => n.toLowerCase()));
    const watch: WatchItem[] = (data.candidates ?? [])
      .filter((c) => c.kind === "new" && !inDeck.has(c.name.toLowerCase()))
      .slice(0, 10)
      .map((c) => ({
        id: `new-${c.name}`,
        kind: "new" as const,
        name: c.name,
        note: "Showing up in new EDHREC lists for this commander",
      }));
    for (const name of data.names ?? []) {
      if (GAME_CHANGERS.has(name.name)) {
        watch.push({ id: `gc-${name.name}`, kind: "gamechanger", name: name.name, note: "Game Changer." });
      }
    }

    const apiKey = process.env.XAI_API_KEY;
    const base: Analysis = {
      diagnosis: "",
      laneGuess: [],
      trim: [],
      grow: [],
      watch,
      lines: [],
      template: "",
      scaffold: "",
      questions: [],
      generatedAt: Date.now(),
      usedAi: false,
    };
    try {
      const { loadCatalog } = await import("../catalog/load");
      const { judgeDeck } = await import("../catalog/judge");
      const judgment = judgeDeck(deckFrom(data), await loadCatalog());
      base.trim = judgment.trim;
      base.grow = judgment.grow;
      base.lines = judgment.lines;
      base.template = judgment.template;
      base.scaffold = judgment.scaffold;
      const seen = new Set(watch.map((w) => w.name.toLowerCase()));
      for (const item of judgment.watch) {
        if (!seen.has(item.name.toLowerCase())) base.watch.push(item);
      }
    } catch {
      base.diagnosis = "The card catalog did not load. Cuts fell back to nothing rather than a guess.";
    }
    if (!apiKey) {
      if (!base.diagnosis) {
        base.diagnosis = `The graph marked ${base.trim.length} cuts and ${base.lines?.length ?? 0} complete lines. No model key, so this is the graph without the roast.`;
      }
      return base;
    }

    const compact = (data.names ?? []).map((c) => lineOf(c, c.zone === "nursery" ? "[MAYBE] " : c.zone === "sideboard" ? "[SB] " : "")).join("\n");
    const readableCands = (data.candidates ?? []).filter((c) => (c.oracleText ?? "").trim().length > 0);
    const candidateBlock = readableCands
      .slice(0, 48)
      .map((c) => lineOf(c, `[${c.kind ?? "card"}${c.synergy != null ? ` syn=${c.synergy.toFixed(2)}` : ""}] `))
      .join("\n");
    const goal = bracketOf(packet.bracket);
    const bracketOn = packet.bracket != null;
    const themeN = themeIntensityOf(packet.themeIntensity);
    const themeOn = packet.themeIntensity != null;
    const brainN = complexityOf(packet.complexity);
    const brainOn = packet.complexity != null;
    const cap = budgetCapOf(packet);
    const rules = rulesExcerpt(`${compact}\n${data.commander ?? ""}`);

    const prompt = `You are The Gardener. Deck reviews disguised as roasts. Snarky, specific, useful. Hurtful allegory about the CARDS, never the human.
No slurs. No punching down on identity.

Oracle text is the card. The Comprehensive Rules below are the game. If your memory disagrees with a numbered rule in that block, the rule wins. Do not invent a ruling.
A "gets +N/+N" or "gets -N/-N" ability modifies power (613.4c) and functions only on the battlefield (113.6). It is not a characteristic-defining ability (604.3a). Off the battlefield the printed power is the power (208.3).
An ability that says power "is equal to" something defines power and functions in every zone (604.3, 113.6a).
A copy effect copies one object (707.2). Counters equal to another card's power do not copy that card's text.

RULES:
${rules}

You may ONLY mention cards that appear in DECK or CANDIDATES. Never invent a card. If nothing fits, say so.
Do not suggest a card whose Oracle you have not read. CANDIDATES without Oracle are not legal adds.

=== LAYER 0 — READ THE LIST FIRST ===
Ignore user sliders until you can say, from Oracle, how this pile actually functions.
Use the STRUCTURE SCAN as a map, then verify it against DECK Oracle. If scan and Oracle disagree, Oracle wins.
Do not treat printed CMC as the real cost if the card reduces itself, has affinity/convoke/delve/morph, or the list cheats it in.
Do not treat a land as always-tapped if the player has a real option this list can pay (2 life, check types, fast-land curve). If the unless-clause needs planeswalkers and there are none, it IS always tapped.
A swap must do the same job in Oracle: wipe for wipe, counter for counter, dork for dork, land for land. Never a wipe for a creature.
Judge a card by the job it does in THIS list, not by how the text looks in a vacuum. A creature that dies as it enters can be stocking a graveyard the commander exiles from. Say so. Do not call that off-plan.

STRUCTURE SCAN (computed from Oracle):
${data.scan || "(none)"}

DECK (full Oracle):
${compact}

CANDIDATES (full Oracle — the only names you may add):
${candidateBlock || "(none with readable Oracle)"}

=== LAYER 1 — USER PACKET, AFTER THE READ ===
Apply this on top of the Oracle read. If a slider is OFF, do not invent a constraint.
Drive notes outrank your guessed lane. They do not outrank Oracle or the Comprehensive Rules.

The Review is one continuous write-up (up to two long paragraphs, no forced split). Insults woven into the recs.
Do not nitpick every off card. Only name a problem if it actually hurts the plan.

Job: ${packet.job ?? "diagnose"}
${
  data.format === "commander" && data.deckSize != null && data.deckSize !== 100
    ? `DECK SIZE FIRST: ${data.deckSize} cards in commander + main. Legal is exactly 100. ${
        data.deckSize > 100
          ? `Name ${data.deckSize - 100} cards to REMOVE. replaceWith is forbidden. A swap is not a cut.`
          : `Short ${100 - data.deckSize}. Do not trim unless a card is illegal.`
      }`
    : ""
}
Lane: ${(packet.lanes?.length ? packet.lanes : packet.lane ? [packet.lane] : []).join(", ") || "unknown — guess from Oracle, not from the name"}
Voltron is NOT the default.
Goal bracket: ${bracketOn ? `${goal.n} ${goal.name} — ${goal.hint}` : "OFF"}
Theme tightness: ${themeOn ? `${themeN}/10 ${themeTick(themeN).label} — ${themeIntensityHint(themeN)}` : "OFF"}
Complexity: ${brainOn ? `${brainN}/10 ${complexityTick(brainN).label} — ${complexityHint(brainN)}` : "OFF"}
${cap != null ? `BUDGET JOB: hard cap $${cap} USD.` : ""}
Drive notes: ${packet.driveNotes || "(none)"}
Commander's job: ${(packet.commanderJobs?.length ? packet.commanderJobs : packet.commanderJob ? [packet.commanderJob] : []).join(", ") || "unspecified"}
Engines: ${packet.engines || "(none)"}
Payoffs: ${packet.payoffs || "(none)"}
Glue: ${packet.glue || "(none)"}
Failed at the table: ${(packet.failings ?? []).join(", ") || "none"}${packet.failedNote ? ` — ${packet.failedNote}` : ""}
Pet cards: ${packet.petCards || "(none)"}
Pilot feedback: ${packet.feedback || "(none)"}
Locked: ${(packet.lockedNames ?? []).join(", ") || "none"}
Commander: ${data.commander ?? "none"}
Format: ${formatLabel(packet.playFormat)} (${data.format === "sixty" ? "60-card rules" : "Commander rules"})

MANA:
${
  data.soil
    ? `${data.soil.landCount} lands (target ${data.soil.targetMin}–${data.soil.targetMax}). Always-tapped ${(data.soil.taplands ?? []).length}/${data.soil.tapBudget}: ${(data.soil.taplands ?? []).join(", ") || "none"}. Hardcast 5+ ${data.soil.highCmc ?? "?"}. Cheated/reduced ${data.soil.cheatHigh ?? "?"}. ${data.soil.basicNeed ?? ""} ${(data.soil.colorHoles ?? []).join("; ") || "no color holes."} ${data.soil.rationale ?? ""}`
    : "(none)"
}

GRAPH (already decided — the roast may mock these, and may not invent different cuts or adds):
Scaffold (immutable, before intake):
${base.scaffold || "(none)"}
Structure: ${base.template || "(in range)"}
Cuts: ${base.trim.map((t) => `${t.name}${t.replaceWith ? ` → ${t.replaceWith}` : ""} — ${t.reason}`).join(" | ") || "(none)"}
Adds: ${base.grow.map((g) => g.name).join(", ") || "(none)"}
Lines: ${(base.lines ?? []).map((l) => `${l.cards.join(" + ")} → ${l.produces.join(", ")}`).join(" | ") || "(none)"}
Template: ${base.template || "(in range)"}

Return ONLY JSON:
{
  "diagnosis": "One continuous roast-review, up to two long paragraphs. Do not name a cut or an add that is not in GRAPH.",
  "laneGuess": ["voltron"|"wide"|"combo"|"control"|"alt"|"toolbox"|"value"],
  "questions": ["at most 2"]
}`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "grok-3",
          temperature: 0.4,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        base.diagnosis = "The review call failed. The rules graph is still local.";
        return base;
      }
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = body.choices?.[0]?.message?.content ?? "";
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as {
        diagnosis?: string;
        laneGuess?: Lane[];
        questions?: string[];
      };
      return {
        ...base,
        diagnosis: parsed.diagnosis ?? base.diagnosis,
        laneGuess: parsed.laneGuess ?? [],
        questions: (parsed.questions ?? []).slice(0, 2),
        generatedAt: Date.now(),
        usedAi: true,
      };
    } catch {
      base.diagnosis = "The review came back unreadable. The rules graph is still local.";
      return base;
    }
  },
);
