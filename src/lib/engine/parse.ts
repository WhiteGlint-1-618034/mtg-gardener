import type { CachedCard } from "../types";
import { powerOffBattlefield } from "../rules/apply";

export type Signals = {
  produces: Set<string>;
  implicit: Set<string>;
  consumes: Set<string>;
  types: Set<string>;
  keywords: Set<string>;
  roles: Set<string>;
  tribes: Set<string>;
};

const CARD_TYPES = ["artifact", "creature", "enchantment", "planeswalker", "instant", "sorcery", "land", "battle", "kindred"] as const;

const ABILITY_CONSUMES: Record<string, string[]> = {
  landfall: ["land.enter"],
  metalcraft: ["artifact.count"],
  constellation: ["enchantment.enter"],
  magecraft: ["spell.cast"],
  morbid: ["creature.die"],
  revolt: ["permanent.leave"],
  alliance: ["creature.enter"],
  eerie: ["enchantment.enter"],
  descend: ["graveyard.card"],
  "fathomless descent": ["graveyard.card"],
  delirium: ["graveyard.types"],
  raid: ["creature.attack"],
  battalion: ["creature.attack"],
  enrage: ["damage.taken"],
  coven: ["creature.power"],
  paradox: ["spell.cast.elsewhere"],
  flurry: ["spell.cast"],
  valiant: ["creature.targeted"],
  heroic: ["creature.targeted"],
  survival: ["creature.enter"],
  undergrowth: ["graveyard.creature"],
  threshold: ["graveyard.count"],
  ferocious: ["creature.power4"],
  formidable: ["creature.power4"],
  corrupted: ["poison"],
  celebration: ["creature.enter", "spell.cast"],
  spectacle: ["life.lose"],
  hellbent: ["hand.empty"],
  kinship: ["tribal.top"],
  "pack tactics": ["creature.attack"],
  domain: ["land.types"],
  chroma: ["mana.color"],
  converge: ["mana.color"],
  addendum: ["phase.main"],
  "fateful hour": ["life.low"],
  lieutenant: ["commander.out"],
  eminence: ["commander"],
  inspired: ["untap"],
  imprint: ["exile.card"],
  grandeur: ["discard.named"],
  bloodrush: ["discard.creature", "creature.attack"],
  "will of the council": ["vote"],
  "secret council": ["vote"],
  "start your engines!": ["speed"],
  "max speed": ["speed"],
  renew: ["graveyard.card"],
  void: ["spell.cast.elsewhere"],
  covercast: ["spell.cast"],
  vivid: ["mana.color"],
  infusion: ["counter.any"],
  repartee: ["spell.cast"],
  opus: ["spell.cast"],
};

