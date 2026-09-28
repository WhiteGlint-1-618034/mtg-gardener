import type { EngineRead, EngineRow } from "../engine/score";
import type { Deck, DeckLine } from "../types";
import { lanesOf } from "../types";

export type HoleId = "draw" | "ramp" | "interaction" | "wipe" | "win";

export type Hole = {
  id: HoleId;
  have: number;
  want: number;
  note: string;
};

export type Template = {
  holes: Hole[];
  protects: Set<HoleId>;
  landsAreRamp: boolean;
  spellsAreAnswers: boolean;
  tutorsCountAsCopies: boolean;
  text: string;
};

function hasRole(row: EngineRow, role: string) {
  return row.signals.roles.has(role);
}

function isWipe(row: EngineRow) {
  return row.signals.produces.has("wipe");
}

export function isWinCard(oracle: string, keywords: string[]) {
  const text = oracle.toLowerCase();
  if (/you win the game|\byou win\b/.test(text)) return true;
  if (keywords.some((k) => k.toLowerCase() === "infect") || /\binfect\b/.test(text)) return true;
  if (/each opponent mills|target player mills/.test(text)) return true;
  return false;
}

/**
 * A normal Commander pile wants about 10 draw, 10 ramp, 10 interaction, one reset, and a way to win.
 * The deck's own plan moves those numbers. A hole is a report, not an order to jam a staple.
 */
export function templateOf(deck: Deck, read: EngineRead, lines: DeckLine[]): Template {
  const rows = read.rows;
  const packet = deck.packet;
  const lanes = lanesOf(packet);
  const failings = new Set(packet.failings ?? []);
  const bracket = packet.bracket;
  const cedh = bracket === 5 || packet.table === "cedh" || (lanes.includes("combo") && bracket != null && bracket >= 4);
  const low = bracket != null && bracket <= 2;
  const board = (lanes.includes("wide") || lanes.includes("voltron")) && !lanes.includes("control");
  const control = lanes.includes("control") || failings.has("bark");
  const noWin = lanes.includes("none") || failings.has("no-win");
  const landsAreRamp =
    !!read.commander?.consumes.has("land.enter") ||
    rows.filter((r) => r.signals.consumes.has("land.enter")).length >= 4;
  const spellFuel = rows.filter((r) => r.signals.types.has("instant") || r.signals.types.has("sorcery")).length;
  const spellsAreAnswers = !!read.commander?.consumes.has("spell.cast") && spellFuel >= 18;
  const fastRocks = rows.filter((r) => hasRole(r, "ramp") && !r.land && r.card.cmc <= 2).length;
  const comboFast = (lanes.includes("combo") || cedh) && fastRocks >= 5;
  const tutorsCountAsCopies = cedh || lanes.includes("combo") || (bracket != null && bracket >= 4);

  const drawCards = rows.filter((r) => hasRole(r, "draw")).length;
  const tutorOnly = rows.filter((r) => hasRole(r, "tutor") && !hasRole(r, "draw")).length;
  const drawHave = drawCards + (tutorsCountAsCopies ? tutorOnly : 0);
  const rampHave = rows.filter((r) => hasRole(r, "ramp") && !r.land).length;
  const answerHave = rows.filter((r) => hasRole(r, "interaction")).length;
  const wipeHave = rows.filter(isWipe).length;
  let winHave = rows.filter((r) => isWinCard(r.card.oracleText, r.card.keywords)).length;
  if (lines.length) winHave += 1;
  if (lanes.includes("voltron") && !noWin) winHave += 1;

  let drawWant = low ? 8 : 10;
  if (failings.has("topdeck")) drawWant = 12;
  if (cedh) drawWant = 8;

  let rampWant = 10;
  if (landsAreRamp) rampWant = 4;
  else if (comboFast) rampWant = 6;
  else if (low) rampWant = 8;

  let answerWant = low ? 7 : 10;
  if (spellsAreAnswers) answerWant = Math.min(answerWant, 8);
  if (cedh || failings.has("interaction") || failings.has("bark")) answerWant = Math.max(answerWant, 12);

  const wipeWant = control ? 2 : board ? 0 : 1;
  const winWant = noWin ? 2 : 1;

  const holes: Hole[] = [];
  const push = (id: HoleId, have: number, want: number, note: string) => {
    if (have < want) holes.push({ id, have, want, note });
  };
  push(
    "draw",
    drawHave,
    drawWant,
    tutorsCountAsCopies
      ? `Draw ${drawCards} plus ${tutorOnly} tutors, against ${drawWant}. Tutors are standing in for copies.`
      : `Draw ${drawHave}/${drawWant}. A normal pile wants about 10, and tutors don't count until the deck is actually trying to find one card.`,
  );
  push(
    "ramp",
    rampHave,
    rampWant,
    landsAreRamp
      ? `Rocks and dorks ${rampHave}/${rampWant}. Lands are the ramp here, so this is not a 10-signet deck.`
      : comboFast
        ? `Fast mana ${rampHave}/${rampWant}. The pile is trying to win before a tenth rock matters.`
        : `Ramp ${rampHave}/${rampWant}.`,
  );
  push(
    "interaction",
    answerHave,
    answerWant,
    spellsAreAnswers
      ? `Answers ${answerHave}/${answerWant}. The spells already are the interaction, so they are not counted twice.`
      : `Interaction ${answerHave}/${answerWant}.`,
  );
  push("wipe", wipeHave, wipeWant, `Board resets ${wipeHave}/${wipeWant}.`);
  push(
    "win",
    winHave,
    winWant,
    noWin ? "You said it doesn't win. Finding a close outranks a pet card." : "Nothing here actually ends the game.",
  );

  const text = holes.length
    ? holes.map((h) => h.note).join(" ")
    : "Draw, ramp, interaction, a reset, and a close are all in range for this plan. The template has nothing to add.";

  return {
    holes,
    protects: new Set(holes.map((h) => h.id)),
    landsAreRamp,
    spellsAreAnswers,
    tutorsCountAsCopies,
    text,
  };
}
