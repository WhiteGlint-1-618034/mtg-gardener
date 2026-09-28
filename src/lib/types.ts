export type Zone = "main" | "sideboard" | "nursery" | "commander";

export type Job =
  | "diagnose"
  | "patch"
  | "theme"
  | "push"
  | "restrain"
  | "budget"
  | "soil";

export type Lane =
  | "voltron"
  | "wide"
  | "combo"
  | "control"
  | "alt"
  | "toolbox"
  | "value"
  | "none"
  | "unknown";

export type Table = "precon" | "focused" | "high" | "cedh" | "hold";

export type Bracket = 1 | 2 | 3 | 4 | 5;

export type Fence =
  | "no-extra-turns"
  | "no-stax"
  | "no-infect"
  | "no-infinites"
  | "no-game-changers"
  | "no-steal"
  | "keep-power";

export type CommanderJob =
  | "plan"
  | "toolbox"
  | "backup"
  | "tax"
  | "colors"
  | "engine"
  | "enabler"
  | "finisher"
  | "hate"
  | "mascot";

export type Failing =
  | "flood"
  | "no-win"
  | "flyers"
  | "combo-miss"
  | "mana"
  | "interaction"
  | "topdeck"
  | "bark";

export type PlayFormat =
  | "commander"
  | "brawl"
  | "standard"
  | "pioneer"
  | "modern"
  | "legacy"
  | "vintage"
  | "pauper";

export const PLAY_FORMATS: { id: PlayFormat; label: string; engine: "commander" | "sixty" }[] = [
  { id: "commander", label: "Commander (EDH)", engine: "commander" },
  { id: "brawl", label: "Brawl", engine: "sixty" },
  { id: "standard", label: "Standard", engine: "sixty" },
  { id: "pioneer", label: "Pioneer", engine: "sixty" },
  { id: "modern", label: "Modern", engine: "sixty" },
  { id: "legacy", label: "Legacy", engine: "sixty" },
  { id: "vintage", label: "Vintage", engine: "sixty" },
  { id: "pauper", label: "Pauper", engine: "sixty" },
];

export function engineOf(format: PlayFormat | null | undefined): "commander" | "sixty" {
  return PLAY_FORMATS.find((f) => f.id === format)?.engine ?? "commander";
}

/** Commander and Brawl are an exact size. Constructed 60-card formats have a floor, not a ceiling. */
export function deckSizeRule(format: PlayFormat | null | undefined): { kind: "exact" | "minimum"; count: number } {
  if (format === "brawl") return { kind: "exact", count: 60 };
  if (!format || format === "commander") return { kind: "exact", count: 100 };
  return { kind: "minimum", count: 60 };
}

export function formatLabel(format: PlayFormat | null | undefined): string {
  return PLAY_FORMATS.find((f) => f.id === format)?.label ?? "Commander (EDH)";
}

export type SpineId = "plan" | "trim" | "grow" | "soil" | "nursery" | "watch" | "intake";

export type CachedCard = {
  oracleId: string;
  name: string;
  typeLine: string;
  oracleText: string;
  manaCost: string;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
  producedMana: string[];
  keywords: string[];
  power: string | null;
  toughness: string | null;
  legalities: Record<string, string>;
  image: string | null;
  imageSmall?: string | null;
  imageBack: string | null;
  releasedAt: string | null;
  usd: number | null;
};

export type DeckEntry = {
  count: number;
  name: string;
  zone: Zone;
};

export type SeedPacket = {
  playFormat: PlayFormat;
  job: Job | null;
  lane: Lane | null;
  lanes: Lane[];
  table: Table | null;
  bracket: Bracket | null;
  themeIntensity: number | null;
  complexity: number | null;
  fences: Fence[];
  budget: number | null;
  driveNotes: string;
  closeLine: string;
  commanderJob: CommanderJob | null;
  commanderJobs: CommanderJob[];
  engines: string;
  payoffs: string;
  glue: string;
  failings: Failing[];
  failedNote: string;
  petCards: string;
  lockedNames: string[];
  neverNames: string[];
  customRoles: Record<string, string>;
  defenses: Record<string, string>;
  feedback: string;
  answers: Record<string, string>;
};

export type VerdictKind = "weed" | "question" | "keep";

export type CardVerdict = {
  name: string;
  kind: VerdictKind;
  reason: string;
  replaceWith?: string;
  copies?: number;
};

export type Suggestion = {
  name: string;
  reason: string;
  role: string;
  synergy?: number;
  inEdhrec?: boolean;
};