const KEYWORD_LINKS: Record<string, { produces?: string[]; consumes?: string[]; implicit?: string[] }> = {
  modular: { produces: ["counter.plus1", "counter.move.artifact"], consumes: ["artifact.die", "creature.die"], implicit: ["be.artifact"] },
  persist: { produces: ["creature.enter", "counter.minus1"], consumes: ["creature.die"] },
  undying: { produces: ["creature.enter", "counter.plus1"], consumes: ["creature.die"] },
  unearth: { produces: ["creature.enter"], consumes: ["graveyard.creature"] },
  embalm: { produces: ["token.create", "creature.enter"], consumes: ["graveyard.creature"] },
  eternalize: { produces: ["token.create", "creature.enter"], consumes: ["graveyard.creature"] },
  encore: { produces: ["token.create", "creature.enter"], consumes: ["graveyard.creature"] },
  disturb: { produces: ["permanent.enter"], consumes: ["graveyard.card"] },
  escape: { produces: ["spell.cast", "permanent.enter"], consumes: ["graveyard.card"] },
  flashback: { produces: ["spell.cast"], consumes: ["graveyard.card"] },
  "jump-start": { produces: ["spell.cast"], consumes: ["graveyard.card", "discard"] },
  retrace: { produces: ["spell.cast"], consumes: ["graveyard.card", "discard.land"] },
  harmonize: { produces: ["spell.cast"], consumes: ["graveyard.card"] },
  dredge: { produces: ["mill", "graveyard.card"], consumes: ["draw"] },
  delve: { consumes: ["graveyard.card"], implicit: ["spell.cost"] },
  miracle: { produces: ["spell.cast"], consumes: ["draw"] },
  foretell: { produces: ["spell.cast"] },
  suspend: { produces: ["spell.cast", "counter.time"] },
  storm: { consumes: ["spell.cast"], produces: ["spell.copy"] },
  prowess: { consumes: ["spell.cast"] },
  cascade: { produces: ["spell.cast"] },
  discover: { produces: ["spell.cast"] },
  affinity: { consumes: ["artifact.count"], implicit: ["be.artifact"] },
  improvise: { consumes: ["artifact.tap"] },
  convoke: { consumes: ["creature.tap"] },
  exploit: { produces: ["sacrifice.creature", "graveyard.creature"], consumes: ["creature.die"] },
  casualty: { produces: ["spell.copy", "sacrifice.creature"] },
  demonstrate: { produces: ["spell.copy"] },
  overload: { produces: ["wipe"] },
  flashback2: {},
  landfall: { consumes: ["land.enter"] },
  fabricate: { produces: ["token.create", "counter.plus1"] },
  afterlife: { produces: ["token.create"], consumes: ["creature.die"] },
  amass: { produces: ["token.create", "counter.plus1"] },
  investigate: { produces: ["token.clue"] },
  incubate: { produces: ["token.create"] },
  populate: { produces: ["token.create"], consumes: ["token.create"] },
  offspring: { produces: ["token.create"] },
  mobilize: { produces: ["token.create"], consumes: ["creature.attack"] },
  myriad: { produces: ["token.create"], consumes: ["creature.attack"] },
  squad: { produces: ["token.create"] },
  backup: { produces: ["counter.plus1"] },
  training: { produces: ["counter.plus1"], consumes: ["creature.attack"] },
  mentor: { produces: ["counter.plus1"], consumes: ["creature.attack"] },
  support: { produces: ["counter.plus1"] },
  outlast: { produces: ["counter.plus1"] },
  adapt: { produces: ["counter.plus1"] },
  evolve: { produces: ["counter.plus1"], consumes: ["creature.enter"] },
  graft: { produces: ["counter.plus1"], consumes: ["creature.enter"] },
  bloodthirst: { produces: ["counter.plus1"], consumes: ["damage"] },
  renown: { produces: ["counter.plus1"], consumes: ["combat.damage"] },
  riot: { produces: ["counter.plus1", "haste"] },
  unleash: { produces: ["counter.plus1"] },
  devour: { produces: ["counter.plus1", "sacrifice.creature", "graveyard.creature"] },
  scavenge: { produces: ["counter.plus1"], consumes: ["graveyard.creature"] },
  reinforce: { produces: ["counter.plus1"], consumes: ["discard"] },
  monstrous: { produces: ["counter.plus1"] },
  monstrosity: { produces: ["counter.plus1"] },
  proliferate: { produces: ["counter.proliferate"], consumes: ["counter.any"] },
  toxic: { produces: ["poison"] },
  infect: { produces: ["poison", "counter.minus1"] },
  poisonous: { produces: ["poison"] },
  wither: { produces: ["counter.minus1"] },
  lifelink: { produces: ["life.gain"] },
  extort: { produces: ["life.gain", "life.lose"], consumes: ["spell.cast"] },
  soulbond: { consumes: ["creature.enter"] },
  soulshift: { consumes: ["graveyard.creature"], produces: ["graveyard.creature"] },
  ninjutsu: { consumes: ["combat.damage"], produces: ["creature.enter"] },
  "commander ninjutsu": { consumes: ["combat.damage"], produces: ["creature.enter"] },
  blitz: { produces: ["creature.enter", "haste", "sacrifice.creature", "draw"] },
  dash: { produces: ["creature.enter", "haste"] },
  encore2: {},
  mutate: { consumes: ["creature.enter"], produces: ["creature.merge"] },
  bestow: { implicit: ["be.aura"], produces: ["aura.attach"] },
  equip: { implicit: ["be.equipment"], produces: ["equipment.attach"] },
  "living weapon": { implicit: ["be.equipment"], produces: ["token.create", "equipment.attach"] },
  "for mirrodin!": { implicit: ["be.equipment"], produces: ["token.create", "equipment.attach"] },
  reconfigure: { implicit: ["be.equipment", "be.artifact"], produces: ["equipment.attach"] },
  fortify: { implicit: ["be.fortification"], produces: ["land.attach"] },
  enchant: { implicit: ["be.aura"] },
  crew: { consumes: ["creature.tap"], implicit: ["be.vehicle"] },
  saddle: { consumes: ["creature.tap"] },
  station: { consumes: ["creature.tap"], produces: ["counter.charge"] },
  craft: { implicit: ["be.artifact"], consumes: ["exile.permanent"] },
  exhaust: { produces: ["activated"] },
  warp: { produces: ["spell.cast"] },
  mayhem: { produces: ["spell.cast"], consumes: ["discard"] },
  bargain: { produces: ["sacrifice.permanent"] },
  spree: { produces: ["spell.mode"] },
  gift: { produces: ["token.create", "draw"] },
  plot: { produces: ["spell.cast"] },
  cycling: { produces: ["draw", "discard", "discard.self"] },
  typecycling: { produces: ["draw"], consumes: ["tutor.type"] },
  landcycling: { produces: ["tutor.land"] },
  channel: { produces: ["activated"], consumes: ["discard"] },
  transmute: { produces: ["tutor"], consumes: ["discard"] },
  madness: { produces: ["spell.cast"], consumes: ["discard"] },
  connive: { produces: ["draw", "discard", "counter.plus1"] },
  surveil: { produces: ["graveyard.card", "selection"] },
  explore: { produces: ["land.enter", "counter.plus1"] },
  scry: { produces: ["selection"] },
  manifest: { produces: ["creature.enter", "facedown"] },
  disguise: { produces: ["creature.enter", "facedown"] },
  morph: { produces: ["creature.enter", "facedown"] },
  megamorph: { produces: ["creature.enter", "counter.plus1"] },
  cloak: { produces: ["creature.enter", "facedown"] },
  prototype: { implicit: ["be.artifact"], produces: ["spell.cast"] },
  emerge: { produces: ["sacrifice.creature", "spell.cast"] },
  evoke: { produces: ["creature.enter", "sacrifice.creature"] },
  cascade2: {},
  rebound: { produces: ["spell.cast"] },
  buyback: { produces: ["spell.return"] },
  flash: { implicit: ["timing.flash"] },
  haste: { implicit: ["haste"] },
  trample: { implicit: ["trample"] },
  flying: { implicit: ["flying"] },
  deathtouch: { implicit: ["deathtouch"] },
  lifelink2: {},
  menace: { implicit: ["menace"] },
  ward: { produces: ["protection"] },
  hexproof: { produces: ["protection"] },
  shroud: { produces: ["protection"] },
  indestructible: { produces: ["protection"] },
  protection: { produces: ["protection"] },
  annihilator: { produces: ["sacrifice.permanent"], consumes: ["creature.attack"] },
  exalted: { produces: ["pump"], consumes: ["creature.attack"] },
  dethrone: { produces: ["counter.plus1"], consumes: ["creature.attack"] },
  melee: { produces: ["pump"], consumes: ["creature.attack"] },
  "battle cry": { produces: ["pump"], consumes: ["creature.attack"] },
  partner: { implicit: ["commander.partner"] },
  "partner with": { implicit: ["commander.partner"] },
  "choose a background": { implicit: ["commander.background"] },
  background: { implicit: ["be.background"] },
  daybound: { produces: ["day.night"] },
  nightbound: { produces: ["day.night"] },
  descend2: {},
  mill: { produces: ["mill", "graveyard.card"] },
  goad: { produces: ["goad"] },
  suspect: { produces: ["suspect"] },
  monarch: { produces: ["monarch", "draw"] },
  initiative: { produces: ["dungeon"] },
  venture: { produces: ["dungeon"] },
  "the ring tempts you": { produces: ["ring"] },
  toxic2: {},
  energy: { produces: ["energy"], consumes: ["energy"] },
  firebending: { produces: ["mana.red"], consumes: ["creature.attack"] },
  earthbending: { produces: ["land.animate"] },
  waterbending: { produces: ["tap.pay"] },
  airbending: { produces: ["exile.permanent"] },
  freerunning: { consumes: ["creature.deal.combat"] },
  "double strike": { implicit: ["combat.extra"] },
  "first strike": { implicit: ["combat.extra"] },
  vigilence: {},
  vigilance: { implicit: ["vigilance"] },
  reach: { implicit: ["reach"] },
  defender: { implicit: ["defender"] },
  menace2: {},
  skulk: { implicit: ["skulk"] },
  shadow: { implicit: ["shadow"] },
  fear: { implicit: ["fear"] },
  intimidate: { implicit: ["intimidate"] },
  flanking: { implicit: ["flanking"] },
  bushido: { implicit: ["bushido"] },
  horsemanship: { implicit: ["horsemanship"] },
  landwalk: { implicit: ["landwalk"] },
  forestwalk: { implicit: ["landwalk"] },
  islandwalk: { implicit: ["landwalk"] },
  swampwalk: { implicit: ["landwalk"] },
  mountainwalk: { implicit: ["landwalk"] },
  plainswalk: { implicit: ["landwalk"] },
  phasing: { produces: ["phase.out"] },
  levelup: { produces: ["counter.level"] },
  "level up": { produces: ["counter.level"] },
  vanishing: { produces: ["counter.time"], consumes: ["counter.time"] },
  fading: { produces: ["counter.fade"] },
  suspend2: {},
  kicker: { produces: ["spell.kicker"] },
  multikicker: { produces: ["spell.kicker"] },
  replicate: { produces: ["spell.copy"] },
  ripple: { produces: ["spell.cast"] },
  conspire: { produces: ["spell.copy"], consumes: ["creature.tap"] },
  overload2: {},
  entwine: { produces: ["spell.mode"] },
  escalate: { produces: ["spell.mode"] },
  cleave: { produces: ["spell.mode"] },
  tiered: { produces: ["spell.mode"] },
  spree2: {},
  aftermath: { produces: ["spell.cast"], consumes: ["graveyard.card"] },
  fuse: { produces: ["spell.cast"] },
  cipher: { produces: ["spell.cast"], consumes: ["combat.damage"] },
  haunt: { produces: ["creature.die"], consumes: ["creature.die"] },
  soulbond2: {},
  tribute: { produces: ["counter.plus1"] },
  dash2: {},
  surge: { consumes: ["spell.cast"] },
  spectacle2: {},
  "heroic2": {},
  prowess2: {},
  magecraft: { consumes: ["spell.cast"] },
  storm2: {},
  convoke2: {},
  delve2: {},
  improvise2: {},
  affinity2: {},
  metalcraft: { consumes: ["artifact.count"] },
  constellation: { consumes: ["enchantment.enter"] },
  landfall2: {},
  morbid: { consumes: ["creature.die"] },
  revolt: { consumes: ["permanent.leave"] },
  alliance: { consumes: ["creature.enter"] },
  eerie: { consumes: ["enchantment.enter"] },
  descend3: {},
  delirium: { consumes: ["graveyard.types"] },
  threshold: { consumes: ["graveyard.count"] },
  undergrowth: { consumes: ["graveyard.creature"] },
  raid: { consumes: ["creature.attack"] },
  enrage: { consumes: ["damage.taken"] },
  coven: { consumes: ["creature.power"] },
  paradox: { consumes: ["spell.cast.elsewhere"] },
  flurry: { consumes: ["spell.cast"] },
  valiant: { consumes: ["creature.targeted"] },
  heroic: { consumes: ["creature.targeted"] },
  survival: { consumes: ["creature.enter"] },
  ferocious: { consumes: ["creature.power4"] },
  formidable: { consumes: ["creature.power4"] },
  corrupted: { consumes: ["poison"] },
  hellbent: { consumes: ["hand.empty"] },
  spectacle: { consumes: ["life.lose"] },
  lieutenant: { consumes: ["commander.out"] },
  eminence: { consumes: ["commander"] },
  inspired: { consumes: ["untap"] },
  renew: { consumes: ["graveyard.card"] },
  void: { consumes: ["spell.cast.elsewhere"] },
  "pack tactics": { consumes: ["creature.attack"] },
  battalion: { consumes: ["creature.attack"] },
  domain: { consumes: ["land.types"] },
  madness2: {},
  cycling2: {},
  forecast: { produces: ["activated"] },
  transmute2: {},
  recover: { consumes: ["graveyard.card"], produces: ["spell.return"] },
  gravestorm: { consumes: ["graveyard.card"], produces: ["spell.copy"] },
  hideaway: { produces: ["exile.card", "spell.cast"] },
  miracle2: {},
  rebound2: {},
  epic: { produces: ["spell.copy"] },
  splice: { produces: ["spell.copy"] },
  assist: { produces: ["spell.cost"] },
  companion: { implicit: ["companion"] },
  "doctor's companion": { implicit: ["companion"] },
  "friends forever": { implicit: ["commander.partner"] },
  "choose a background2": {},
  compleated: { produces: ["poison"] },
  ward2: {},
  toxic3: {},
  incubate2: {},
  blitz2: {},
  "living metal": { implicit: ["be.vehicle", "be.artifact"] },
  prototype2: {},
  unearth2: {},
  intensity: { produces: ["spell.cast"] },
  disguise2: {},
  bargain2: {},
  offspring2: {},
  gift2: {},
  impending: { produces: ["counter.time", "permanent.enter"] },
  exhaust2: {},
  mobilize2: {},
  jobselect: { produces: ["token.create"] },
  "job select": { produces: ["token.create"] },
  "double team": { produces: ["token.create"] },
  teamwork: { consumes: ["creature.attack"] },
  webslinging: { consumes: ["creature.return"] },
  "web-slinging": { consumes: ["creature.return"], produces: ["creature.enter"] },
  prowl: { consumes: ["combat.damage"] },
  sneak: { produces: ["creature.enter"] },
  station2: {},
  warp2: {},
  mayhem2: {},
  plot2: {},
  harmonize2: {},
  freerunning2: {},
  spree3: {},
  saddle2: {},
  "more than meets the eye": { produces: ["transform"], implicit: ["be.artifact", "be.creature"] },
  craft2: {},
  formirrodin: {},
  reconfigure2: {},
  readah: {},
  "read ahead": { implicit: ["be.saga"] },
  ravenous: { produces: ["counter.plus1"] },
  enlist: { consumes: ["creature.tap"], produces: ["pump"] },
  decayed: { produces: ["sacrifice.creature", "token.create"] },
  "nightbound2": {},
  daybound2: {},
  training2: {},
  cleave2: {},
  specialize: { produces: ["color.change"] },
};

