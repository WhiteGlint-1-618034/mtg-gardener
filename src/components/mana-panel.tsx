import { useEffect, useMemo, useState } from "react";
import { BarChart3, Shovel, TriangleAlert } from "lucide-react";
import { MentionText, namesFromDeck } from "./mention-text";
import { colorIdentityOf, lookup, mainCount } from "@/lib/categories";
import { analyzeSoil, basicLandTypes, fetchHitsIdentity, fetchOnIdentity, isTrueFetch, landEntersTappedOnList, landLegalInIdentity, readDeckPlan, scoreUtilityLand } from "@/lib/manabase";
import { fetchLandPlants, resolveCardNames } from "@/lib/server/mtg";
import { useGarden } from "@/lib/store";
import type { CachedCard, ColorCount, Deck, LandPlant, SoilReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLS = ["W", "U", "B", "R", "G"] as const;
const COL_NAME: Record<(typeof COLS)[number], string> = {
  W: "White",
  U: "Blue",
  B: "Black",
  R: "Red",
  G: "Green",
};

function Thumb({ card, name }: { card: CachedCard | undefined; name: string }) {
  const src = card?.image || card?.imageSmall;
  return (
    <div className="card-thumb">
      {src ? <img src={src} alt={name} /> : <span>{name}</span>}
    </div>
  );
}

function isPureLand(card: CachedCard | undefined) {
  const t = card?.typeLine.toLowerCase() ?? "";
  return t.includes("land") && !t.includes("creature");
}

function emptyColors(): ColorCount {
  return { W: 0, U: 0, B: 0, R: 0, G: 0 };
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ok" | "warn" | "bad";
}) {
  return (
    <div className={cn("mana-stat", tone === "ok" && "is-ok", tone === "warn" && "is-warn", tone === "bad" && "is-bad")}>
      <p className="mana-stat-val">{value}</p>
      <p className="mana-stat-lab">{label}</p>
      {hint ? <p className="mana-stat-hint">{hint}</p> : null}
    </div>
  );
}

function LandGauge({ soil }: { soil: SoilReport }) {
  const { landCount: n, targetMin: lo, targetMax: hi } = soil;
  const minBound = Math.max(0, Math.min(n, lo) - 4);
  const maxBound = Math.max(n, hi) + 4;
  const span = Math.max(1, maxBound - minBound);
  const pct = (v: number) => ((v - minBound) / span) * 100;
  const left = pct(lo);
  const width = Math.max(2, pct(hi) - pct(lo));
  const mark = pct(n);
  const tone = n < lo ? "bad" : n > hi ? "warn" : "ok";
  return (
    <div className="mana-card">
      <p className="mana-card-title">Land count</p>
      <p className="font-display text-3xl text-parchment">
        {n}
        <span className="ml-2 text-sm text-mute">
          target {lo}–{hi}
        </span>
      </p>
      <div className="mana-gauge">
        <span className="mana-gauge-band" style={{ left: `${left}%`, width: `${width}%` }} />
        <span className={cn("mana-gauge-mark", `is-${tone}`)} style={{ left: `${mark}%` }} />
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-mute">
        <span>{minBound}</span>
        <span>band {lo}–{hi}</span>
        <span>{maxBound}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-cream/85">{soil.rationale}</p>
      {soil.add.length ? <p className="mt-1 text-xs text-sap">{soil.add.join(" · ")}</p> : null}
    </div>
  );
}

