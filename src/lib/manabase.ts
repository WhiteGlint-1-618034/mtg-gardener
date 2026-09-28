import { colorIdentityOf, isMainZone, lookup } from "./categories";
import type { CachedCard, DeckEntry, LandPlant, SeedPacket, SoilReport } from "./types";

const BASIC_NAME: Record<"W" | "U" | "B" | "R" | "G", string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

const COLS = ["W", "U", "B", "R", "G"] as const;

const BASIC_COLOR: Record<string, "W" | "U" | "B" | "R" | "G"> = {
  plains: "W",
  island: "U",
  swamp: "B",
  mountain: "R",
  forest: "G",
  "snow-covered plains": "W",
  "snow-covered island": "U",
  "snow-covered swamp": "B",
  "snow-covered mountain": "R",
  "snow-covered forest": "G",
  wastes: "W",
};

function isLand(card: CachedCard) {
  return card.typeLine.toLowerCase().includes("land");
}

function isBasic(card: CachedCard) {
  return card.typeLine.toLowerCase().includes("basic");
}

function kws(card: CachedCard) {
  return (card.keywords ?? []).map((k) => k.toLowerCase());
}

function isCreature(card: CachedCard) {
  return card.typeLine.toLowerCase().includes("creature");
}

const LAND_TYPES = ["plains", "island", "swamp", "mountain", "forest", "gate"] as const;

type SoilCtx = {
  format: "commander" | "sixty";
  basics: number;
  creatures: number;
  planeswalkers: number;
  artifacts: number;
  enchantments: number;
  gates: number;
  landTypes: Set<string>;
  landTypeCounts: Record<string, number>;
  yavimaya: boolean;
  urborg: boolean;
  cheats: boolean;
};

function landTypesOf(card: CachedCard): string[] {
  const tl = card.typeLine.toLowerCase();
  return LAND_TYPES.filter((t) => tl.includes(t));
}

function buildCtx(
  entries: DeckEntry[],
  of: (name: string) => CachedCard | undefined,
  format: "commander" | "sixty",
): SoilCtx {
  const landTypes = new Set<string>();
  const landTypeCounts: Record<string, number> = {
    plains: 0,
    island: 0,
    swamp: 0,
    mountain: 0,
    forest: 0,
    gate: 0,
  };
  let basics = 0;
  let creatures = 0;
  let planeswalkers = 0;
  let artifacts = 0;
  let enchantments = 0;
  let gates = 0;
  let yavimaya = false;
  let urborg = false;
  const engines: string[] = [];

  for (const e of entries) {
    const c = of(e.name);
    if (!c) continue;
    const tl = c.typeLine.toLowerCase();
    const n = e.name.toLowerCase();
    if (n === "yavimaya, cradle of growth") yavimaya = true;
    if (n === "urborg, tomb of yawgmoth") urborg = true;
    if (isLand(c)) {
      if (isBasic(c)) basics += e.count;
      for (const t of landTypesOf(c)) {
        landTypes.add(t);
        landTypeCounts[t] = (landTypeCounts[t] ?? 0) + e.count;
      }
    }
    if (tl.includes("creature")) creatures += e.count;
    if (tl.includes("planeswalker")) planeswalkers += e.count;
    if (tl.includes("artifact")) artifacts += e.count;
    if (tl.includes("enchantment")) enchantments += e.count;
    if (tl.includes("gate")) gates += e.count;
    if (isCheatEngine(c)) engines.push(c.name);
  }
  if (yavimaya) landTypes.add("forest");
  if (urborg) landTypes.add("swamp");

  return {
    format,
    basics,
    creatures,
    planeswalkers,
    artifacts,
    enchantments,
    gates,
    landTypes,
    landTypeCounts,
    yavimaya,
    urborg,
    cheats: engines.length >= 1,
  };
}

function typesInPhrase(phrase: string): string[] {
  const s = phrase.toLowerCase();
  return LAND_TYPES.filter((t) => s.includes(t));
}