export type ColorCount = { W: number; U: number; B: number; R: number; G: number };

export type LandPlant = {
  name: string;
  count: number;
  reason: string;
  kind: "basic" | "dual" | "fetch" | "utility" | "cut";
};

export type SoilReport = {
  landCount: number;
  targetMin: number;
  targetMax: number;
  rationale: string;
  taplands: string[];
  tapBudget: number;
  basics: ColorCount;
  basicNeed: string;
  searchers: { name: string; needs: string }[];
  colorHoles: string[];
  keep: string[];
  cut: string[];
  add: string[];
  rocks: number;
  dorks: number;
  landRamp: number;
  highCmc: number;
  cheatHigh: number;
  rockNames: string[];
  dorkNames: string[];
  sources: ColorCount;
  pips: ColorCount;
  curve: number[];
  untapped: number;
  fetchCount: number;
  duals: number;
  utilityLands: number;
  plants: LandPlant[];
};

export type WatchItem = {
  id: string;
  kind: "new" | "banned" | "gamechanger" | "legal";
  name: string;
  note: string;
};

export type DeckLine = {
  cards: string[];
  produces: string[];
};

export type Analysis = {
  diagnosis: string;
  laneGuess: Lane[];
  trim: CardVerdict[];
  grow: Suggestion[];
  watch: WatchItem[];
  questions: string[];
  lines?: DeckLine[];
  template?: string;
  scaffold?: string;
  generatedAt: number;
  usedAi: boolean;
};

export type Deck = {
  id: string;
  name: string;
  short: string;
  createdAt: number;
  rawList: string;
  entries: DeckEntry[];
  cards: Record<string, CachedCard>;
  unresolved: string[];
  packet: SeedPacket;
  analysis: Analysis | null;
  soil: SoilReport | null;
  commanderName: string | null;
  format: "commander" | "sixty";
};

export const EMPTY_PACKET: SeedPacket = {
  playFormat: "commander",
  job: null,
  lane: null,
  lanes: [],
  table: "hold",
  bracket: null,
  themeIntensity: null,
  complexity: null,
  fences: [],
  budget: null,
  driveNotes: "",
  closeLine: "",
  commanderJob: null,
  commanderJobs: [],
  engines: "",
  payoffs: "",
  glue: "",
  failings: [],
  failedNote: "",
  petCards: "",
  lockedNames: [],
  neverNames: [],
  customRoles: {},
  defenses: {},
  feedback: "",
  answers: {},
};

export const JOBS: { id: Job; label: string; hint: string }[] = [
  { id: "diagnose", label: "What's this doing?", hint: "Explain the plan first. Don't change the list yet." },
  { id: "patch", label: "Keep the plan", hint: "Fill holes — draw, interaction, a real win. Don't rebuild." },
  { id: "theme", label: "More itself", hint: "Cut generic staples that don't say this commander's name." },
  { id: "push", label: "Stronger", hint: "Higher floor, faster close, same game plan." },
  { id: "restrain", label: "Tamer", hint: "Bring power and salt down to the table you named." },
  { id: "budget", label: "Cheaper", hint: "Same roles, under the dollar cap. Blank is $20. Anything over gets the axe." },
];

export const LANES: { id: Lane; label: string; hint: string }[] = [
  { id: "voltron", label: "Voltron / one attacker", hint: "Win by attacking with one stacked creature, often the commander." },
  { id: "wide", label: "Go wide", hint: "Win with a board of creatures, not one big threat." },
  { id: "combo", label: "Combo", hint: "A finite or infinite combo is the intended close." },
  { id: "control", label: "Control / lock", hint: "Answer everything until they fold — counters, wheels, stax." },
  { id: "value", label: "Value grind", hint: "Out-resource the table; the win is whatever's left standing." },
  { id: "alt", label: "Alt win (poison, mill)", hint: "Poison, mill, or another non-combat win is the point." },
  { id: "toolbox", label: "All of the above", hint: "Several of the above on purpose — pick the right close per game." },
  { id: "none", label: "It doesn't", hint: "Joke's on you — the Gardener will find this pile a win condition." },
];