function addAll(set: Set<string>, items: string[] | undefined) {
  for (const item of items ?? []) set.add(item);
}

function firstType(text: string): string | null {
  const s = text.toLowerCase();
  if (/instant or sorcery|noncreature spell/.test(s)) return "spell";
  for (const type of CARD_TYPES) {
    if (new RegExp(`\\b${type}s?\\b`).test(s)) return type === "kindred" ? "tribal" : type;
  }
  if (/\bspell\b/.test(s)) return "spell";
  if (/\bpermanent\b/.test(s)) return "permanent";
  if (/\btoken\b/.test(s)) return "token";
  return null;
}

/** Printed-era text and current Oracle name the same zones. Fold them before matching. */
function canonicalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bdiscard pile\b/g, "graveyard")
    .replace(/\bremoved from the game\b/g, "exiled")
    .replace(/\bremoves? ([^.]{0,80}?) from the game\b/g, "exile $1")
    .replace(/\bcomes into play\b/g, "enters")
    .replace(/\bput into play\b/g, "put onto the battlefield")
    .replace(/\binto play\b/g, "onto the battlefield")
    .replace(/\bin play\b/g, "on the battlefield")
    .replace(/\bfrom play\b/g, "from the battlefield")
    .replace(/\benters the battlefield\b/g, "enters")
    .replace(/\bbury\b/g, "destroy");
}