function conditionMet(clause: string, ctx: SoilCtx): boolean {
  const s = clause.toLowerCase();

  if (/two or more opponents/.test(s)) return ctx.format === "commander";
  if (/two or fewer other lands/.test(s) || /three or fewer other lands/.test(s)) return true;
  if (/two or more other lands/.test(s) || /three or more other lands/.test(s)) return true;
  if (/two or more basic/.test(s)) return ctx.basics >= 2;
  if (/three or more basic/.test(s)) return ctx.basics >= 3;

  const twoPlus = /two or more/.test(s);
  const threePlus = /three or more/.test(s);
  const need = threePlus ? 3 : twoPlus ? 2 : 1;

  if (/planeswalker/.test(s)) return ctx.planeswalkers >= need;
  if (/gate/.test(s)) return ctx.gates >= need + (twoPlus ? 1 : 0);
  if (/\bartifact/.test(s)) return ctx.artifacts >= need;
  if (/enchantment/.test(s)) return ctx.enchantments >= need;
  if (/\bcreature/.test(s)) return ctx.creatures >= need;

  const types = typesInPhrase(s);
  if (types.length) {
    if (need >= 2) {
      const sum = types.reduce((n, t) => n + (ctx.landTypeCounts[t] ?? 0), 0);
      return types.some((t) => (ctx.landTypeCounts[t] ?? 0) >= need) || sum >= need;
    }
    return types.some((t) => ctx.landTypes.has(t));
  }

  if (/life|damage|attack|lost life|spell|mana/.test(s)) return true;
  return false;
}

/** True only if this land will tap on ETB given THIS list. Shock / fast / check are not always-tapped. */
function alwaysEntersTapped(card: CachedCard, ctx: SoilCtx): boolean {
  const raw = card.oracleText;
  const t = raw.toLowerCase();
  if (!/enters(?: the battlefield)? tapped/.test(t) && !/enters(?: the battlefield)? untapped/.test(t)) {
    return false;
  }

  if (/you may pay (?:\d+ life|\{[^}]+\})/i.test(raw) && /if you don'?t/i.test(t)) return false;
  if (/you may have .* enter tapped/i.test(raw)) return false;

  if (/you may tap an untapped creature/i.test(raw)) return ctx.creatures < 1;

  const reveal = raw.match(/you may reveal ([^.]+?) from your hand/i);
  if (reveal) {
    const types = typesInPhrase(reveal[1] ?? "");
    if (/\bland\b/i.test(reveal[1] ?? "")) return false;
    if (/\bcreature\b/i.test(reveal[1] ?? "")) return ctx.creatures < 1;
    if (!types.length) return false;
    return !types.some((x) => ctx.landTypes.has(x));
  }

  const unless = raw.match(/enters(?: the battlefield)? tapped unless ([^.]+)/i);
  if (unless) return !conditionMet(unless[1] ?? "", ctx);

  const untappedIf = raw.match(/enters(?: the battlefield)? untapped if ([^.]+)/i);
  if (untappedIf) return !conditionMet(untappedIf[1] ?? "", ctx);

  const otherwise = raw.match(/if ([^.]+), .* enters(?: the battlefield)? untapped/i);
  if (otherwise) return !conditionMet(otherwise[1] ?? "", ctx);

  return /enters(?: the battlefield)? tapped/.test(t);
}

export function isCheatEngine(card: CachedCard): boolean {
  const raw = card.oracleText;
  const t = raw.toLowerCase();
  const kw = kws(card);
  if (kw.some((k) => k === "cascade" || k === "discover")) return true;
  if (/without paying (?:its|their) mana cost/i.test(raw)) return true;
  if (/enters(?: the battlefield)? as a copy/i.test(raw)) return true;
  if (/as .+ enters(?: the battlefield)?, you may have it become a copy/i.test(raw)) return true;
  if (/copy target creature/i.test(raw)) return true;
  if (/put (?:a |that |target |up to [^.]{0,40})?creature/i.test(raw) && /onto the battlefield/i.test(raw)) {
    return true;
  }
  if (/onto the battlefield/.test(t) && /from (?:your )?(?:graveyard|hand|exile|library)/.test(t)) return true;
  if (/from (?:your )?graveyard/.test(t) && /onto the battlefield/.test(t) && /creature/.test(t)) return true;
  if (/search your library for.{0,60}creature/.test(t) && /put.{0,40}into (?:your )?graveyard/.test(t)) return true;
  return false;
}

