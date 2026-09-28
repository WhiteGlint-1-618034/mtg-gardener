import type { EngineRead, EngineRow } from "../engine/score";
import type { Tilted } from "../engine/preferences";
import type { CachedCard, DeckLine } from "../types";
import { oracleLine, readOracle, type OracleFacts } from "./oracle";

export type EdgeKind = "enables" | "line" | "redundant" | "conflicts" | "none";

export type ScaffoldEdge = {
  kind: EdgeKind;
  with: string;
  note: string;
};

export type ScaffoldCard = {
  name: string;
  zone: string;
  link: number;
  facts: OracleFacts;
  edges: ScaffoldEdge[];
};

function conflicts(row: EngineRow, read: EngineRead) {
  const text = row.card.oracleText.toLowerCase();
  const wantsYard = [...(read.commander?.consumes ?? [])].some((e) => e.startsWith("graveyard."));
  if (wantsYard && /exile (all|each|target|any number).{0,40}graveyard|cards from graveyards? can't/.test(text)) {
    return "Oracle exiles or locks the graveyard this commander spends";
  }
  if (read.commander?.consumes.has("spell.cast") && /players can't cast|can't cast more than one/.test(text)) {
    return "Oracle stops the spells this commander spends";
  }
  return null;
}

function roleOf(row: EngineRow) {
  for (const role of ["draw", "ramp", "interaction", "tutor"] as const) {
    if (row.signals.roles.has(role)) return role;
  }
  if (row.signals.produces.has("wipe")) return "wipe";
  if (row.land) return "land";
  return null;
}

function manaOnly(facts: OracleFacts) {
  return facts.lines.every((line) => /^(?:\{T\}: )?add /i.test(line) || /^add /i.test(line));
}

/**
 * Immutable Oracle read of the uploaded main deck and sideboard. Nursery is not intent.
 * Every card is read before any edge is drawn. Link is not rewritten by later layers.
 */