function fromGrave(s: string) {
  return /from (your |a |the |their )?graveyard/.test(s) || /in (a |your |the |their )?graveyard/.test(s);
}

function leavesGrave(s: string) {
  if (/leaves? [^.]{0,50}graveyard/.test(s)) return true;
  return fromGrave(s) && /battlefield|\bhand\b|\blibrary\b|\bexile|\bcast\b|\breturn/.test(s);
}

function manaAdded(text: string): number {
  const s = text.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
  let best = 0;
  for (const match of s.matchAll(/add (one|two|three|four|five|six|seven) mana/g)) {
    best = Math.max(best, words[match[1]!] ?? 0);
  }
  for (const match of s.matchAll(/add\s+((?:\{[wubrgc]\})+)/g)) {
    best = Math.max(best, (match[1]!.match(/\{[wubrgc]\}/g) ?? []).length);
  }
  return best;
}

function selfBins(s: string) {
  if (/sacrifice it unless you pay\b/.test(s)) return false;
  return (
    /gets? -x\/-x, where x is your life/.test(s) ||
    /when this (creature |permanent )?enters, sacrifice it/.test(s) ||
    /sacrifice it unless you sacrifice/.test(s)
  );
}

function usedAndMade(text: string): { used: string[]; made: string[] } {
  const s = canonicalize(text);
  const used: string[] = [];
  const made: string[] = [];
  const type = firstType(s);

  if (fromGrave(s)) used.push(type ? `graveyard.${type}` : "graveyard.card");
  if (leavesGrave(s)) {
    const watching = /^(whenever|when|at )\b/.test(s) || /leaves? /.test(s);
    if (watching) used.push("graveyard.leave");
    else made.push("graveyard.leave");
  }
  if (/into (your |a |their |the )?graveyard|put into (your |a )?graveyard/.test(s) || /\bdies\b/.test(s) || /\bdestroy\b/.test(s)) {
    made.push(type ? `graveyard.${type}` : "graveyard.enter");
  }
  const sac = s.match(/sacrifice (?:an? |another )?(artifact|creature|enchantment|land|permanent|token|blood|clue|food|treasure)/);
  if (sac?.[1]) made.push(`sacrifice.${sac[1]}`, `graveyard.${sac[1]}`);
  else if (/sacrifice (?:a |another )?permanent/.test(s)) made.push("sacrifice.permanent", "graveyard.permanent");
  if (/onto the battlefield|to the battlefield/.test(s) && type && type !== "spell") made.push(`${type}.enter`);
  if (/\benters\b/.test(s) && type) {
    if (type === "spell") used.push("spell.cast");
    else made.push(`${type}.enter`);
  }
  if (/\bdies\b/.test(s)) used.push(type ? `${type}.die` : "creature.die");
  if (/attacks?\b/.test(s)) used.push(type && type !== "spell" ? `${type}.attack` : "creature.attack");
  if (/you cast|casts?\b/.test(s) && /instant|sorcery|spell|noncreature/.test(s)) used.push("spell.cast");
  if (/power \d+ or greater|power 4 or greater|greatest power/.test(s)) used.push("creature.power4");
  if (/\+1\/\+1 counter/.test(s)) made.push("counter.plus1");
  if (/-1\/-1 counter/.test(s)) made.push("counter.minus1");
  if (/proliferate/.test(s)) made.push("counter.proliferate");
  if (/charge counter/.test(s)) made.push("counter.charge");
  if (/energy counter|\benergy\b/.test(s)) made.push("energy");
  if (/experience counter/.test(s)) made.push("experience");
  if (/poison counter|\bpoison\b/.test(s)) made.push("poison");
  if (/rad counter/.test(s)) made.push("rad");
  if (/time counter/.test(s)) made.push("counter.time");
  if (/create .{0,60}token/.test(s)) made.push("token.create");
  if (/treasure token/.test(s)) made.push("token.treasure", "token.create");
  if (/clue token|investigate/.test(s)) made.push("token.clue", "token.create");
  if (/food token/.test(s)) made.push("token.food", "token.create");
  if (/blood token/.test(s)) made.push("token.blood", "token.create");
  if (/\bdraw\b/.test(s)) made.push("draw");
  if (/\bdiscard/.test(s) && !/discard pile/.test(s)) {
    const youToo = /you (may )?discard|discard your hand|each player|you and each/.test(s);
    const someoneElse = /opponent|target player|another player/.test(s) && !youToo;
    if (!someoneElse) {
      made.push("discard", "discard.self");
      const typed = s.match(/discard (?:a |an |one |two |three |x )?(creature|artifact|enchantment|land|instant|sorcery) cards?/);
      if (typed?.[1]) made.push(`graveyard.${typed[1]}`);
      else made.push("graveyard.card");
      if (/discard your hand|discards? their hand|discard (any number|the rest)/.test(s)) made.push("discard.hand");
    } else {
      made.push("discard.opponent");
    }
  }
  if (/\bmill\b|library into (your |their |a )?graveyard|put the top .{0,30}into (your |their )?graveyard/.test(s)) {
    made.push("mill", "graveyard.card");
  }
  if (/you gain life|gains? \d+ life/.test(s)) made.push("life.gain");
  if (/you lose life|loses? \d+ life|pay \d+ life/.test(s)) made.push("life.lose");
  if (/deals? .{0,20}damage/.test(s)) made.push("damage");
  if (/counter target spell|counter target activated/.test(s)) made.push("counterspell");
  if (/destroy all|each (creature|permanent)|exile all/.test(s)) made.push("wipe");
  else if (/destroy target|exile target/.test(s)) made.push("removal");
  if (/extra turn/.test(s)) made.push("extra.turn");
  if (/additional combat/.test(s)) made.push("extra.combat");
  if (/copy (target |that |a )?(instant|sorcery|spell)/.test(s)) made.push("spell.copy");
  if (/becomes a copy|enters as a copy|copy of (target |a |that )?creature/.test(s)) made.push("clone");
  if (/search your library/.test(s)) made.push(type === "land" || /land/.test(s) ? "tutor.land" : "tutor");
  if (/without paying/.test(s)) made.push("cheat.cast");
  if (/the monarch/.test(s)) made.push("monarch");
  if (/venture into the dungeon|the initiative/.test(s)) made.push("dungeon");
  if (/ring tempts/.test(s)) made.push("ring");
  if (/goad/.test(s)) made.push("goad");
  if (/suspect/.test(s)) made.push("suspect");
  if (/connive/.test(s)) made.push("connive", "draw", "discard");
  if (/surveil/.test(s)) made.push("surveil", "graveyard.card");
  if (/explore/.test(s)) made.push("explore");
  if (/\bscry\b/.test(s)) made.push("selection");
  if (/untap target|untap all/.test(s)) made.push("untap");
  if (/equip /.test(s) || (/attach /.test(s) && /equipment/.test(s))) made.push("equipment.attach");
  if (/enchant /.test(s)) made.push("aura.attach");
  if (/power of (the other|that|another|a creature)/.test(s)) used.push("creature.power.graveyard");
  if (/enters as a copy|as a copy of/.test(s)) made.push("clone");
  if (selfBins(s)) made.push("graveyard.creature", "bins.self");
  return { used, made };
}