function selfReduces(card: CachedCard): boolean {
  const raw = card.oracleText;
  const t = raw.toLowerCase();
  const kw = kws(card);
  if (
    kw.some((k) =>
      [
        "affinity",
        "convoke",
        "delve",
        "improvise",
        "emerge",
        "prototype",
        "dash",
        "unearth",
        "madness",
        "miracle",
        "offering",
        "morph",
        "disguise",
        "cascade",
        "discover",
      ].includes(k),
    )
  ) {
    return true;
  }
  if (/this spell costs/.test(t) && /less to cast/.test(t)) return true;
  if (/costs \{[^}]+\} less/.test(t)) return true;
  if (/affinity for/.test(t)) return true;
  if (/prototype \{/.test(t)) return true;
  if (/you may (?:cast|pay).{0,50}rather than pay/i.test(raw)) return true;
  if (/cast this spell for \{0\}/.test(t)) return true;
  if (/\bmorph\b|\bdisguise\b|\bmanifest\b/.test(t)) return true;
  return false;
}

function isCheatPayload(card: CachedCard, ctx: SoilCtx): boolean {
  if (isLand(card) || card.cmc < 5) return false;
  if (selfReduces(card)) return true;
  if (!ctx.cheats) return false;
  if (isCreature(card)) return true;
  const kw = kws(card);
  if (kw.includes("cycling")) return true;
  return false;
}

export function landEntersTappedOnList(
  card: CachedCard,
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
  format: "commander" | "sixty",
): boolean {
  const main = entries.filter((e) => isMainZone(e.zone));
  const of = (name: string) => lookup(cards, name);
  return alwaysEntersTapped(card, buildCtx(main, of, format));
}

const BASIC_TYPE: Record<string, string> = {
  W: "plains",
  U: "island",
  B: "swamp",
  R: "mountain",
  G: "forest",
};

export function landLegalInIdentity(card: CachedCard, identity: string[]): boolean {
  const ident = new Set(identity);
  for (const c of card.colorIdentity ?? []) {
    if (c !== "C" && !ident.has(c)) return false;
  }
  return true;
}

export function fetchHitsIdentity(card: CachedCard, identity: string[]): boolean {
  const types = fetchSearchTypes(card);
  if (!types.length) return true;
  const wanted = identity.map((c) => BASIC_TYPE[c]).filter(Boolean);
  if (!wanted.length) return false;
  return types.some((x) => wanted.includes(x));
}

const BASIC_TYPE_NAMES = ["plains", "island", "swamp", "mountain", "forest"] as const;

export function fetchSearchTypes(card: CachedCard): string[] {
  const t = card.oracleText.toLowerCase();
  if (!/search your library/.test(t)) return [];
  return BASIC_TYPE_NAMES.filter((x) => t.includes(x));
}

export function isTrueFetch(card: CachedCard): boolean {
  const t = card.oracleText.toLowerCase();
  return /sacrifice/.test(t) && /search your library/.test(t) && fetchSearchTypes(card).length > 0;
}

export function fetchOnIdentity(card: CachedCard, identity: string[]): boolean {
  const types = fetchSearchTypes(card);
  if (!types.length) return false;
  const wanted = new Set(identity.map((c) => BASIC_TYPE[c]).filter(Boolean));
  return types.every((x) => wanted.has(x));
}

export function basicLandTypes(card: CachedCard): string[] {
  const t = card.typeLine.toLowerCase();
  return BASIC_TYPE_NAMES.filter((x) => new RegExp(`\\b${x}\\b`).test(t));
}

export type DeckSoilPlan = {
  mill: number;
  landfall: number;
  voltron: number;
  grave: number;
  tokens: number;
  hand: number;
  beatdown: number;
};

