import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { CardHover } from "./card-hover";
import { groupedEntries, lookup } from "@/lib/categories";
import { trimSwaps } from "@/lib/infer";
import type { CachedCard, Deck, DeckEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const COL_GAP = 24;

function packColumns<T>(items: T[], colCount: number): T[][] {
  const n = items.length;
  if (!n) return [];
  const cols = Math.max(1, Math.min(colCount, n));
  const base = Math.floor(n / cols);
  const extra = n % cols;
  const out: T[][] = [];
  let i = 0;
  for (let c = 0; c < cols; c++) {
    const size = base + (c < extra ? 1 : 0);
    out.push(items.slice(i, i + size));
    i += size;
  }
  return out;
}

export function DeckList({ deck }: { deck: Deck }) {
  const [hover, setHover] = useState<{ card: CachedCard; swap?: CachedCard; x: number; y: number } | null>(null);
  const groups = useMemo(() => groupedEntries(deck.entries, deck.cards), [deck.entries, deck.cards]);
  const weeds = new Set((deck.analysis?.trim ?? []).map((t) => t.name.toLowerCase()));
  const locked = new Set(deck.packet.lockedNames.map((n) => n.toLowerCase()));
  const swaps = useMemo(() => trimSwaps(deck), [deck]);

  const longest = useMemo(() => {
    let name = "";
    let count = 1;
    for (const e of deck.entries) {
      if (e.name.length > name.length) {
        name = e.name;
        count = e.count;
      }
    }
    return { name, count };
  }, [deck.entries]);

  const probeRef = useRef<HTMLSpanElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const [colPx, setColPx] = useState(220);
  const [colCount, setColCount] = useState(1);

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const measure = () => {
      const w = probe.getBoundingClientRect().width;
      if (w > 0) setColPx(Math.ceil(w) + 8);
    };
    measure();
    void document.fonts.ready.then(measure);
  }, [longest.name, longest.count]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const cs = getComputedStyle(el);
      const inner =
        el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const next = Math.max(1, Math.floor((inner + COL_GAP) / (colPx + COL_GAP)));
      setColCount(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [colPx]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <span
        ref={probeRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex items-baseline gap-2 whitespace-nowrap px-1 text-sm"
      >
        <span className="w-6 tabular-nums">{longest.count}x</span>
        <span>{longest.name || "Card Name"}</span>
      </span>
      <div
        ref={areaRef}
        className="deck-list"
        style={{ ["--name-col" as string]: `${colPx}px` }}
      >
        {deck.unresolved.length ? (
          <p className="mb-4 text-xs text-nightshade">
            Unresolved (not a real card name): {deck.unresolved.join(", ")}
          </p>
        ) : null}
        {groups.map((g) => {
          const rows = g.rows;
          if (!rows.length) return null;
          const columns = packColumns(rows, colCount);
          return (
            <section key={g.category} className="deck-bed">
              <h3 className="deck-bed-title">
                {g.category.toUpperCase()} ({g.count})
              </h3>
              <div className="deck-cols">
                {columns.map((col, i) => (
                  <ul key={i}>
                    {col.map((row) => (
                      <CardLine
                        key={`${row.zone}-${row.name}`}
                        row={row}
                        card={lookup(deck.cards, row.name)}
                        weed={weeds.has(row.name.toLowerCase())}
                        swap={swaps.has(row.name)}
                        locked={locked.has(row.name.toLowerCase())}
                        role={deck.packet.customRoles[row.name]}
                        onHover={(card, x, y) => {
                          const rec = swaps.get(row.name);
                          const swap = rec ? lookup(deck.cards, rec.name) : undefined;
                          setHover({ card, swap, x, y });
                        }}
                        onLeave={() => setHover(null)}
                      />
                    ))}
                  </ul>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {hover ? <CardHover card={hover.card} swap={hover.swap} x={hover.x} y={hover.y} /> : null}
    </div>
  );
}

function CardLine({
  row,
  card,
  weed,
  swap,
  locked,
  role,
  onHover,
  onLeave,
}: {
  row: DeckEntry;
  card: CachedCard | undefined;
  weed: boolean;
  swap: boolean;
  locked: boolean;
  role: string | undefined;
  onHover: (card: CachedCard, x: number, y: number) => void;
  onLeave: () => void;
}) {
  return (
    <li>
      <div
        onMouseEnter={(e) => {
          if (card) onHover(card, e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (card) onHover(card, e.clientX, e.clientY);
        }}
        onMouseLeave={onLeave}
        className={cn(
          "flex w-full items-baseline gap-2 rounded-sm px-1 py-0.5 text-left text-sm",
          swap && "deck-swap",
          weed && !swap && "deck-weed",
          locked && !weed && !swap && "text-filigree",
          !weed && !swap && !locked && "text-cream",
        )}
      >
        <span className="w-6 shrink-0 tabular-nums text-mute">{row.count}x</span>
        <span className="min-w-0">
          {row.name}
          {role ? <span className="ml-1.5 text-xs tracking-wide text-sap">{role}</span> : null}
        </span>
      </div>
    </li>
  );
}
