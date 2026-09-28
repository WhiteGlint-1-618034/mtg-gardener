import { useMemo, useState } from "react";
import { CardHover } from "./card-hover";
import { resolveCardNames } from "@/lib/server/mtg";
import type { CachedCard } from "@/lib/types";

const STOP = new Set(
  [
    "How", "What", "When", "Why", "Which", "Who", "Would", "Could", "Should",
    "Does", "Did", "Do", "If", "The", "A", "An", "Your", "You", "Need", "Extra",
    "Last", "This", "That", "Than", "Then", "With", "From", "Into", "Just",
    "Also", "More", "Less", "Often", "Versus", "Simply", "Copying", "Prime",
    "Ditch", "Flying", "Is", "Are", "Or", "And", "For", "To", "Of", "In", "On",
    "It", "Its", "Be", "Can", "We", "They", "Still", "Really", "Only",
  ].map((w) => w.toLowerCase()),
);

type Part = { text: string; cardName: string | null };

function needlesFrom(known: string[]): { needle: string; official: string }[] {
  const firstCount = new Map<string, number>();
  const firstOfficial = new Map<string, string>();
  for (const name of known) {
    const first = name.split(/\s+/)[0] ?? "";
    if (first.length < 4) continue;
    const k = first.toLowerCase();
    firstCount.set(k, (firstCount.get(k) ?? 0) + 1);
    firstOfficial.set(k, name);
  }
  const out: { needle: string; official: string }[] = known.map((name) => ({
    needle: name,
    official: name,
  }));
  for (const [k, n] of firstCount) {
    if (n !== 1) continue;
    const official = firstOfficial.get(k)!;
    if (official.toLowerCase() === k) continue;
    out.push({ needle: official.split(/\s+/)[0]!, official });
  }
  out.sort((a, b) => b.needle.length - a.needle.length);
  return out;
}

export function splitCardMentions(text: string, known: string[]): Part[] {
  const taken = new Array(text.length).fill(false);
  const hits: { start: number; end: number; name: string }[] = [];
  const lower = text.toLowerCase();

  for (const { needle, official } of needlesFrom(known)) {
    const n = needle.toLowerCase();
    let from = 0;
    while (from <= lower.length - n.length) {
      const i = lower.indexOf(n, from);
      if (i < 0) break;
      const end = i + n.length;
      const beforeOk = i === 0 || !/[A-Za-z0-9]/.test(text[i - 1] ?? "");
      const afterOk = end === text.length || !/[A-Za-z0-9]/.test(text[end] ?? "");
      let overlap = false;
      for (let k = i; k < end; k++) if (taken[k]) overlap = true;
      if (beforeOk && afterOk && !overlap) {
        hits.push({ start: i, end, name: official });
        for (let k = i; k < end; k++) taken[k] = true;
      }
      from = i + 1;
    }
  }

  const cap = /\b[A-Z][A-Za-z0-9']+(?:\s+[A-Z][A-Za-z0-9']+)*/g;
  let m: RegExpExecArray | null;
  while ((m = cap.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    if (STOP.has(m[0].toLowerCase())) continue;
    if (start === 0) continue;
    let overlap = false;
    for (let k = start; k < end; k++) if (taken[k]) overlap = true;
    if (overlap) continue;
    hits.push({ start, end, name: m[0] });
    for (let k = start; k < end; k++) taken[k] = true;
  }

  hits.sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) parts.push({ text: text.slice(cursor, h.start), cardName: null });
    parts.push({ text: text.slice(h.start, h.end), cardName: h.name });
    cursor = h.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), cardName: null });
  return parts;
}

const cache: Record<string, CachedCard | null> = {};

function Mention({
  label,
  lookupName,
  cards,
}: {
  label: string;
  lookupName: string;
  cards: Record<string, CachedCard>;
}) {
  const [hover, setHover] = useState<{ card: CachedCard; x: number; y: number } | null>(null);

  async function show(x: number, y: number) {
    const key = lookupName.toLowerCase();
    let card = cards[key] ?? cache[key] ?? undefined;
    if (card === undefined && cache[key] !== null) {
      const { cards: found } = await resolveCardNames({ data: { names: [lookupName] } });
      card = found[key] ?? Object.values(found)[0];
      cache[key] = card ?? null;
    }
    if (card) setHover({ card, x, y });
  }

  return (
    <span
      className="card-mention"
      onMouseEnter={(e) => void show(e.clientX, e.clientY)}
      onMouseMove={(e) => {
        if (hover) setHover({ ...hover, x: e.clientX, y: e.clientY });
      }}
      onMouseLeave={() => setHover(null)}
    >
      {label}
      {hover ? <CardHover card={hover.card} x={hover.x} y={hover.y} /> : null}
    </span>
  );
}

export function MentionText({
  text,
  known,
  cards,
}: {
  text: string;
  known: string[];
  cards: Record<string, CachedCard>;
}) {
  const parts = useMemo(() => splitCardMentions(text, known), [text, known]);
  return (
    <>
      {parts.map((p, i) =>
        p.cardName ? (
          <Mention key={`${p.cardName}-${i}`} label={p.text} lookupName={p.cardName} cards={cards} />
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function namesFromDeck(deck: {
  commanderName: string | null;
  entries: { name: string }[];
  cards: Record<string, CachedCard>;
  analysis: {
    trim: { name: string }[];
    grow: { name: string }[];
    watch: { name: string }[];
  } | null;
}) {
  const n = new Set<string>();
  for (const c of Object.values(deck.cards)) n.add(c.name);
  for (const e of deck.entries) n.add(e.name);
  if (deck.commanderName) n.add(deck.commanderName);
  for (const t of deck.analysis?.trim ?? []) n.add(t.name);
  for (const g of deck.analysis?.grow ?? []) n.add(g.name);
  for (const w of deck.analysis?.watch ?? []) n.add(w.name);
  return [...n];
}