export function readDeckPlan(
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
  packet?: SeedPacket | null,
): DeckSoilPlan {
  const text = entries
    .filter((e) => e.zone !== "nursery")
    .map((e) => lookup(cards, e.name))
    .filter(Boolean)
    .map((c) => `${c!.name} ${c!.typeLine} ${c!.oracleText} ${(c!.keywords ?? []).join(" ")}`)
    .join(" \n ")
    .toLowerCase();
  const notes = [packet?.driveNotes, packet?.engines, packet?.payoffs, packet?.glue, packet?.feedback, packet?.failedNote]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hay = `${text}\n${notes}`;
  const lanes = [packet?.lane, ...(packet?.lanes ?? [])].filter(Boolean);
  const mill = (hay.match(/\bmill\b|put the top|self-mill|fill (your |the )?grave/g) ?? []).length + (notes.includes("mill") ? 6 : 0);
  const landfall =
    (hay.match(/\blandfall\b|additional land|lands you control|whenever a land (enters|you play)/g) ?? []).length +
    (notes.includes("landfall") ? 8 : 0);
  let equipment = 0;
  let auras = 0;
  for (const e of entries) {
    if (e.zone === "nursery") continue;
    const c = lookup(cards, e.name);
    if (!c) continue;
    const t = c.typeLine.toLowerCase();
    if (t.includes("equipment")) equipment += e.count;
    if (t.includes("aura")) auras += e.count;
  }
  let voltron = equipment + auras + (notes.includes("voltron") ? 8 : 0);
  if (lanes.includes("voltron")) voltron += 8;
  const grave = (hay.match(/from (your |a |the )?graveyard|unearth|escape|delve|reanimate|return .* graveyard/g) ?? []).length;
  const tokens = (hay.match(/create .* token/g) ?? []).length;
  const hand = (hay.match(/draw a card|draw two|no maximum hand/g) ?? []).length;
  const beatdown = (hay.match(/trample|haste|attack(s|ing)?|combat damage/g) ?? []).length;
  return { mill, landfall, voltron, grave, tokens, hand, beatdown };
}

const LAND_GAME_CHANGERS = new Set(["ancient tomb", "gaea's cradle", "gaeas cradle"]);

/** Higher is a better land. A tax tapland is not "stronger" than a fast land. */
export function landQuality(card: CachedCard): number {
  const o = card.oracleText.toLowerCase();
  const type = card.typeLine.toLowerCase();
  let q = 10;
  const payOrSac = /sacrifice it unless you pay\b/.test(o);
  const fastCheck = /enters tapped unless you control (a |an )?(plains|island|swamp|mountain|forest)/.test(o);
  const early = /two or fewer other lands/.test(o);
  const late = /two or more other lands|three or more other lands/.test(o);
  const alwaysTapped = /enters tapped/.test(o) && !/enters tapped unless/.test(o);
  if (payOrSac) q -= 45;
  if (alwaysTapped) q -= 30;
  if (late && /enters tapped unless/.test(o)) q -= 15;
  if (early) q += 18;
  if (fastCheck) q += 20;
  if (/unless you pay 2 life/.test(o)) q += 28;
  if (/add \{c\}\{c\}|add two mana/.test(o)) q += 45;
  if (/commander.s color identity/.test(o)) q += 50;
  if (/any type that a land you control could produce/.test(o)) q += 42;
  if (/add one mana of any color/.test(o) && !payOrSac) q += 26;
  if (/search your library for/.test(o) && /land/.test(o)) q += 40;
  if (/\b(plains|island|swamp|mountain|forest)\b/.test(type)) q += 18;
  if (/\bchannel\b/.test(o)) q += 30;
  if (/destroy target land|exile target land/.test(o)) q += 32;
  if (/each land is an? (swamp|forest|island|mountain|plains)/.test(o)) q += 34;
  if (LAND_GAME_CHANGERS.has(card.name.toLowerCase())) q += 60;
  return q;
}

