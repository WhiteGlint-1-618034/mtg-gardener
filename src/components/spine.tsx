import { useState } from "react";
import {
  ArrowRight,
  Eye,
  Flower2,
  Mountain,
  Recycle,
  Scissors,
  ScrollText,
  Sprout,
} from "lucide-react";
import { Hint } from "./hint";
import { MentionText, namesFromDeck } from "./mention-text";
import { Intake } from "./intake";
import { ManaPanel } from "./mana-panel";
import { GAME_CHANGERS, contradictsCuts, countRole, roleTests, trimSwaps } from "@/lib/infer";
import { lookup, mainCount } from "@/lib/categories";
import type { CachedCard, Deck, SpineId } from "@/lib/types";
import { bracketOf, complexityOf, deckSizeRule, themeIntensityOf } from "@/lib/types";
import { useGarden } from "@/lib/store";
import { cn } from "@/lib/utils";

export const TOOLS: { id: SpineId; label: string; icon: typeof Sprout; hint: string }[] = [
  {
    id: "plan",
    label: "Review",
    icon: ScrollText,
    hint: "The roast, then the plan. If the read is wrong, say so in Feedback.",
  },
  {
    id: "trim",
    label: "Trim",
    icon: Scissors,
    hint: "Cuts that shrink the pile. A swap is not a cut. Over 100, the job is getting to 100.",
  },
  {
    id: "grow",
    label: "Grow",
    icon: Sprout,
    hint: "Cards to add that support your plan. Lands live on Mana.",
  },
  {
    id: "soil",
    label: "Mana",
    icon: Mountain,
    hint: "Manabase: land count, curve, sources vs pips, slow lands, basics your searchers can hit.",
  },
  {
    id: "nursery",
    label: "Nursery",
    icon: Flower2,
    hint: "Maybeboard. Ideas that might fit. Not the sideboard, and not in the deck until you promote one.",
  },
  {
    id: "watch",
    label: "Watch",
    icon: Eye,
    hint: "New cards, bans, and Game Changers for this commander.",
  },
];

export function DeckTools({ deck }: { deck: Deck }) {
  const spine = useGarden((s) => s.spine);
  const setSpine = useGarden((s) => s.setSpine);
  const unread = (deck.analysis?.watch.length ?? 0) > 0;
  const offSize = deck.format === "commander" && mainCount(deck.entries) !== 100;

  return (
    <div className="shrink-0">
      <div className="tool-bar">
        <div className="min-w-0 flex-1 pb-2">
          <h2 className="font-display text-xl text-parchment">{deck.name}</h2>
          <p className="text-xs text-mute">
            Commander
            {deck.commanderName ? ` · ${deck.commanderName}` : ""}
            {deck.packet.lanes?.length
              ? ` · ${deck.packet.lanes.join(" / ")}`
              : deck.packet.lane
                ? ` · ${deck.packet.lane}`
                : ""}
            {deck.packet.bracket != null
              ? ` · B${bracketOf(deck.packet.bracket).n} ${bracketOf(deck.packet.bracket).name}`
              : ""}
            {deck.packet.themeIntensity != null
              ? ` · theme ${themeIntensityOf(deck.packet.themeIntensity)}/10`
              : ""}
            {deck.packet.complexity != null ? ` · brain ${complexityOf(deck.packet.complexity)}/10` : ""}
          </p>
        </div>
        <nav className="flex items-stretch">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const on = spine === t.id;
            return (
              <Hint key={t.id} text={t.hint} side="bottom">
                <button
                  type="button"
                  aria-label={`${t.label}. ${t.hint}`}
                  aria-pressed={on}
                  onClick={() => setSpine(on ? null : t.id)}
                  className={cn("tool-tab", on && "is-on", t.id === "trim" && offSize && !on && "is-alert")}
                >
                  <Icon className="size-4" />
                  {t.label}
                  {t.id === "watch" && unread ? <span className="tool-dot" /> : null}
                </button>
              </Hint>
            );
          })}
          <Hint text="Re-open the questionnaire. Change the job, lane, table, or how you pilot it." side="bottom">
            <button
              type="button"
              aria-label="Re-open the questionnaire"
              aria-pressed={spine === "intake"}
              onClick={() => setSpine(spine === "intake" ? null : "intake")}
              className={cn("tool-tab", spine === "intake" && "is-on")}
            >
              <Recycle className="size-4" />
              Again
            </button>
          </Hint>
        </nav>
      </div>
      {spine ? (
        <div className="tool-drop">
          {spine === "plan" ? <ReviewPanel deck={deck} /> : null}
          {spine === "trim" ? <TrimPanel deck={deck} /> : null}
          {spine === "grow" ? <GrowPanel deck={deck} /> : null}
          {spine === "soil" ? <ManaPanel deck={deck} /> : null}
          {spine === "nursery" ? <NurseryPanel deck={deck} /> : null}
          {spine === "watch" ? <WatchPanel deck={deck} /> : null}
          {spine === "intake" ? <Intake deckId={deck.id} compact /> : null}
        </div>
      ) : null}
    </div>
  );
}

function PanelTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="mb-3">
      <h3 className="font-display text-lg text-parchment">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-mute">{hint}</p>
    </header>
  );
}

function CardThumb({ card, name }: { card: CachedCard | undefined; name: string }) {
  const src = card?.image || card?.imageSmall;
  return (
    <div className="card-thumb">
      {src ? <img src={src} alt={name} /> : <span>{name}</span>}
    </div>
  );
}

function ReviewPanel({ deck }: { deck: Deck }) {
  const tend = useGarden((s) => s.tend);
  const renameDeck = useGarden((s) => s.renameDeck);
  const renameShort = useGarden((s) => s.renameShort);
  const patchPacket = useGarden((s) => s.patchPacket);
  const busy = useGarden((s) => s.busy);
  const draw = countRole(deck.entries, deck.cards, roleTests.draw);
  const ramp = countRole(deck.entries, deck.cards, roleTests.ramp);
  const interaction = countRole(deck.entries, deck.cards, roleTests.interaction);
  const tool = TOOLS.find((t) => t.id === "plan")!;
  const feedback = deck.packet.feedback ?? "";
  const answers = deck.packet.answers ?? {};
  const questions = deck.analysis?.questions ?? [];
  const known = namesFromDeck(deck);

  return (
    <div className="space-y-4 text-sm">
      <PanelTitle title="Review" hint={tool.hint} />
      <div className="flex flex-wrap gap-4">
        <label className="block min-w-48 flex-1 space-y-1">
          <span className="text-xs text-mute">Full name</span>
          <input
            value={deck.name}
            onChange={(e) => renameDeck(deck.id, e.target.value)}
            className="w-full rounded-md bg-soil px-2 py-1.5 text-cream outline-none ring-1 ring-filigree/20"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-mute">Tab (5)</span>
          <input
            value={deck.short}
            maxLength={5}
            onChange={(e) => renameShort(deck.id, e.target.value)}
            className="w-24 rounded-md bg-soil px-2 py-1.5 tracking-[0.2em] text-cream outline-none ring-1 ring-filigree/20"
          />
        </label>
      </div>
      {deck.analysis?.scaffold ? (
        <div className="rounded-md bg-soil p-3">
          <p className="text-xs tracking-wide text-filigree">Scaffold</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-cream/85">{deck.analysis.scaffold}</p>
        </div>
      ) : null}
      {deck.analysis?.lines?.length ? (
        <div className="rounded-md bg-soil p-3">
          <p className="text-xs tracking-wide text-filigree">Complete lines</p>
          <ul className="mt-2 space-y-1 text-sm text-cream/90">
            {deck.analysis.lines.slice(0, 6).map((line) => (
              <li key={line.cards.join("|")}>
                {line.cards.join(" + ")}
                {line.produces.length ? ` — ${line.produces.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {deck.analysis?.template ? (
        <p className="text-sm text-cream/80">{deck.analysis.template}</p>
      ) : null}
      {deck.analysis?.diagnosis ? (
        <p className="whitespace-pre-wrap rounded-md bg-soil p-3 leading-relaxed text-cream/90">
          <MentionText text={deck.analysis.diagnosis} known={known} cards={deck.cards} />
        </p>
      ) : (
        <p className="text-mute">Nothing to mock yet. Looking at the pile of garbage you uploaded</p>
      )}
      <p className="text-xs text-mute">
        Draw {draw} · Ramp {ramp} · Interaction {interaction}
        {deck.packet.lanes?.length
          ? ` · ${deck.packet.lanes.join(" / ")}`
          : deck.packet.lane
            ? ` · ${deck.packet.lane}`
            : ""}
        {deck.packet.bracket != null
          ? ` · B${bracketOf(deck.packet.bracket).n} ${bracketOf(deck.packet.bracket).name}`
          : ""}
        {deck.packet.themeIntensity != null
          ? ` · theme ${themeIntensityOf(deck.packet.themeIntensity)}/10`
          : ""}
        {deck.packet.complexity != null ? ` · brain ${complexityOf(deck.packet.complexity)}/10` : ""}
      </p>
      <label className="block space-y-1">
        <span className="text-xs tracking-wide text-filigree">Feedback</span>
        <p className="text-xs text-mute">If the read is wrong, say so. This outranks the last diagnosis.</p>
        <textarea
          value={feedback}
          onChange={(e) => patchPacket(deck.id, { feedback: e.target.value })}
          placeholder="Wrong lane. The commander is a value piece, not the whole plan."
          className="h-24 w-full rounded-md bg-soil px-2 py-1.5 text-sm text-cream outline-none ring-1 ring-filigree/20 placeholder:text-mute"
        />
      </label>
      {questions.length ? (
        <div className="space-y-3">
          <p className="text-xs tracking-wide text-filigree">Questions</p>
          {questions.map((q) => (
            <label key={q} className="block space-y-1">
              <span className="text-xs text-parchment">
                <MentionText text={q} known={known} cards={deck.cards} />
              </span>
              <textarea
                value={answers[q] ?? ""}
                onChange={(e) => patchPacket(deck.id, { answers: { ...answers, [q]: e.target.value } })}
                placeholder="Your answer"
                className="h-16 w-full rounded-md bg-soil px-2 py-1.5 text-sm text-cream outline-none ring-1 ring-filigree/20 placeholder:text-mute"
              />
            </label>
          ))}
        </div>
      ) : null}
      <Hint text="Re-run cuts and adds using your feedback and answers." side="bottom">
        <button
          type="button"
          disabled={!!busy || !deck.entries.length}
          onClick={() => void tend(deck.id)}
          className="rounded-md bg-sap px-3 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          {busy ?? "Look again"}
        </button>
      </Hint>
      {deck.analysis ? (
        <p className="text-xs text-mute">
          {deck.analysis.usedAi ? "Oracle + EDHREC" : "Oracle + EDHREC (no AI this pass)"}
        </p>
      ) : null}
    </div>
  );
}

function TrimPanel({ deck }: { deck: Deck }) {
  const cutCard = useGarden((s) => s.cutCard);
  const toggleLock = useGarden((s) => s.toggleLock);
  const moveToNursery = useGarden((s) => s.moveToNursery);
  const argueKeep = useGarden((s) => s.argueKeep);
  const swapIn99 = useGarden((s) => s.swapIn99);
  const main = new Set(
    deck.entries.filter((e) => e.zone !== "nursery").map((e) => e.name.toLowerCase()),
  );
  const mainTotal = mainCount(deck.entries);
  const items = (deck.analysis?.trim ?? []).filter((v) => main.has(v.name.toLowerCase()));
  const swaps = trimSwaps(deck);
  const cutCopies = items.reduce((n, v) => n + (v.copies ?? 1), 0);
  const known = namesFromDeck(deck);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const tool = TOOLS.find((t) => t.id === "trim")!;

  return (
    <div className="space-y-3 text-sm">
      <PanelTitle title="Trim" hint={tool.hint} />
      {!deck.analysis ? (
        <p className="text-mute">
          Not yet. Matching the names is not a read. Cuts show up after The Gardener has gone through the list.
        </p>
      ) : !items.length ? (
        <p className="text-mute">Nothing to cut. Don't get comfortable.</p>
      ) : null}
      {(() => {
        const rule = deckSizeRule(deck.packet.playFormat);
        if (rule.kind === "minimum") {
          if (mainTotal >= rule.count) return null;
          return (
            <p className="text-xs text-nightshade">
              {mainTotal} cards in the main deck. {rule.count} is the floor, not the ceiling. Short {rule.count - mainTotal}. Fill that before you cut.
            </p>
          );
        }
        if (mainTotal === rule.count) return null;
        return (
          <p className="text-xs text-nightshade">
            {mainTotal} cards in the deck, nursery excluded. This format is {rule.count}.
            {mainTotal > rule.count
              ? deck.analysis
                ? cutCopies >= mainTotal - rule.count
                  ? ` Remove ${mainTotal - rule.count}, least synergistic first. Named combos and the only card feeding the commander are not cuts. A swap does not change the count.`
                  : ` Still ${mainTotal - rule.count} over. ${cutCopies} are actually the weak cards and are listed. The rest score too high to pretend they don't fit.`
                : ` ${mainTotal - rule.count} over. No cuts until the list has been read.`
              : ` Short ${rule.count - mainTotal}. Fill the hole before you sidegrade.`}
          </p>
        );
      })()}
      <div className="tool-cards">
        {items.map((v) => {
          const card = lookup(deck.cards, v.name);
          const swap = swaps.get(v.name);
          const swapCard = swap ? lookup(deck.cards, swap.name) : undefined;
          const saved = deck.packet.defenses?.[v.name] ?? "";
          const draft = drafts[v.name] ?? saved;
          return (
            <article key={v.name} className={cn("tool-card", swap && "has-swap")}>
              <div className="swap-arts">
                <CardThumb card={card} name={v.name} />
                {swap ? (
                  <>
                    <ArrowRight className="swap-arrow" />
                    <CardThumb card={swapCard} name={swap.name} />
                  </>
                ) : null}
              </div>
              <div className="tool-copy">
                <p className={v.kind === "weed" ? "text-nightshade" : "text-filigree"}>
                  {(v.copies ?? 1) > 1 ? `${v.copies}x ` : ""}
                  {v.name}
                  <span className="ml-2 text-xs uppercase tracking-wide">
                    {v.kind === "weed" ? "off-plan" : "check"}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-cream/80">
                  <MentionText text={v.reason} known={known} cards={deck.cards} />
                </p>
                {swap ? (
                  <p className="mt-2 text-xs leading-relaxed text-sap">
                    Swap in {swap.name}
                    <span className="ml-1.5 uppercase tracking-wide text-mute">{swap.role}</span>
                    <span className="mt-1 block text-cream/80">
                      <MentionText text={swap.reason} known={known} cards={deck.cards} />
                    </span>
                  </p>
                ) : mainTotal === 100 ? (
                  <p className="mt-2 text-xs text-mute">No on-plan Grow card for this slot yet. Look again after you restock Grow.</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {swap ? (
                    <Hint text="Cut this from the 99 and put the Grow card in its place." side="bottom">
                      <button
                        type="button"
                        className="chip"
                        data-on="true"
                        onClick={() => void swapIn99(deck.id, v.name, swap.name)}
                      >
                        Swap
                      </button>
                    </Hint>
                  ) : null}
                  <button type="button" className="chip" onClick={() => cutCard(deck.id, v.name, v.copies ?? 1)}>
                    {(v.copies ?? 1) > 1 ? `Cut ${v.copies}` : "Cut"}
                  </button>
                  <Hint text="Move to the maybeboard. Not in the 99 until you promote it." side="bottom">
                    <button type="button" className="chip" onClick={() => moveToNursery(deck.id, v.name)}>
                      Nursery
                    </button>
                  </Hint>
                  <Hint text="Keep this card. Don't suggest cutting it again." side="bottom">
                    <button type="button" className="chip" onClick={() => toggleLock(deck.id, v.name)}>
                      Lock
                    </button>
                  </Hint>
                </div>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs text-mute">Argue why this stays</span>
                  <textarea
                    value={draft}
                    onChange={(e) => setDrafts((cur) => ({ ...cur, [v.name]: e.target.value }))}
                    placeholder="It's a Prime copy / the discard outlet / the only free sac…"
                    className="h-16 w-full rounded-md bg-mulch px-2 py-1.5 text-xs text-cream outline-none ring-1 ring-filigree/20"
                  />
                </label>
                <button
                  type="button"
                  className="chip mt-1.5"
                  data-on={Boolean(saved)}
                  disabled={!draft.trim()}
                  onClick={() => argueKeep(deck.id, v.name, draft)}
                >
                  {saved ? "Update argument" : "Keep — here's why"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function GrowPanel({ deck }: { deck: Deck }) {
  const addCardByName = useGarden((s) => s.addCardByName);
  const toggleNever = useGarden((s) => s.toggleNever);
  const trim = deck.analysis?.trim ?? [];
  const items = (deck.analysis?.grow ?? []).filter((s) => {
    const card = lookup(deck.cards, s.name);
    const t = card?.typeLine.toLowerCase() ?? "";
    if (t.includes("land") && !t.includes("creature")) return false;
    if (!card?.oracleText) return true;
    return !contradictsCuts(card, trim);
  });
  const known = namesFromDeck(deck);
  const tool = TOOLS.find((t) => t.id === "grow")!;
  return (
    <div className="space-y-3 text-sm">
      <PanelTitle title="Grow" hint={tool.hint} />
      {!items.length ? <p className="text-mute">No adds. Either it's tight or The Gardener hasn't looked.</p> : null}
      <div className="tool-cards">
        {items.map((s) => {
          const card = lookup(deck.cards, s.name);
          return (
            <article key={s.name} className="tool-card">
              <CardThumb card={card} name={s.name} />
              <div className="tool-copy">
                <p className="text-sap">{s.name}</p>
                <p className="text-xs uppercase tracking-wide text-mute">{s.role}</p>
                <p className="mt-1 text-xs leading-relaxed text-cream/80">
                  <MentionText text={s.reason} known={known} cards={deck.cards} />
                </p>
                {card?.oracleText ? (
                  <p className="mt-2 line-clamp-3 text-xs text-parchment/80">{card.oracleText}</p>
                ) : (
                  <p className="mt-2 text-xs text-mute">Oracle loads when you add it.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="chip"
                    data-on="true"
                    onClick={() => void addCardByName(deck.id, s.name, "main")}
                  >
                    Add
                  </button>
                  <Hint text="Park it on the maybeboard instead of the 99." side="bottom">
                    <button type="button" className="chip" onClick={() => void addCardByName(deck.id, s.name, "nursery")}>
                      Nursery
                    </button>
                  </Hint>
                  <Hint text="Don't suggest this card for this deck again." side="bottom">
                    <button type="button" className="chip" onClick={() => toggleNever(deck.id, s.name)}>
                      Never
                    </button>
                  </Hint>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function NurseryPanel({ deck }: { deck: Deck }) {
  const promoteFromNursery = useGarden((s) => s.promoteFromNursery);
  const cutCard = useGarden((s) => s.cutCard);
  const setRole = useGarden((s) => s.setRole);
  const rows = deck.entries.filter((e) => e.zone === "nursery");
  const tool = TOOLS.find((t) => t.id === "nursery")!;
  return (
    <div className="space-y-3 text-sm">
      <PanelTitle title="Nursery" hint={tool.hint} />
      {!rows.length ? <p className="text-mute">Empty. Watch and Grow land here first.</p> : null}
      <div className="tool-cards">
        {rows.map((r) => {
          const card = lookup(deck.cards, r.name);
          return (
            <article key={r.name} className="tool-card">
              <CardThumb card={card} name={r.name} />
              <div className="tool-copy">
                <p className="text-parchment">
                  {r.count}x {r.name}
                </p>
                <p className="text-xs text-mute">{card?.typeLine}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Prime", "Ancillary", "Utility", "Hat"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      className="chip"
                      data-on={deck.packet.customRoles[r.name] === role}
                      onClick={() => setRole(deck.id, r.name, deck.packet.customRoles[r.name] === role ? null : role)}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <button type="button" className="chip" data-on="true" onClick={() => promoteFromNursery(deck.id, r.name)}>
                    Promote
                  </button>
                  <button type="button" className="chip" onClick={() => cutCard(deck.id, r.name)}>
                    Drop
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WatchPanel({ deck }: { deck: Deck }) {
  const addCardByName = useGarden((s) => s.addCardByName);
  const gcs = deck.entries.filter((e) => GAME_CHANGERS.has(e.name.toLowerCase()));
  const banned = deck.entries.filter((e) => lookup(deck.cards, e.name)?.legalities.commander === "banned");
  const items = deck.analysis?.watch ?? [];
  const tool = TOOLS.find((t) => t.id === "watch")!;
  return (
    <div className="space-y-3 text-sm">
      <PanelTitle title="Watch" hint={tool.hint} />
      {banned.map((e) => (
        <article key={e.name} className="tool-card">
          <CardThumb card={lookup(deck.cards, e.name)} name={e.name} />
          <p className="text-nightshade">Banned in Commander: {e.name}</p>
        </article>
      ))}
      {gcs.map((e) => (
        <article key={e.name} className="tool-card">
          <CardThumb card={lookup(deck.cards, e.name)} name={e.name} />
          <p className="text-filigree">Game Changer in the list: {e.name}</p>
        </article>
      ))}
      <div className="tool-cards">
        {items.map((w) => (
          <article key={w.id} className="tool-card">
            <CardThumb card={lookup(deck.cards, w.name)} name={w.name} />
            <div className="tool-copy">
              <p className="text-sap">{w.name}</p>
              <p className="text-xs text-mute">{w.note}</p>
              <button type="button" className="chip mt-2" onClick={() => void addCardByName(deck.id, w.name, "nursery")}>
                To nursery
              </button>
            </div>
          </article>
        ))}
      </div>
      {!items.length && !gcs.length && !banned.length ? (
        <p className="text-mute">Quiet. Look from Review to pull new EDHREC cards for this commander.</p>
      ) : null}
    </div>
  );
}
