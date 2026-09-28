import { useRef, useState } from "react";
import { Hint } from "./hint";
import {
  BRACKETS,
  COMMANDER_JOBS,
  FAILINGS,
  FENCES,
  JOBS,
  LANES,
  PLAY_FORMATS,
  bracketFromTable,
  bracketOf,
  commanderJobsOf,
  complexityHint,
  complexityOf,
  complexityTick,
  lanesOf,
  splitCardNames,
  themeIntensityHint,
  themeIntensityOf,
  themeTick,
  toggleIn,
  type Bracket,
  type CommanderJob,
  type Failing,
  type Fence,
  type Job,
  type Lane,
  type PlayFormat,
} from "@/lib/types";
import { useGarden } from "@/lib/store";
import { cn } from "@/lib/utils";

function QBed({
  title,
  hint,
  children,
  flush,
  optional,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  flush?: boolean;
  optional?: boolean;
}) {
  return (
    <section className="q-bed">
      <div className="q-bed-title">
        <div className="q-inner q-bed-title-row">
          <span>{title}</span>
          {optional ? <span className="q-opt">optional</span> : null}
        </div>
      </div>
      <div className={cn("q-bed-body", flush && "q-bed-body-flush")}>
        <div className="q-inner">
          {hint ? <p className="mb-2 text-xs text-mute">{hint}</p> : null}
          {children}
        </div>
      </div>
    </section>
  );
}

function SlideMarks({
  min,
  max,
  value,
  marks,
  lit,
  onPick,
  onClear,
}: {
  min: number;
  max: number;
  value: number;
  marks: { n: number; label: string }[];
  lit?: boolean;
  onPick?: (n: number) => void;
  onClear?: () => void;
}) {
  const down = useRef({ value, lit: Boolean(lit) });
  const span = max - min;
  return (
    <div className="slide-marks">
      {marks.map((m) => {
        const pct = span === 0 ? 0 : ((m.n - min) / span) * 100;
        const edge = m.n === min ? "is-min" : m.n === max ? "is-max" : "";
        const on = Boolean(lit) && m.n === value;
        const cls = cn("slide-mark", edge, on && "is-on");
        const style = { left: `${pct}%` };
        if (onPick) {
          return (
            <button
              key={m.n}
              type="button"
              className={cls}
              style={style}
              onMouseDown={() => {
                down.current = { value, lit: Boolean(lit) };
              }}
              onClick={(e) => {
                if (e.detail > 1) return;
                onPick(m.n);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onClear && down.current.lit && down.current.value === m.n) onClear();
              }}
            >
              {m.label}
            </button>
          );
        }
        return (
          <span key={m.n} className={cls} style={style}>
            {m.label}
          </span>
        );
      })}
    </div>
  );
}