export const BRACKETS: { n: Bracket; name: string; short: string; hint: string; table: Table }[] = [
  {
    n: 1,
    name: "Exhibition",
    short: "Exh",
    hint: "Theme night. No Game Changers, extra turns, mass land denial, or two-card combos.",
    table: "precon",
  },
  {
    n: 2,
    name: "Core",
    short: "Core",
    hint: "Precon-strength plan. No Game Changers, no chaining extra turns, no two-card combos.",
    table: "precon",
  },
  {
    n: 3,
    name: "Upgraded",
    short: "Upg",
    hint: "Past precon. Up to three Game Changers. No mass land denial, no early two-card combos.",
    table: "focused",
  },
  {
    n: 4,
    name: "Optimized",
    short: "Opt",
    hint: "Tuned and mean. Game Changers are on the table. Still not a tournament.",
    table: "high",
  },
  {
    n: 5,
    name: "cEDH",
    short: "cEDH",
    hint: "The pile is trying to win. Tutors, fast mana, interaction. No mercy.",
    table: "cedh",
  },
];

export function bracketOf(n: number | null | undefined): (typeof BRACKETS)[number] {
  return BRACKETS.find((b) => b.n === n) ?? BRACKETS[2]!;
}

export function bracketFromTable(table: Table | null | undefined): Bracket {
  if (table === "cedh") return 5;
  if (table === "high") return 4;
  if (table === "precon") return 2;
  if (table === "focused") return 3;
  return 3;
}

export function themeIntensityOf(n: number | null | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 5;
  return Math.min(10, Math.max(0, Math.round(n)));
}

export const THEME_TICKS: { n: number; label: string; hint: string }[] = [
  {
    n: 0,
    label: "Rorschach",
    hint: "Four cards have something in common. You don't know what. But it's there.",
  },
  {
    n: 1,
    label: "Goodstuff with a hat",
    hint: "Aristocrats, tokens, landfall — whatever. The tag is flavor text. Sol Ring still gets in.",
  },
  {
    n: 2,
    label: "Poster on the wall",
    hint: "You'll play a spellslinger card. You'll also play Cultivate because it's Cultivate.",
  },
  {
    n: 3,
    label: "Mostly the bit",
    hint: "Prefer blink or +1/+1 counters. A rock that doesn't blink is still a rock.",
  },
  {
    n: 4,
    label: "On-brand-ish",
    hint: "Off-theme only if the tag cannot do that job. Lands-matter that can't ramp still gets a ramp spell.",
  },
  {
    n: 5,
    label: "Prefer the bit",
    hint: "Lean mill, enchantress, voltron. Staples need a reason that isn't 'it's good.'",
  },
  {
    n: 6,
    label: "Say the mechanic",
    hint: "If it doesn't do storm, sacrifice, or the commander's sentence, it sweats.",
  },
  {
    n: 7,
    label: "Costume party",
    hint: "Almost only the tag. Graveyard wants graveyard. A random board wipe has to wear the shirt.",
  },
  {
    n: 8,
    label: "No tourists",
    hint: "Off-theme needs a lawyer. Sol Ring is on thin ice unless the theme is artifacts.",
  },
  {
    n: 9,
    label: "Theme police",
    hint: "If it isn't tokens / auras / extra combats / whatever you named, it isn't coming in. Maybe a lord. Maybe.",
  },
  {
    n: 10,
    label: "Cult",
    hint: "Only the EDHREC tag. Storm is storm. Empty Grow beats a staple that doesn't do the thing.",
  },
];

export function themeTick(n: number | null | undefined): (typeof THEME_TICKS)[number] {
  const v = themeIntensityOf(n);
  return THEME_TICKS.find((t) => t.n === v) ?? THEME_TICKS[5]!;
}

export function themeIntensityHint(n: number): string {
  return themeTick(n).hint;
}

export function complexityOf(n: number | null | undefined): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 5;
  return Math.min(10, Math.max(0, Math.round(n)));
}

export const COMPLEXITY_TICKS: { n: number; label: string; hint: string }[] = [
  { n: 0, label: "Smooth Brain", hint: "If you have to read the card, it's out." },
  { n: 1, label: "See Spot run", hint: "You play a creature. You attack. Reminder text is the enemy." },
  { n: 2, label: "Two buttons", hint: "Play the card. Attack. That's the line." },
  { n: 3, label: "YouTube special", hint: "One obvious sequence. If you need a diagram, no." },
  { n: 4, label: "Kitchen table", hint: "A tutor is fine. A three-piece Rube Goldberg is not." },
  { n: 5, label: "Normal brain", hint: "You'll set up. You won't write a thesis." },
  { n: 6, label: "Pay attention", hint: "Protection, a threat, maybe a mid-combat trick. Still human." },
  { n: 7, label: "Have a plan", hint: "Willing to be the villain. Tutors, threats and you have a response." },
  { n: 8, label: "Big Brain", hint: "Count mana, count opponents, don't whiff the window." },
  { n: 9, label: "Full send", hint: "Sequencing expected. If they fizzle it, that's a them problem." },
  { n: 10, label: "cEDH homework", hint: "Four-card piles, scry-to-seven, \"you had to be there.\"" },
];