export function scoreUtilityLand(card: CachedCard, plan: DeckSoilPlan): { score: number; reason: string } | null {
  const o = `${card.name} ${card.typeLine} ${card.oracleText}`.toLowerCase();
  const millish = plan.mill >= 4 || plan.landfall >= 4;
  const attacking = plan.voltron >= 5 || (plan.beatdown >= 10 && plan.mill < 4);

  if (/can't be blocked|target creature you control can't be blocked|unblockable/.test(o)) {
    if (!attacking) return null;
    return { score: 40, reason: "Evasion land. This list actually attacks." };
  }
  if (/equipped creature|aura you control|commander creatures you control|target creature gets \+/.test(o)) {
    if (plan.voltron < 5) return null;
    return { score: 36, reason: "Voltron land. Matches the combat plan." };
  }
  if (/landfall|whenever a land (you control )?enters|if you control (seven|ten) or more lands/.test(o) || /field of the dead/.test(o)) {
    return { score: 18 + plan.landfall * 6, reason: "Lands-matter. Pays you for playing lands." };
  }
  if (/\bmill\b|put the top/.test(o)) {
    return { score: 16 + plan.mill * 5, reason: "Mills. On-plan for this list." };
  }
  if (/play.*from.*graveyard|cast.*from.*graveyard|becomes a copy of a card in your graveyard/.test(o)) {
    return { score: 14 + plan.grave * 3, reason: "Graveyard land. The yard is doing work." };
  }
  if (/no maximum hand/.test(o)) {
    if (plan.hand < 6) return null;
    return { score: 22, reason: "Hand overflows. Tower earns it." };
  }
  if (/destroy target land|exile target land|sacrifice a land/.test(o) && /destroy|exile/.test(o)) {
    return { score: 34, reason: "Land hate. Always a lever, not a theme card." };
  }
  if (/channel/.test(o) || card.keywords.some((k) => /channel/i.test(k))) {
    return { score: 30, reason: "Channel land. Interaction that still makes mana." };
  }
  if (/each land is an? (swamp|forest|island|mountain|plains)/.test(o)) {
    return { score: 32, reason: "Paints the manabase. Fixes colors without a basic." };
  }
  if (/\{t\}: add \{[c2]\}[\{c2]/.test(o) || /add \{c\}\{c\}/.test(o) || /add two mana/.test(o)) {
    return { score: 28, reason: "Fast colorless. Pays for greedy spells." };
  }
  if (/create .* token/.test(o)) {
    if (plan.tokens < 4 && plan.landfall < 4) return null;
    return { score: 18, reason: "Token land. The list already goes wide." };
  }
  if (millish && /target creature (gets|gains)|creatures you control get/.test(o)) return null;
  return { score: 10, reason: "On-identity utility." };
}

function splitCount(total: number, weights: { key: (typeof COLS)[number]; w: number }[]): { key: (typeof COLS)[number]; n: number }[] {
  const play = weights.filter((x) => x.w > 0);
  if (!play.length || total <= 0) return [];
  const sum = play.reduce((n, x) => n + x.w, 0);
  const parts = play.map((x) => {
    const raw = (total * x.w) / sum;
    return { key: x.key, n: Math.floor(raw), frac: raw - Math.floor(raw) };
  });
  let left = total - parts.reduce((n, x) => n + x.n, 0);
  parts.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < left; i++) parts[i]!.n += 1;
  return parts.filter((x) => x.n > 0).map(({ key, n }) => ({ key, n }));
}

function plantLands(opts: {
  format: "commander" | "sixty";
  entries: DeckEntry[];
  cards: Record<string, CachedCard>;
  landCount: number;
  targetMin: number;
  targetMax: number;
  basics: SoilReport["basics"];
  sources: Record<string, number>;
  pips: Record<string, number>;
  searchers: { name: string; needs: string }[];
  fetchCount: number;
  taplands: string[];
  tapBudget: number;
}): LandPlant[] {
  const commander = opts.entries.find((e) => e.zone === "commander")?.name ?? null;
  const ident = colorIdentityOf(commander, opts.cards, opts.entries).filter((c): c is (typeof COLS)[number] =>
    COLS.includes(c as (typeof COLS)[number]),
  );
  const colors = ident.length ? ident : COLS.filter((c) => (opts.pips[c] ?? 0) > 0);
  const plants: LandPlant[] = [];
  const basicTotal = COLS.reduce((n, c) => n + (opts.basics[c] ?? 0), 0);
  const needSearchBasics = opts.searchers.length && basicTotal < 4;
  const needFetchBasics = opts.fetchCount > 0 && basicTotal < 2;
  const wantBasics = needSearchBasics ? Math.max(4 - basicTotal, 0) : needFetchBasics ? Math.max(2 - basicTotal, 0) : 0;

  const weights = colors.map((c) => {
    const hole = (opts.pips[c] ?? 0) >= 6 && (opts.sources[c] ?? 0) < 6;
    return { key: c, w: Math.max(1, (opts.pips[c] ?? 0) + (hole ? 10 : 0) + 2) };
  });

  if (wantBasics > 0 && colors.length) {
    const split = splitCount(wantBasics, weights);
    for (const s of split) {
      plants.push({
        name: BASIC_NAME[s.key],
        count: s.n,
        kind: "basic",
        reason: needSearchBasics
          ? `${s.n} ${BASIC_NAME[s.key]} — searchers in the 99 need something to hit. Duals don't feed Cultivate.`
          : `${s.n} ${BASIC_NAME[s.key]} so the fetches aren't fetching a dream.`,
      });
    }
  }

  if (opts.landCount > opts.targetMax) {
    const extra = opts.landCount - opts.targetMax;
    const taps = opts.taplands.slice(0, extra);
    for (const name of taps) {
      plants.push({
        name,
        count: 1,
        kind: "cut",
        reason: `Always tapped on this list and you're over the land count. Pull it.`,
      });
    }
  } else if (opts.taplands.length > opts.tapBudget + 2) {
    for (const name of opts.taplands.slice(opts.tapBudget)) {
      plants.push({
        name,
        count: 1,
        kind: "cut",
        reason: `Slow-land budget is ${opts.tapBudget}. This always taps.`,
      });
    }
  }

  return plants;
}

