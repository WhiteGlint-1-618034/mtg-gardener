import type { CachedCard } from "../types";

export type OracleFacts = {
  lines: string[];
  adds: string[];
  entersTapped: boolean;
  payToStay: boolean;
  fear: boolean;
};

/** Claims that are literally in the Oracle text. A later layer may not invent one of these. */
export function readOracle(card: Pick<CachedCard, "oracleText">): OracleFacts {
  const lines = card.oracleText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("("));
  const text = lines.join(" ");
  const lower = text.toLowerCase();
  const adds = new Set<string>();
  for (const match of text.matchAll(/add (?:\{[WUBRGC]\})+/gi)) {
    for (const sym of match[0].matchAll(/\{([WUBRGC])\}/g)) adds.add(sym[1]!.toUpperCase());
  }
  if (/add (?:one|two|three) mana of any(?: one)? color/i.test(text)) adds.add("any");
  const canDodgeTap =
    /enters(?: the battlefield)? tapped unless/i.test(text) ||
    (/you may pay/i.test(text) && /if you don't, it enters tapped/i.test(lower));
  return {
    lines,
    adds: [...adds],
    entersTapped: /enters(?: the battlefield)? tapped/i.test(text) && !canDodgeTap,
    payToStay: /sacrifice it unless you pay/i.test(lower),
    fear: /gains fear|have fear/.test(lower),
  };
}

export function oracleLine(facts: OracleFacts) {
  const bits = [facts.lines.join(" / ") || "(no oracle)"];
  if (facts.adds.length) bits.push(`adds ${facts.adds.join("")}`);
  bits.push(facts.entersTapped ? "enters tapped" : "does not enter tapped");
  bits.push(facts.payToStay ? "you pay or it leaves" : "no keep-it tax");
  return bits.join(". ");
}

/** Drop any mechanical claim the Oracle read does not support, then cite the text. */
export function groundClaim(claim: string, facts: OracleFacts) {
  let text = claim;
  if (!facts.entersTapped) text = text.replace(/[^.]*\benters tapped\b[^.]*\.?/gi, "");
  if (!facts.payToStay) {
    text = text.replace(/[^.]*pay just to keep it[^.]*\.?/gi, "");
    text = text.replace(/[^.]*sacrifice it unless you pay[^.]*\.?/gi, "");
  }
  const body = text.replace(/\s+/g, " ").trim();
  const oracle = facts.lines.join(" ") || "(no oracle)";
  return `${body ? `${body} ` : ""}Oracle: “${oracle}”.`.replace(/\s+/g, " ").trim();
}