export function complexityTick(n: number | null | undefined): (typeof COMPLEXITY_TICKS)[number] {
  const v = complexityOf(n);
  return COMPLEXITY_TICKS.find((t) => t.n === v) ?? COMPLEXITY_TICKS[5]!;
}

export function complexityHint(n: number): string {
  return complexityTick(n).hint;
}

export function budgetCapOf(packet: { job?: string | null; budget?: number | null }): number | null {
  if (packet.job !== "budget") return null;
  if (typeof packet.budget === "number" && packet.budget > 0) return packet.budget;
  return 20;
}

export const FENCES: { id: Fence; label: string; hint: string }[] = [
  { id: "no-extra-turns", label: "No extra turns", hint: "Don't add Time Warp, extra combat, or take-another-turn effects." },
  { id: "no-stax", label: "No stax", hint: "Don't add prison pieces that freeze other people's decks." },
  { id: "no-infect", label: "Infect is not the plan", hint: "Infect can stay as a hat. Don't make poison the win." },
  { id: "no-infinites", label: "No infinites", hint: "Finite combos are fine. Don't add loops that go infinite." },
  { id: "no-game-changers", label: "No more Game Changers", hint: "Don't add Game Changers even if the bracket would allow them." },
  { id: "no-steal", label: "Don't steal opponents' cards", hint: "Leave their graveyards and boards alone." },
];

export const COMMANDER_JOBS: { id: CommanderJob; label: string; hint: string }[] = [
  { id: "plan", label: "The plan", hint: "You win through the commander. Protect it, stack it, or combo with it." },
  { id: "finisher", label: "Finisher in the zone", hint: "You recast it to end the game, not to start it." },
  { id: "toolbox", label: "Toolbox", hint: "The commander picks a mode. The 99 does the work." },
  { id: "engine", label: "Value engine", hint: "It draws, ramps, or filters. The close is elsewhere." },
  { id: "enabler", label: "Enabler", hint: "It turns the 99 on — extra combats, lands, casts, types." },
  { id: "backup", label: "Backup", hint: "You can win without it. Don't build like it's the only threat." },
  { id: "tax", label: "Tax / deterrent", hint: "It's in the zone to scare people or tax them, not to close." },
  { id: "hate", label: "Hate piece", hint: "It's there to punish a strategy, not to be the deck." },
  { id: "colors", label: "Just here for the colors", hint: "You'd play this 99 under any legend with this identity." },
  { id: "mascot", label: "Mascot / flavor", hint: "It's on the card sleeve. Don't build around it." },
];

export const FAILINGS: { id: Failing; label: string; hint: string }[] = [
  { id: "flood", label: "Oops All Lands", hint: "Too many lands, not enough gas." },
  { id: "no-win", label: "We have a board state", hint: "The board is there. The game isn't." },
  { id: "flyers", label: "Birdemic Issue", hint: "Ground stall, then a bird ends you." },
  { id: "combo-miss", label: "Combo? Never met her", hint: "The pieces don't show up, or you can't assemble them." },
  { id: "mana", label: "Mana's a liar", hint: "Colors, taplands, or you miss land drops." },
  { id: "interaction", label: "Dies to Doomblade", hint: "One piece of interaction and the pile folds." },
  { id: "topdeck", label: "Topdeck victim", hint: "Hands don't replenish. Needs a real draw package." },
  { id: "bark", label: "All bark, no bite", hint: "The list made enemies of everyone. You weren't ready for the backlash." },
];

export function splitCardNames(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*\d+x?\s*/i, "").trim())
    .filter(Boolean);
}

export function lanesOf(packet: { lanes?: Lane[] | null; lane?: Lane | null }): Lane[] {
  if (packet.lanes?.length) return packet.lanes.filter((l) => l !== "unknown");
  if (packet.lane && packet.lane !== "unknown") return [packet.lane];
  return [];
}

export function commanderJobsOf(packet: {
  commanderJobs?: CommanderJob[] | null;
  commanderJob?: CommanderJob | null;
}): CommanderJob[] {
  if (packet.commanderJobs?.length) return packet.commanderJobs;
  if (packet.commanderJob) return [packet.commanderJob];
  return [];
}

function toggleIn<T>(cur: T[], id: T): T[] {
  return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
}

export { toggleIn };