export function scaffoldOf(
  read: EngineRead,
  lines: DeckLine[],
  commander?: CachedCard | null,
): { cards: ScaffoldCard[]; intent: string; text: string } {
  const rows = read.rows.filter((r) => r.factors[0] !== "extra copy");
  const factsOf = new Map(rows.map((row) => [row.card.name.toLowerCase(), readOracle(row.card)]));
  const consumedBy = new Map<string, string[]>();
  for (const row of rows) {
    for (const event of row.signals.consumes) {
      const list = consumedBy.get(event) ?? [];
      list.push(row.card.name);
      consumedBy.set(event, list);
    }
  }
  const commanderLegendary = !!commander && /legendary/.test(commander.typeLine.toLowerCase()) && /creature/.test(commander.typeLine.toLowerCase());

  const cards: ScaffoldCard[] = rows.map((row) => {
    const facts = factsOf.get(row.card.name.toLowerCase()) ?? readOracle(row.card);
    const edges: ScaffoldEdge[] = [];
    for (const event of [...row.signals.produces, ...row.signals.implicit]) {
      if (read.commander?.consumes.has(event)) {
        edges.push({ kind: "enables", with: "commander", note: `Oracle makes ${event}, which the commander spends. “${facts.lines[0] ?? ""}”` });
      }
      const users = (consumedBy.get(event) ?? []).filter((name) => name !== row.card.name).slice(0, 2);
      for (const name of users) edges.push({ kind: "enables", with: name, note: `Oracle makes ${event} for ${name}. “${facts.lines[0] ?? ""}”` });
    }
    if (facts.adds.length || row.signals.produces.has("mana.fast")) {
      edges.push({ kind: "enables", with: "deck", note: `Oracle adds mana. “${facts.lines[0] ?? ""}”` });
    }
    if (row.signals.roles.has("tutor") || row.signals.roles.has("draw") || row.signals.roles.has("ramp") || row.signals.roles.has("interaction")) {
      const job = ["tutor", "draw", "ramp", "interaction"].find((role) => row.signals.roles.has(role));
      edges.push({ kind: "enables", with: "deck", note: `Oracle is ${job}. “${facts.lines[0] ?? ""}”` });
    }
    if (facts.fear && commanderLegendary) {
      edges.push({
        kind: "enables",
        with: commander?.name ?? "commander",
        note: `Oracle gives a legendary creature fear. “${facts.lines.find((line) => /fear/i.test(line)) ?? facts.lines[0] ?? ""}”`,
      });
    }
    for (const line of lines) {
      if (line.cards.some((c) => c.toLowerCase() === row.card.name.toLowerCase())) {
        edges.push({
          kind: "line",
          with: line.cards.filter((c) => c.toLowerCase() !== row.card.name.toLowerCase()).join(" + ") || "line",
          note: line.produces.join(", ") || "closed line",
        });
      }
    }
    const role = roleOf(row);
    if (role && role !== "land") {
      const better = rows
        .filter((other) => other !== row && roleOf(other) === role && other.engineScore > row.engineScore + 15)
        .sort((a, b) => b.engineScore - a.engineScore)[0];
      if (better) {
        const otherFacts = factsOf.get(better.card.name.toLowerCase());
        edges.push({
          kind: "redundant",
          with: better.card.name,
          note: `Same ${role} job in the text. This: “${facts.lines[0] ?? ""}”. ${better.card.name}: “${otherFacts?.lines[0] ?? ""}”.`,
        });
      }
    } else if (role === "land") {
      const better = rows.find((other) => {
        if (other === row || !other.land) return false;
        const otherFacts = factsOf.get(other.card.name.toLowerCase());
        if (!otherFacts || !manaOnly(facts) || !manaOnly(otherFacts)) return false;
        const same = facts.adds.length > 0 && facts.adds.every((c) => otherFacts.adds.includes(c));
        return same && facts.entersTapped && !otherFacts.entersTapped;
      });
      if (better) {
        edges.push({
          kind: "redundant",
          with: better.card.name,
          note: `Oracle: this enters tapped and only adds mana. ${better.card.name} adds the same mana and does not enter tapped.`,
        });
      }
    }
    const clash = conflicts(row, read);
    if (clash) edges.push({ kind: "conflicts", with: "commander", note: clash });
    if (!edges.length) edges.push({ kind: "none", with: "", note: "Oracle shares no produce or cost with the other cards in this list" });
    return { name: row.card.name, zone: row.entry.zone, link: row.engineScore, facts, edges };
  });

  if (commander) {
    const facts = readOracle(commander);
    cards.unshift({
      name: commander.name,
      zone: "commander",
      link: 0,
      facts,
      edges: [...(read.commander?.consumes ?? [])].slice(0, 4).map((event) => ({
        kind: "enables" as const,
        with: "deck",
        note: `Commander spends ${event}`,
      })),
    });
  }

  const intent = read.weight || "no repeated trigger";
  const reads = cards.map((card) => {
    const edge = card.edges.find((e) => e.kind !== "none");
    return `- ${card.name} [${card.zone}]: ${oracleLine(card.facts)}${edge ? ` Edge: ${edge.note}` : ""}`;
  });
  const text = [
    "Layer 0, Oracle only. One card at a time. Intake is not in this read.",
    `Intent from those reads: ${intent}.`,
    ...reads,
    "Nursery cards were not read into this layer.",
  ].join("\n");
  return { cards, intent, text };
}

/** A later layer may cut this only if the Oracle read itself left it loose. */
export function cuttableFromScaffold(edges: ScaffoldEdge[]) {
  if (edges.some((edge) => edge.kind === "line")) return false;
  if (edges.some((edge) => edge.kind === "enables" && edge.with !== "deck")) return false;
  if (edges.some((edge) => edge.kind === "conflicts" || edge.kind === "redundant")) return true;
  return edges.every((edge) => edge.kind === "none");
}
export function fitNote(row: Tilted, link: number) {
  const fit = row.score ?? link;
  if (!row.preference || fit === link) return null;
  const dir = fit < link ? "lowered" : "raised";
  return `${row.card.name} link ${link}, fit ${fit} (${dir}: ${row.preference})`;
}