export function Intake({ deckId, compact }: { deckId: string; compact?: boolean }) {
  const importList = useGarden((s) => s.importList);
  const tend = useGarden((s) => s.tend);
  const busy = useGarden((s) => s.busy);
  const error = useGarden((s) => s.error);
  const existing = useGarden((s) => s.decks.find((d) => d.id === deckId));
  const [raw, setRaw] = useState(compact ? existing?.rawList ?? "" : "");
  const [playFormat, setPlayFormat] = useState<PlayFormat>(existing?.packet.playFormat ?? "commander");
  const [job, setJob] = useState<Job | null>(
    compact
      ? existing?.packet.job && existing.packet.job !== "soil"
        ? existing.packet.job
        : "diagnose"
      : "diagnose",
  );
  const [lanes, setLanes] = useState<Lane[]>(compact ? lanesOf(existing?.packet ?? {}) : []);
  const [bracket, setBracket] = useState<Bracket>(
    compact ? (existing?.packet.bracket ?? bracketFromTable(existing?.packet.table)) : 3,
  );
  const [bracketOn, setBracketOn] = useState(compact ? existing?.packet.bracket != null : false);
  const [themeIntensity, setThemeIntensity] = useState(
    compact ? themeIntensityOf(existing?.packet.themeIntensity) : 5,
  );
  const [themeOn, setThemeOn] = useState(compact ? existing?.packet.themeIntensity != null : false);
  const [complexity, setComplexity] = useState(compact ? complexityOf(existing?.packet.complexity) : 5);
  const [complexityOn, setComplexityOn] = useState(compact ? existing?.packet.complexity != null : false);
  const [budgetInput, setBudgetInput] = useState(
    compact && existing?.packet.job === "budget" && existing.packet.budget
      ? String(existing.packet.budget)
      : "",
  );
  const [fences, setFences] = useState<Fence[]>(compact ? existing?.packet.fences ?? [] : []);
  const [notes, setNotes] = useState(compact ? existing?.packet.driveNotes ?? "" : "");
  const [commanderJobs, setCommanderJobs] = useState<CommanderJob[]>(
    compact ? commanderJobsOf(existing?.packet ?? {}) : [],
  );
  const [engines, setEngines] = useState(compact ? existing?.packet.engines ?? "" : "");
  const [payoffs, setPayoffs] = useState(compact ? existing?.packet.payoffs ?? "" : "");
  const [glue, setGlue] = useState(compact ? existing?.packet.glue ?? "" : "");
  const [failings, setFailings] = useState<Failing[]>(compact ? existing?.packet.failings ?? [] : []);
  const [failedNote, setFailedNote] = useState(compact ? existing?.packet.failedNote ?? "" : "");
  const [petCards, setPetCards] = useState(compact ? existing?.packet.petCards ?? "" : "");
  const goal = bracketOf(bracket);

  async function submit() {
    const pets = splitCardNames(petCards);
    const roles = { ...(existing?.packet.customRoles ?? {}) };
    for (const n of splitCardNames(engines)) roles[n] = "Engine";
    for (const n of splitCardNames(payoffs)) roles[n] = "Payoff";
    for (const n of splitCardNames(glue)) roles[n] = "Glue";
    await importList(deckId, raw, {
      playFormat,
      job,
      lane: lanes[0] ?? null,
      lanes,
      bracket: bracketOn ? bracket : null,
      themeIntensity: themeOn ? themeIntensity : null,
      complexity: complexityOn ? complexity : null,
      budget:
        job === "budget"
          ? Number(budgetInput) > 0
            ? Math.round(Number(budgetInput))
            : 20
          : (existing?.packet.budget ?? null),
      table: bracketOn ? goal.table : (existing?.packet.table ?? "hold"),
      fences,
      driveNotes: notes,
      commanderJob: commanderJobs[0] ?? null,
      commanderJobs,
      engines,
      payoffs,
      glue,
      failings,
      failedNote,
      petCards,
      customRoles: roles,
      lockedNames: [...new Set([...(existing?.packet.lockedNames ?? []), ...pets])],
    });
    const deck = useGarden.getState().decks.find((d) => d.id === deckId);
    if (deck?.entries.length && job !== "soil") await tend(deckId);
  }

  const field =
    "w-full rounded-md bg-soil px-3 py-2 text-sm text-cream outline-none ring-1 ring-filigree/25 placeholder:text-mute/70 focus:ring-sap/60";

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-6", compact ? "py-1" : "py-8")}>
      <header className="q-inner space-y-2">
        <p className="font-display text-xs tracking-[0.22em] text-filigree">
          {compact ? "RESTEER THIS LIST" : "NEW COMMANDER DECK"}
        </p>
        <p className="max-w-xl text-sm leading-relaxed text-mute">
          {compact
            ? "Change the assignment, how it wins, the bracket, or the drive notes. Look again when you're ready. Everything below the list is optional."
            : "Paste a list. Pick the format first. Diagnose is the default — skip the rest and let The Gardener guess. If you already know how it pilots, write that. It outranks the packets."}
        </p>
      </header>

      <div className={cn("q-stack", compact && "-mx-4")}>
        <QBed title="Format" hint="What the list is supposed to be legal in.">
          <select
            value={playFormat}
            onChange={(e) => setPlayFormat(e.target.value as PlayFormat)}
            className={cn(field, "cursor-pointer")}
          >
            {PLAY_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </QBed>

        <QBed title="Decklist">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"Commander\n1x Your Commander\n\nCreature\n1x Sol Ring\n..."}
            className={cn(field, "resize-y font-sans", compact ? "h-28" : "h-52")}
          />
        </QBed>

        <QBed title="What's the job?" hint="Diagnose is the default. Change it if you want cuts.">
          <div className="seed-grid">
            {JOBS.map((j) => (
              <button
                key={j.id}
                type="button"
                className={cn(
                  "seed-pack",
                  job === j.id && "is-on",
                  j.id === "budget" && job === "budget" && "seed-pack-wide",
                )}
                onClick={() => setJob(j.id)}
              >
                <span className="seed-name">{j.label}</span>
                <span className="seed-sub">{j.hint}</span>
                {j.id === "budget" && job === "budget" ? (
                  <label
                    className="seed-budget"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <span>$</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="decimal"
                      placeholder="20"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      aria-label="Budget in US dollars"
                    />
                    <span>Blank keeps $20. Over that, it walks.</span>
                  </label>
                ) : null}
              </button>
            ))}
          </div>
        </QBed>

        <QBed title="How it wins" hint="Pick any that apply." optional>
          <div className="seed-grid">
            {LANES.map((l) => (
              <button
                key={l.id}
                type="button"
                className={cn("seed-pack", lanes.includes(l.id) && "is-on")}
                onClick={() => {
                  if (l.id === "none") {
                    setLanes((cur) => (cur.includes("none") ? [] : ["none"]));
                    return;
                  }
                  setLanes((cur) => toggleIn(
                    cur.filter((x) => x !== "none"),
                    l.id,
                  ));
                }}
              >
                <span className="seed-name">{l.label}</span>
                <span className="seed-sub">{l.hint}</span>
              </button>
            ))}
            <button
              type="button"
              className={cn("seed-pack", lanes.length === 0 && "is-on")}
              onClick={() => setLanes([])}
            >
              <span className="seed-name">You tell me</span>
              <span className="seed-sub">No lane yet. The Gardener will guess from the list.</span>
            </button>
          </div>
        </QBed>

        <QBed title="Commander's job" hint="Pick any that apply." optional>
          <div className="seed-grid">
            {COMMANDER_JOBS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn("seed-pack", commanderJobs.includes(c.id) && "is-on")}
                onClick={() => setCommanderJobs((cur) => toggleIn(cur, c.id))}
              >
                <span className="seed-name">{c.label}</span>
                <span className="seed-sub">{c.hint}</span>
              </button>
            ))}
          </div>
        </QBed>

        <QBed title="What actually failed" flush optional>
          <div className="tog-list">
            {FAILINGS.map((f) => {
              const on = failings.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={cn("tog-row", on && "is-on")}
                  onClick={() =>
                    setFailings((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))
                  }
                >
                  <span className="tog-pip" />
                  <span className="tog-name">{f.label}</span>
                  <span className="tog-hint">{f.hint}</span>
                </button>
              );
            })}
          </div>
          <div className="q-bed-pad">
            <input
              value={failedNote}
              onChange={(e) => setFailedNote(e.target.value)}
              placeholder="Anything else the table keeps doing to you"
              className={field}
            />
          </div>
        </QBed>

        <QBed title="Goal bracket" optional>
          <p className="font-display text-lg text-parchment">
            {goal.n} · {goal.name}
            {!bracketOn ? <span className="ml-2 text-xs font-sans tracking-normal text-mute">off</span> : null}
          </p>
          <p className="mb-1 text-xs leading-relaxed text-mute">{goal.hint}</p>
          <div className={cn("slide-wrap", !bracketOn && "is-off")}>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={bracket}
              aria-label="Commander bracket"
              onChange={(e) => {
                setBracketOn(true);
                setBracket(Number(e.target.value) as Bracket);
              }}
              onDoubleClick={() => setBracketOn(false)}
              className="bracket-slide"
            />
            <SlideMarks
              min={1}
              max={5}
              value={bracket}
              lit={bracketOn}
              onPick={(n) => {
                setBracketOn(true);
                setBracket(n as Bracket);
              }}
              onClear={() => setBracketOn(false)}
              marks={BRACKETS.map((b) => ({ n: b.n, label: b.short }))}
            />
          </div>
        </QBed>

        <QBed title="Theme tightness" optional>
          <p className="font-display text-lg text-parchment">
            {themeIntensity} · {themeTick(themeIntensity).label}
            {!themeOn ? <span className="ml-2 text-xs font-sans tracking-normal text-mute">off</span> : null}
          </p>
          <p className="mb-1 text-xs leading-relaxed text-mute">{themeIntensityHint(themeIntensity)}</p>
          <div className={cn("slide-wrap", !themeOn && "is-off")}>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={themeIntensity}
              aria-label="Theme tightness"
              onChange={(e) => {
                setThemeOn(true);
                setThemeIntensity(Number(e.target.value));
              }}
              onDoubleClick={() => setThemeOn(false)}
              className="bracket-slide"
            />
            <SlideMarks
              min={0}
              max={10}
              value={themeIntensity}
              lit={themeOn}
              onPick={(n) => {
                setThemeOn(true);
                setThemeIntensity(n);
              }}
              onClear={() => setThemeOn(false)}
              marks={[
                { n: 0, label: "0 rorschach" },
                { n: 5, label: "5 prefer" },
                { n: 10, label: "10 cult" },
              ]}
            />
          </div>
        </QBed>

        <QBed title="Complexity" optional>
          <p className="font-display text-lg text-parchment">
            {complexity} · {complexityTick(complexity).label}
            {!complexityOn ? <span className="ml-2 text-xs font-sans tracking-normal text-mute">off</span> : null}
          </p>
          <p className="mb-1 text-xs leading-relaxed text-mute">{complexityHint(complexity)}</p>
          <div className={cn("slide-wrap", !complexityOn && "is-off")}>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={complexity}
              aria-label="Complexity"
              onChange={(e) => {
                setComplexityOn(true);
                setComplexity(Number(e.target.value));
              }}
              onDoubleClick={() => setComplexityOn(false)}
              className="bracket-slide"
            />
            <SlideMarks
              min={0}
              max={10}
              value={complexity}
              lit={complexityOn}
              onPick={(n) => {
                setComplexityOn(true);
                setComplexity(n);
              }}
              onClear={() => setComplexityOn(false)}
              marks={[
                { n: 0, label: "0 smooth" },
                { n: 5, label: "5 normal" },
                { n: 10, label: "10 homework" },
              ]}
            />
          </div>
        </QBed>

        <QBed title="Don't add" flush optional>
          <div className="tog-list">
            {FENCES.map((f) => {
              const on = fences.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={cn("tog-row", on && "is-on")}
                  onClick={() =>
                    setFences((cur) => (cur.includes(f.id) ? cur.filter((x) => x !== f.id) : [...cur, f.id]))
                  }
                >
                  <span className="tog-pip" />
                  <span className="tog-name">{f.label}</span>
                  <span className="tog-hint">{f.hint}</span>
                </button>
              );
            })}
          </div>
        </QBed>

        <QBed title="Never cut" hint="Pet cards. Locked before the roast." optional>
          <input
            value={petCards}
            onChange={(e) => setPetCards(e.target.value)}
            placeholder="Sol Ring, Command Tower, your jank legend"
            className={field}
          />
        </QBed>

        <QBed title="Engine / payoff / glue" hint="A few names each. This is how you actually drive it." optional>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-mute">Engine</span>
              <textarea
                value={engines}
                onChange={(e) => setEngines(e.target.value)}
                placeholder="Rhystic Study, your draw piece"
                className={cn(field, "h-20 resize-y")}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-mute">Payoff</span>
              <textarea
                value={payoffs}
                onChange={(e) => setPayoffs(e.target.value)}
                placeholder="Craterhoof, your finisher"
                className={cn(field, "h-20 resize-y")}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-mute">Glue</span>
              <textarea
                value={glue}
                onChange={(e) => setGlue(e.target.value)}
                placeholder="Entomb, Survival of the Fittest"
                className={cn(field, "h-20 resize-y")}
              />
            </label>
          </div>
        </QBed>

        <QBed title="How do you pilot it?" hint="Optional. How it actually wins, what you copy, what you never do." optional>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="I win by copying a 15-power Mime on turn 6–8. Prime copies, ancillary fuel, wheels not mill, never copy Dreadnought…"
            className={cn(field, "h-28 resize-y")}
          />
        </QBed>
      </div>

      {error ? <p className="q-inner text-sm text-nightshade">{error}</p> : null}

      <div className="look-bar">
        <div className="q-inner">
          <Hint text="Resolve the list against Oracle, then suggest cuts and adds for Commander." side="top">
            <button
              type="button"
              disabled={!raw.trim() || !!busy}
              onClick={() => void submit()}
              className={cn(
                "rounded-md bg-sap px-5 py-2.5 text-sm font-medium text-ink",
                "hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              {busy ?? "Look at this list"}
            </button>
          </Hint>
        </div>
      </div>
    </div>
  );
}