function isFetch(card: CachedCard) {
  const t = card.oracleText.toLowerCase();
  return (
    isLand(card) &&
    t.includes("sacrifice") &&
    t.includes("search your library") &&
    (t.includes("shuffle") || t.includes("plains") || t.includes("forest") || t.includes("island"))
  );
}

function coloredOf(card: CachedCard): string[] {
  const prod = (card.producedMana ?? []).filter((c) => "WUBRG".includes(c));
  if (prod.length) return prod;
  return (card.colorIdentity ?? []).filter((c) => "WUBRG".includes(c));
}

function produces(card: CachedCard) {
  return (
    (card.producedMana?.length ?? 0) > 0 ||
    /add \{/.test(card.oracleText) ||
    /add one mana/i.test(card.oracleText)
  );
}

function isRock(card: CachedCard) {
  return (
    card.typeLine.toLowerCase().includes("artifact") &&
    !card.typeLine.toLowerCase().includes("creature") &&
    produces(card) &&
    card.cmc <= 3
  );
}

function isDork(card: CachedCard) {
  return (
    card.typeLine.toLowerCase().includes("creature") &&
    produces(card) &&
    card.cmc <= 2
  );
}

type SearchKind = { test: (c: CachedCard) => boolean; needs: string };

const SEARCHERS: SearchKind[] = [
  {
    test: (c) => /search your library for (a|up to two|up to three)? ?basic land/i.test(c.oracleText),
    needs: "Basics",
  },
  {
    test: (c) => /search your library for a forest/i.test(c.oracleText) || c.name === "Nature's Lore" || c.name === "Three Visits",
    needs: "Forest cards (duals with types count)",
  },
  {
    test: (c) => c.name === "Farseek",
    needs: "A Plains, Island, Swamp, or Mountain — usually a nonbasic with a type",
  },
  {
    test: (c) =>
      /sacrifice (this|a) land/i.test(c.oracleText) &&
      /search your library for (a|two)? ?(basic )?(land|plains|island|swamp|mountain|forest)/i.test(
        c.oracleText,
      ) &&
      isLand(c),
    needs: "Basics or typed duals for fetches",
  },
];

export function analyzeSoil(
  entries: DeckEntry[],
  cards: Record<string, CachedCard>,
  format: "commander" | "sixty",
): SoilReport {
  const main = entries.filter((e) => isMainZone(e.zone));
  const of = (name: string) => lookup(cards, name);
  const ctx = buildCtx(main, of, format);

  const lands = main.filter((e) => {
    const c = of(e.name);
    return c && isLand(c);
  });
  const landCount = lands.reduce((n, e) => n + e.count, 0);

  let rocks = 0;
  let dorks = 0;
  let landRamp = 0;
  let highCmc = 0;
  let cheatHigh = 0;
  const rockNames: string[] = [];
  const dorkNames: string[] = [];
  const curve = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const e of main) {
    const c = of(e.name);
    if (!c) continue;
    if (isRock(c)) {
      rocks += e.count;
      rockNames.push(c.name);
    }
    if (isDork(c)) {
      dorks += e.count;
      dorkNames.push(c.name);
    }
    if (!isLand(c) && /search your library for.*land/i.test(c.oracleText)) landRamp += e.count;
    if (!isLand(c) && c.cmc >= 5) {
      if (isCheatPayload(c, ctx)) cheatHigh += e.count;
      else highCmc += e.count;
    }
    if (!isLand(c)) {
      const bucket = Math.min(7, Math.max(0, Math.round(c.cmc)));
      curve[bucket] = (curve[bucket] ?? 0) + e.count;
    }
  }

  const base = format === "commander" ? 37 : 24;
  const adj = Math.round(base - 0.4 * rocks - 0.35 * dorks + (highCmc > 8 ? 1 : 0) - (landRamp >= 4 ? 0 : 0));
  const targetMin = Math.max(format === "commander" ? 32 : 20, adj - 1);
  const targetMax = Math.min(format === "commander" ? 40 : 27, adj + 1);

  const taplands = lands
    .map((e) => of(e.name))
    .filter((c): c is CachedCard => !!c && alwaysEntersTapped(c, ctx))
    .map((c) => c.name);
  const tapBudget = format === "commander" ? Math.max(3, Math.round(landCount / 4)) : 2;
  const untapped = Math.max(0, landCount - taplands.length);

  let fetchCount = 0;
  let duals = 0;
  let utilityLands = 0;
  for (const e of lands) {
    const c = of(e.name);
    if (!c) continue;
    if (isFetch(c)) fetchCount += e.count;
    const cols = coloredOf(c);
    if (cols.length >= 2) duals += e.count;
    else if (cols.length === 0 && !isBasic(c)) utilityLands += e.count;
  }

  const basics = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of lands) {
    const key = BASIC_COLOR[e.name.toLowerCase()];
    if (key) basics[key] += e.count;
  }

  const searchers: { name: string; needs: string }[] = [];
  for (const e of main) {
    const c = of(e.name);
    if (!c) continue;
    for (const s of SEARCHERS) {
      if (s.test(c)) {
        searchers.push({ name: c.name, needs: s.needs });
        break;
      }
    }
  }

  const fetchish = searchers.some((s) => /fetch|basic/i.test(s.needs));
  const basicTotal = basics.W + basics.U + basics.B + basics.R + basics.G;
  let basicNeed = "Basics look incidental.";
  if (searchers.length && basicTotal < 4) {
    basicNeed = "Searchers want more basics than you currently run.";
  } else if (fetchish && basicTotal >= 6) {
    basicNeed = "Basic count matches the searchers in the list.";
  } else if (basicTotal >= 8) {
    basicNeed = "Heavy basics — fine if Harrow / Cultivate / Vista are in here; not a fetch-dual pile.";
  }

  const colorHoles: string[] = [];
  const sources: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of lands) {
    const c = of(e.name);
    if (!c) continue;
    const prod = coloredOf(c);
    for (const col of prod) {
      if (sources[col] != null) sources[col] += e.count;
    }
  }
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of main) {
    const c = of(e.name);
    if (!c || isLand(c)) continue;
    const cost = c.manaCost ?? "";
    for (const col of ["W", "U", "B", "R", "G"] as const) {
      const n = (cost.match(new RegExp(col, "g")) ?? []).length;
      pips[col] += n * e.count;
    }
  }
  for (const col of ["W", "U", "B", "R", "G"] as const) {
    if (pips[col] >= 6 && sources[col] < 6) {
      colorHoles.push(`${col}: ${pips[col]} pips vs ${sources[col]} sources`);
    }
  }

  const rationale = [
    `${format === "commander" ? "Commander" : "60-card"} default ${base}.`,
    rocks ? `${rocks} cheap rocks pull the count down.` : null,
    dorks ? `${dorks} dorks pull a little down (they die).` : null,
    landRamp ? `${landRamp} land-searchers still want land drops — don't starve them.` : null,
    highCmc > 8 ? `Lots of 5+ you actually pay for; keep the top of the range.` : null,
    cheatHigh
      ? `${cheatHigh} fat spells look cheated, reduced, or cycled — they don't ask for more lands.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  const cut: string[] = [];
  if (taplands.length > tapBudget + 2) {
    cut.push(...taplands.slice(tapBudget));
  }
  const keep = lands.map((e) => e.name).filter((n) => !cut.includes(n));
  const plants = plantLands({
    format,
    entries: main,
    cards,
    landCount,
    targetMin,
    targetMax,
    basics,
    sources,
    pips,
    searchers,
    fetchCount,
    taplands,
    tapBudget,
  });
  const add = plants.filter((p) => p.kind !== "cut").map((p) => `${p.count}x ${p.name}`);

  return {
    landCount,
    targetMin,
    targetMax,
    rationale,
    taplands,
    tapBudget,
    basics,
    basicNeed,
    searchers,
    colorHoles,
    keep,
    cut,
    add,
    rocks,
    dorks,
    landRamp,
    highCmc,
    cheatHigh,
    rockNames,
    dorkNames,
    sources: sources as SoilReport["sources"],
    pips: pips as SoilReport["pips"],
    curve,
    untapped,
    fetchCount,
    duals,
    utilityLands,
    plants,
  };
}