function absorb(side: "condition" | "effect" | "cost", text: string, produces: Set<string>, consumes: Set<string>) {
  const { used, made } = usedAndMade(text);
  if (side === "condition") {
    for (const event of [...used, ...made]) consumes.add(event);
    return;
  }
  for (const event of used) consumes.add(event);
  for (const event of made) produces.add(event);
}

function splitTrigger(line: string): { condition: string; effect: string } | null {
  const match = line.match(/^(whenever|when|at the beginning of .+?|at the end of .+?)\s+(.+?),\s+([\s\S]+)$/i);
  if (!match) return null;
  return { condition: `${match[1]} ${match[2]}`, effect: match[3] ?? "" };
}

export function parseCard(card: CachedCard): Signals {
  const produces = new Set<string>();
  const implicit = new Set<string>();
  const consumes = new Set<string>();
  const types = new Set<string>();
  const keywords = new Set<string>();
  const roles = new Set<string>();
  const tribes = new Set<string>();

  const typeLine = card.typeLine.toLowerCase();
  for (const type of CARD_TYPES) {
    if (new RegExp(`\\b${type}\\b`).test(typeLine)) types.add(type === "kindred" ? "tribal" : type);
  }
  const tribePart = card.typeLine.split(/[—-]/)[1] ?? "";
  for (const word of tribePart.toLowerCase().split(/\s+/)) {
    if (word && !["legendary", "creature", "token", "snow", "basic", "world", "ongoing", "artifact", "enchantment"].includes(word)) {
      tribes.add(word);
    }
  }

  if (types.has("artifact")) implicit.add("be.artifact");
  if (types.has("creature")) implicit.add("be.creature");
  if (types.has("enchantment")) implicit.add("be.enchantment");
  if (types.has("instant")) implicit.add("cast.instant");
  if (types.has("sorcery")) implicit.add("cast.sorcery");
  if (types.has("instant") || types.has("sorcery")) implicit.add("spell.cast");
  if (types.has("land")) implicit.add("land.enter");
  if (types.has("planeswalker")) implicit.add("be.planeswalker");
  if (/\bequipment\b/.test(typeLine)) implicit.add("be.equipment");
  if (/\baura\b/.test(typeLine)) implicit.add("be.aura");
  if (/\bvehicle\b/.test(typeLine)) implicit.add("be.vehicle");
  if (/\bsaga\b/.test(typeLine)) implicit.add("be.saga");
  const power = Number(card.power);
  if (Number.isFinite(power) && power >= 4) implicit.add("creature.power4");

  for (const raw of card.keywords ?? []) {
    const key = raw.toLowerCase();
    keywords.add(key);
    const link = KEYWORD_LINKS[key];
    addAll(produces, link?.produces);
    addAll(consumes, link?.consumes);
    addAll(implicit, link?.implicit);
    const ability = ABILITY_CONSUMES[key];
    if (ability) for (const event of ability) consumes.add(event);
  }

  const oracle = card.oracleText.toLowerCase();
  for (const [word, events] of Object.entries(ABILITY_CONSUMES)) {
    if (oracle.includes(word)) for (const event of events) consumes.add(event);
  }

  for (const line of card.oracleText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("(")) continue;
    const trigger = splitTrigger(trimmed);
    if (trigger) {
      absorb("condition", trigger.condition, produces, consumes);
      absorb("effect", trigger.effect, produces, consumes);
      continue;
    }
    const activated = trimmed.match(/^([^:]{3,90}):\s+([\s\S]+)$/);
    if (activated) {
      absorb("cost", activated[1] ?? "", produces, consumes);
      absorb("effect", activated[2] ?? "", produces, consumes);
      continue;
    }
    absorb("effect", trimmed, produces, consumes);
  }

  const whole = canonicalize(card.oracleText);
  if (/enchant [^\n]*graveyard/.test(whole) && /return enchanted/.test(whole)) {
    produces.add("graveyard.leave");
    const enchanted = firstType(whole.match(/enchant [^\n]*/)?.[0] ?? "");
    if (enchanted && enchanted !== "spell") produces.add(`${enchanted}.enter`);
  }
  const zone = powerOffBattlefield(card.oracleText, card.power);
  if (zone.usePrinted && Number(card.power) >= 4) implicit.add("creature.power.graveyard");
  if (!zone.usePrinted) {
    implicit.delete("creature.power4");
    implicit.add("power.defined");
  }
  if (/\bgets? [+-]/.test(whole)) implicit.add("power.battlefield.only");

  if (produces.has("draw") || consumes.has("draw")) roles.add("draw");
  if (produces.has("tutor.land") || implicit.has("land.enter") && produces.has("mana") || /add \{/.test(oracle) && !types.has("land")) roles.add("ramp");
  if (/add \{/.test(card.oracleText) && !types.has("land")) {
    produces.add("mana");
    roles.add("ramp");
  }
  if (produces.has("tutor.land") || /search your library for .{0,40}land/.test(oracle)) roles.add("ramp");
  if (produces.has("counterspell") || produces.has("removal") || produces.has("wipe")) roles.add("interaction");
  if (produces.has("tutor") || produces.has("tutor.land")) roles.add("tutor");
  if (
    produces.has("discard.self") &&
    !produces.has("discard.hand") &&
    types.has("creature") &&
    (keywords.has("cycling") || keywords.has("typecycling") || keywords.has("transmute"))
  ) {
    produces.add("graveyard.creature");
  }
  if (!types.has("land")) {
    const added = manaAdded(oracle);
    if (added > 0) {
      produces.add("mana");
      roles.add("ramp");
      const fast = (added >= 1 && card.cmc <= 0) || (added >= 2 && card.cmc <= 1) || (added >= 3 && card.cmc <= 3);
      if (fast) produces.add("mana.fast");
    }
  }

  return { produces, implicit, consumes, types, keywords, roles, tribes };
}

export function blobEvents(signals: Signals): string[] {
  return [...signals.produces, ...signals.consumes, ...signals.implicit].slice(0, 8);
}