function ColorBars({ soil }: { soil: SoilReport }) {
  const sources = soil.sources ?? emptyColors();
  const pips = soil.pips ?? emptyColors();
  const holes = new Set(soil.colorHoles.map((h) => h[0]));
  const peak = Math.max(1, ...COLS.map((c) => Math.max(sources[c], pips[c])));
  const active = COLS.filter((c) => sources[c] > 0 || pips[c] > 0);
  if (!active.length) return null;
  return (
    <div className="mana-card">
      <p className="mana-card-title">Sources vs pips</p>
      <div className="mana-colors">
        {active.map((c) => (
          <div key={c} className={cn("mana-color-row", holes.has(c) && "is-hole")}>
            <span className={cn("mana-pip", `is-${c}`)} title={COL_NAME[c]} />
            <div className="mana-twin">
              <div className="mana-twin-bar">
                <span className={cn("fill src", `is-${c}`)} style={{ width: `${(sources[c] / peak) * 100}%` }} />
              </div>
              <div className="mana-twin-bar">
                <span className="fill pip" style={{ width: `${(pips[c] / peak) * 100}%` }} />
              </div>
            </div>
            <span className="mana-color-n">
              {sources[c]}
              <span className="text-mute"> / {pips[c]}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-mute">Top bar sources · bottom bar pips in costs</p>
      {soil.colorHoles.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-nightshade">
          {soil.colorHoles.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-mute">Colored sources look healthy.</p>
      )}
    </div>
  );
}

function Curve({ soil }: { soil: SoilReport }) {
  const curve = soil.curve?.length ? soil.curve : [0, 0, 0, 0, 0, 0, 0, 0];
  const peak = Math.max(1, ...curve);
  return (
    <div className="mana-card">
      <p className="mana-card-title">Spell curve</p>
      <div className="mana-curve">
        {curve.map((n, i) => (
          <div key={i} className="mana-curve-col">
            <span className="mana-curve-n">{n || ""}</span>
            <div className="mana-curve-track">
              <span className="mana-curve-bar" style={{ height: `${(n / peak) * 100}%` }} />
            </div>
            <span className="mana-curve-lab">{i === 7 ? "7+" : i}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-mute">Non-lands · CMC</p>
    </div>
  );
}

function Mix({ soil }: { soil: SoilReport }) {
  const basics = soil.basics ?? emptyColors();
  const basicTotal = COLS.reduce((n, c) => n + basics[c], 0);
  const duals = soil.duals ?? 0;
  const util = soil.utilityLands ?? 0;
  const other = Math.max(0, soil.landCount - basicTotal - duals - util);
  const parts = [
    { n: basicTotal, label: "Basics", cls: "is-basic" },
    { n: duals, label: "Duals", cls: "is-dual" },
    { n: util, label: "Utility", cls: "is-util" },
    { n: other, label: "Mono / rest", cls: "is-rest" },
  ].filter((p) => p.n > 0);
  const total = Math.max(1, soil.landCount);
  const taps = soil.taplands?.length ?? 0;
  const untapped = soil.untapped ?? Math.max(0, soil.landCount - taps);
  const tapOver = taps > soil.tapBudget;
  return (
    <div className="mana-card">
      <p className="mana-card-title">Land mix</p>
      <div className="mana-stack">
        {parts.map((p) => (
          <span key={p.label} className={cn("mana-stack-seg", p.cls)} style={{ width: `${(p.n / total) * 100}%` }} title={`${p.label} ${p.n}`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute">
        {parts.map((p) => (
          <span key={p.label}>
            <span className={cn("mana-leg", p.cls)} />
            {p.label} {p.n}
          </span>
        ))}
      </div>
      <p className="mana-card-title mt-4">Tap vs untapped</p>
      <div className="mana-stack">
        <span className="mana-stack-seg is-untap" style={{ width: `${(untapped / total) * 100}%` }} />
        <span className={cn("mana-stack-seg is-tap", tapOver && "is-over")} style={{ width: `${(taps / total) * 100}%` }} />
      </div>
      <p className={cn("mt-2 text-xs", tapOver ? "text-nightshade" : "text-mute")}>
        Untapped {untapped} · slow {taps} / budget {soil.tapBudget}
        {soil.fetchCount ? ` · fetches ${soil.fetchCount}` : ""}
      </p>
    </div>
  );
}

function Basics({
  soil,
  known,
  cards,
}: {
  soil: SoilReport;
  known: string[];
  cards: Record<string, CachedCard>;
}) {
  const basics = soil.basics ?? emptyColors();
  const peak = Math.max(1, ...COLS.map((c) => basics[c]));
  return (
    <div className="mana-card">
      <p className="mana-card-title">Basics the tutors can hit</p>
      <div className="mana-basics">
        {COLS.map((c) => (
          <div key={c} className="mana-basic">
            <span className={cn("mana-pip", `is-${c}`)} />
            <div className="mana-twin-bar">
              <span className={cn("fill src", `is-${c}`)} style={{ width: `${(basics[c] / peak) * 100}%` }} />
            </div>
            <span className="mana-color-n">{basics[c]}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-mute">{soil.basicNeed}</p>
      {soil.searchers.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {soil.searchers.map((s) => (
            <li key={s.name}>
              <MentionText text={s.name} known={known} cards={cards} />
              <span className="text-mute"> — {s.needs}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-mute">No land-searchers spotted.</p>
      )}
    </div>
  );
}

export function ManaPanel({ deck }: { deck: Deck }) {
  const soil = analyzeSoil(deck.entries, deck.cards, deck.format);
  const known = namesFromDeck(deck);
  const addCardByName = useGarden((s) => s.addCardByName);
  const cutCard = useGarden((s) => s.cutCard);
  const identity = colorIdentityOf(deck.commanderName, deck.cards, deck.entries);
  const plan = useMemo(
    () => readDeckPlan(deck.entries, deck.cards, deck.packet),
    [deck.entries, deck.cards, deck.packet],
  );
  const landTone = soil.landCount < soil.targetMin ? "bad" : soil.landCount > soil.targetMax ? "warn" : "ok";
  const tapTone = (soil.taplands?.length ?? 0) > soil.tapBudget ? "warn" : "ok";
  const [tab, setTab] = useState<"review" | "fix">("review");
  const [extra, setExtra] = useState<Record<string, CachedCard>>({});
  const [catalog, setCatalog] = useState<LandPlant[]>([]);

  const localPlants = soil.plants ?? [];
  const growLands = useMemo(() => {
    return (deck.analysis?.grow ?? [])
      .filter((g) => {
        const c = lookup({ ...deck.cards, ...extra }, g.name);
        if (!isPureLand(c)) return false;
        if (c && deck.format === "commander" && !landLegalInIdentity(c, identity)) return false;
        return true;
      })
      .map((g) => ({ name: g.name, count: 1, reason: g.reason, kind: "dual" as const }));
  }, [deck.analysis?.grow, deck.cards, extra, identity, deck.format]);

  const plants = useMemo(() => {
    const seen = new Set<string>();
    const out: LandPlant[] = [];
    for (const p of [...localPlants, ...catalog, ...growLands]) {
      const k = p.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
    return out;
  }, [localPlants, catalog, growLands]);

  const inDeck = useMemo(
    () => deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name),
    [deck.entries],
  );

  const plantKey = plants.map((p) => p.name).join("|");

  useEffect(() => {
    let live = true;
    const need = plants.map((p) => p.name).filter((n) => !lookup(deck.cards, n));
    if (!need.length) return () => {
      live = false;
    };
    void resolveCardNames({ data: { names: need } }).then((r) => {
      if (live) setExtra((prev) => ({ ...prev, ...r.cards }));
    });
    return () => {
      live = false;
    };
  }, [plantKey, deck.id]);

  const gap = Math.max(0, soil.targetMin - soil.landCount);

  useEffect(() => {
    let live = true;
    void fetchLandPlants({ data: { identity, exclude: inDeck } }).then(async (r) => {
      if (!live) return;
      const names = r.items.map((i) => i.name);
      const resolved = names.length ? await resolveCardNames({ data: { names } }) : { cards: {} as Record<string, CachedCard> };
      if (!live) return;
      const byHeader = new Map(r.items.map((i) => [i.name.toLowerCase(), i]));
      const cedh = deck.packet.table === "cedh" || deck.packet.bracket === 5;
      const landfall = plan.landfall >= 4;
      const allowOffFetch = cedh || landfall;
      const scored = r.items
        .map((item) => {
          const c = resolved.cards[item.name.toLowerCase()];
          if (!c) return null;
          if (deck.format === "commander" && !landLegalInIdentity(c, identity)) return null;
          if (!fetchHitsIdentity(c, identity)) return null;
          const prod = (c.producedMana ?? []).filter((x) => "WUBRG".includes(x));
          if (prod.length && identity.length && prod.every((col) => !identity.includes(col))) return null;
          const fetch = isTrueFetch(c);
          const onFetch = fetch && fetchOnIdentity(c, identity);
          const offFetch = fetch && !onFetch;
          if (offFetch && !allowOffFetch) return null;
          const typed = basicLandTypes(c);
          const slow = landEntersTappedOnList(
            c,
            deck.entries,
            { ...deck.cards, [c.name.toLowerCase()]: c },
            deck.format,
          );
          const cols = (c.producedMana.length ? c.producedMana : c.colorIdentity).filter((x) => "WUBRG".includes(x));
          const hole = cols.some(
            (col) =>
              identity.includes(col) &&
              (soil.pips as ColorCount)[col as keyof ColorCount] >= 6 &&
              (soil.sources as ColorCount)[col as keyof ColorCount] < 6,
          );
          const util = item.bucket === "utility" ? scoreUtilityLand(c, plan) : null;
          if (item.bucket === "utility" && !util) return null;
          let score = 0;
          if (onFetch) score += 62;
          else if (offFetch) score += landfall ? 48 : 36;
          if (typed.length && !fetch) score += 12 + typed.length * 10;
          if (item.bucket === "fast" && !fetch) score += typed.length ? 28 : 10;
          if (item.bucket === "utility" && util) score += util.score;
          if (item.bucket === "rainbow") {
            const extra = cols.filter((col) => !identity.includes(col));
            if (extra.length && cols.some((col) => identity.includes(col))) score += 12;
            else if (!cols.length) score += 20;
            else score += 8;
          }
          if (!slow) score += 18;
          if (hole) score += 20;
          return { c, item, slow, fetch, onFetch, offFetch, typed, hole, score, util };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => b.score - a.score);

      const wantFast = gap > 0 ? Math.min(16, Math.max(gap, 6)) : 3;
      const picked: typeof scored = [];
      let fastN = 0;
      let utilN = 0;
      for (const row of scored) {
        const isUtil = row.item.bucket === "utility";
        if (isUtil) {
          if (utilN >= 6) continue;
          utilN += 1;
        } else {
          if (fastN >= wantFast) continue;
          fastN += 1;
        }
        picked.push(row);
        if (picked.length >= 18) break;
      }

      setCatalog(
        picked.map(({ c, item, slow, fetch, onFetch, offFetch, typed, hole, util }) => {
          const header = byHeader.get(c.name.toLowerCase())?.header ?? item.header;
          const kind: LandPlant["kind"] = item.bucket === "utility" ? "utility" : fetch ? "fetch" : "dual";
          let reason = `${header}.`;
          if (util) reason = `${header}. ${util.reason}`;
          else if (onFetch) reason = `${header}. On-identity fetch — only searches types you actually play. Hits typed duals and Farseek/Nature's Lore targets.`;
          else if (offFetch && landfall) reason = `${header}. Off-pair fetch. Landfall wants the extra trigger; it still finds a type in ${identity.join("/")}.`;
          else if (offFetch && cedh) reason = `${header}. Off-pair fetch. cEDH density — still hits ${identity.join("/")}.`;
          else if (typed.length) reason = `${header}. Typed (${typed.join("/")}). Searchable by fetches and nonbasic land tutors.`;
          else if (hole && !slow) reason = `${header}. Fast, patches a color hole. No basic types — fetches won't see it.`;
          else if (!slow) reason = `${header}. Untapped here. No basic types, so it's a worse fetch target.`;
          else reason = `${header}. On-identity, but it taps.`;
          return { name: c.name, count: 1, kind, reason };
        }),
      );
      setExtra((prev) => ({ ...prev, ...resolved.cards }));
    });
    return () => {
      live = false;
    };
  }, [deck.id, identity.join(""), inDeck.join("|"), gap, deck.format, plan.mill, plan.landfall, plan.voltron, deck.packet.table, deck.packet.bracket]);

  const cards = { ...deck.cards, ...extra };
  const adds = plants.filter((p) => p.kind !== "cut");
  const pulls = plants.filter((p) => p.kind === "cut");
  const offSize = deck.format === "commander" && mainCount(deck.entries) !== 100;

  return (
    <div className="mana-panel text-sm">
      <div className="mana-stick">
        <div className="mana-stick-head">
          <h3 className="font-display text-lg text-parchment">Mana</h3>
          <p className="mana-stick-copy">
            {tab === "review"
              ? "Diagnosis — count, curve, holes, rocks."
              : "Plant list — fast duals first, utilities that fit the plan, basics only if a searcher needs them."}
          </p>
          {offSize ? (
            <p className="deck-size-warn">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
              This deck is not complete, mana evaluation may be skewed.
            </p>
          ) : null}
        </div>
        <div className="mana-tabs" role="tablist" aria-label="Mana sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "review"}
            className={cn("mana-tab", tab === "review" && "is-on")}
            onClick={() => setTab("review")}
          >
            <BarChart3 className="size-4" />
            Review
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "fix"}
            className={cn("mana-tab", tab === "fix" && "is-on")}
            onClick={() => setTab("fix")}
          >
            <Shovel className="size-4" />
            Fixing
          </button>
        </div>
      </div>

      {tab === "review" ? (
        <>
      <div className="mana-stats">
        <Stat label="Lands" value={soil.landCount} hint={`${soil.targetMin}–${soil.targetMax}`} tone={landTone} />
        <Stat label="Rocks" value={soil.rocks ?? 0} hint="CMC ≤ 3 artifacts" />
        <Stat label="Dorks" value={soil.dorks ?? 0} hint="CMC ≤ 2 creatures" />
        <Stat label="Land ramp" value={soil.landRamp ?? 0} hint="Ramp spells" />
        <Stat
          label="Slow lands"
          value={`${soil.taplands?.length ?? 0}/${soil.tapBudget}`}
          hint="Always tapped on this list"
          tone={tapTone}
        />
        <Stat
          label="Hardcast 5+"
          value={soil.highCmc ?? 0}
          hint={
            soil.cheatHigh
              ? `${soil.cheatHigh} cheated / reduced / cycled`
              : "Printed 5+ you actually pay for"
          }
        />
      </div>

      <div className="mana-grid">
        <LandGauge soil={soil} />
        <ColorBars soil={soil} />
        <Curve soil={soil} />
        <Mix soil={soil} />
        <Basics soil={soil} known={known} cards={deck.cards} />
        <div className="mana-card">
          <p className="mana-card-title">Rocks & dorks</p>
          {soil.rockNames?.length ? (
            <p className="text-xs leading-relaxed">
              <span className="text-mute">Rocks — </span>
              <MentionText text={soil.rockNames.join(", ")} known={known} cards={deck.cards} />
            </p>
          ) : (
            <p className="text-xs text-mute">No cheap rocks.</p>
          )}
          {soil.dorkNames?.length ? (
            <p className="mt-2 text-xs leading-relaxed">
              <span className="text-mute">Dorks — </span>
              <MentionText text={soil.dorkNames.join(", ")} known={known} cards={deck.cards} />
            </p>
          ) : (
            <p className="mt-2 text-xs text-mute">No dorks.</p>
          )}
          {soil.taplands?.length ? (
            <p className="mt-2 text-xs leading-relaxed">
              <span className="text-mute">Always tapped — </span>
              <MentionText text={soil.taplands.join(", ")} known={known} cards={deck.cards} />
            </p>
          ) : (
            <p className="mt-2 text-xs text-mute">No always-tapped lands.</p>
          )}
        </div>
      </div>
        </>
      ) : adds.length || pulls.length ? (
        <div className="mana-plants">
          <p className="mana-card-title">Fixing</p>
          <p className="mb-3 text-xs text-mute">
            Fast multicolor from EDHREC for this identity. Basics only if a searcher or fetch needs them. Boseiju / Strip Mine / Tower class utilities get a seat even when the count is fine.
          </p>
          <div className="tool-cards">
            {adds.map((p) => {
              const card = lookup(cards, p.name);
              return (
                <article key={`add-${p.name}`} className="tool-card">
                  <Thumb card={card} name={p.name} />
                  <div className="tool-copy">
                    <p className="text-sap">
                      {p.count}x {p.name}
                      <span className="ml-2 text-xs uppercase tracking-wide text-mute">{p.kind}</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-cream/80">{p.reason}</p>
                    {card?.oracleText ? (
                      <p className="mt-2 line-clamp-3 text-xs text-parchment/80">{card.oracleText}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="chip"
                        data-on="true"
                        onClick={() => void addCardByName(deck.id, p.name, "main", p.count)}
                      >
                        Add {p.count}x
                      </button>
                      <button type="button" className="chip" onClick={() => void addCardByName(deck.id, p.name, "nursery", p.count)}>
                        Nursery
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {pulls.map((p) => {
              const card = lookup(cards, p.name);
              return (
                <article key={`cut-${p.name}`} className="tool-card">
                  <Thumb card={card} name={p.name} />
                  <div className="tool-copy">
                    <p className="text-nightshade">
                      Pull {p.name}
                      <span className="ml-2 text-xs uppercase tracking-wide text-mute">cut</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-cream/80">{p.reason}</p>
                    <button type="button" className="chip mt-2" onClick={() => cutCard(deck.id, p.name)}>
                      Cut
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-mute">Nothing to plant. Count is in range and the obvious utilities are already in.</p>
      )}
    </div>
  );
}
