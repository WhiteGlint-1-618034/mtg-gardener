import { create } from "zustand";
import { persist } from "zustand/middleware";
import { abbreviate } from "./abbreviate";
import { colorIdentityOf, detectCommander, lookup, mainCount } from "./categories";
import { structureBrief } from "./infer";
import { analyzeSoil } from "./manabase";
import { parseDeckList, uniqueNames } from "./parse-deck";
import { fetchCommanderMeta, resolveCardNames, tendDeck } from "./server/mtg";
import { EMPTY_PACKET, budgetCapOf, engineOf, type Analysis, type Deck, type SeedPacket, type SpineId } from "./types";
import { uid } from "./utils";

const STARTER_ID = "plot-1";

function normalizeAnalysis(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Analysis> & { data?: Partial<Analysis> };
  const a = Array.isArray(r.grow) || typeof r.diagnosis === "string" ? r : r.data;
  if (!a || typeof a !== "object") return null;
  return {
    diagnosis: a.diagnosis ?? "",
    laneGuess: a.laneGuess ?? [],
    trim: a.trim ?? [],
    grow: a.grow ?? [],
    watch: a.watch ?? [],
    questions: a.questions ?? [],
    lines: a.lines ?? [],
    template: a.template ?? "",
    scaffold: a.scaffold ?? "",
    generatedAt: a.generatedAt ?? Date.now(),
    usedAi: a.usedAi ?? false,
  };
}

function starterDeck(): Deck {
  return {
    id: STARTER_ID,
    name: "New deck",
    short: "NEW",
    createdAt: 0,
    rawList: "",
    entries: [],
    cards: {},
    unresolved: [],
    packet: { ...EMPTY_PACKET },
    analysis: null,
    soil: null,
    commanderName: null,
    format: "commander",
  };
}

type GardenState = {
  decks: Deck[];
  activeId: string | null;
  spine: SpineId | null;
  busy: string | null;
  error: string | null;
  setSpine: (id: SpineId | null) => void;
  setActive: (id: string) => void;
  addEmptyDeck: () => string;
  removeDeck: (id: string) => void;
  renameShort: (id: string, short: string) => void;
  renameDeck: (id: string, name: string) => void;
  patchPacket: (id: string, patch: Partial<SeedPacket>) => void;
  toggleLock: (id: string, name: string) => void;
  toggleNever: (id: string, name: string) => void;
  argueKeep: (id: string, name: string, reason: string) => void;
  setRole: (id: string, name: string, role: string | null) => void;
  moveToNursery: (id: string, name: string) => void;
  promoteFromNursery: (id: string, name: string) => void;
  cutCard: (id: string, name: string, copies?: number) => void;
  swapIn99: (id: string, cutName: string, addName: string) => Promise<void>;
  addCardByName: (id: string, name: string, zone?: "main" | "nursery", copies?: number) => Promise<void>;
  importList: (id: string, raw: string, packet: Partial<SeedPacket>) => Promise<void>;
  tend: (id: string) => Promise<void>;
};

function takenShorts(decks: Deck[], except?: string) {
  return new Set(decks.filter((d) => d.id !== except).map((d) => d.short));
}

export const useGarden = create<GardenState>()(
  persist(
    (set, get) => ({
      decks: [starterDeck()],
      activeId: STARTER_ID,
      spine: null,
      busy: null,
      error: null,
      setSpine: (spine) => set({ spine }),
      setActive: (id) => set({ activeId: id, error: null }),
      addEmptyDeck: () => {
        const id = uid();
        const short = abbreviate("NEW", takenShorts(get().decks));
        const deck: Deck = {
          id,
          name: "New deck",
          short,
          createdAt: Date.now(),
          rawList: "",
          entries: [],
          cards: {},
          unresolved: [],
          packet: { ...EMPTY_PACKET },
          analysis: null,
          soil: null,
          commanderName: null,
          format: "commander",
        };
        set((s) => ({ decks: [...s.decks, deck], activeId: id, spine: null }));
        return id;
      },
      removeDeck: (id) =>
        set((s) => {
          const decks = s.decks.filter((d) => d.id !== id);
          return { decks, activeId: s.activeId === id ? (decks[0]?.id ?? null) : s.activeId };
        }),
      renameShort: (id, short) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === id ? { ...d, short: short.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase() || d.short } : d,
          ),
        })),
      renameDeck: (id, name) =>
        set((s) => ({
          decks: s.decks.map((d) => (d.id === id ? { ...d, name } : d)),
        })),
      patchPacket: (id, patch) =>
        set((s) => ({
          decks: s.decks.map((d) => (d.id === id ? { ...d, packet: { ...d.packet, ...patch } } : d)),
        })),
      toggleLock: (id, name) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const has = d.packet.lockedNames.some((n) => n.toLowerCase() === name.toLowerCase());
            return {
              ...d,
              packet: {
                ...d.packet,
                lockedNames: has
                  ? d.packet.lockedNames.filter((n) => n.toLowerCase() !== name.toLowerCase())
                  : [...d.packet.lockedNames, name],
              },
            };
          }),
        })),
      argueKeep: (id, name, reason) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const locked = d.packet.lockedNames.some((n) => n.toLowerCase() === name.toLowerCase())
              ? d.packet.lockedNames
              : [...d.packet.lockedNames, name];
            return {
              ...d,
              packet: {
                ...d.packet,
                lockedNames: locked,
                defenses: { ...(d.packet.defenses ?? {}), [name]: reason.trim() },
              },
            };
          }),
        })),
      toggleNever: (id, name) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const has = d.packet.neverNames.some((n) => n.toLowerCase() === name.toLowerCase());
            return {
              ...d,
              packet: {
                ...d.packet,
                neverNames: has
                  ? d.packet.neverNames.filter((n) => n.toLowerCase() !== name.toLowerCase())
                  : [...d.packet.neverNames, name],
              },
            };
          }),
        })),
      setRole: (id, name, role) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const customRoles = { ...d.packet.customRoles };
            if (!role) delete customRoles[name];
            else customRoles[name] = role;
            return { ...d, packet: { ...d.packet, customRoles } };
          }),
        })),
      moveToNursery: (id, name) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            return {
              ...d,
              entries: d.entries.map((e) =>
                e.name.toLowerCase() === name.toLowerCase() && e.zone !== "commander" ? { ...e, zone: "nursery" as const } : e,
              ),
            };
          }),
        })),
      promoteFromNursery: (id, name) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            return {
              ...d,
              entries: d.entries.map((e) =>
                e.name.toLowerCase() === name.toLowerCase() && e.zone === "nursery" ? { ...e, zone: "main" as const } : e,
              ),
            };
          }),
        })),
      cutCard: (id, name, copies) =>
        set((s) => ({
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const drop = copies == null ? Number.POSITIVE_INFINITY : Math.max(1, copies);
            const entries = d.entries.flatMap((e) => {
              if (e.name.toLowerCase() !== name.toLowerCase() || e.zone === "nursery") return [e];
              const next = e.count - drop;
              return next > 0 ? [{ ...e, count: next }] : [];
            });
            return { ...d, entries, soil: analyzeSoil(entries, d.cards, d.format) };
          }),
        })),
      swapIn99: async (id, cutName, addName) => {
        const { cards } = await resolveCardNames({ data: { names: [addName] } });
        const card = Object.values(cards)[0];
        if (!card) {
          set({ error: `Not in the written corpus: ${addName}` });
          return;
        }
        set((s) => ({
          error: null,
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const without = d.entries.filter(
              (e) =>
                e.zone === "nursery" ||
                e.zone === "commander" ||
                e.name.toLowerCase() !== cutName.toLowerCase(),
            );
            const exists = without.find(
              (e) => e.name.toLowerCase() === card.name.toLowerCase() && e.zone === "main",
            );
            const entries = exists
              ? without
              : [...without, { count: 1, name: card.name, zone: "main" as const }];
            return {
              ...d,
              entries,
              cards: { ...d.cards, [card.name.toLowerCase()]: card },
              analysis: d.analysis
                ? {
                    ...d.analysis,
                    trim: d.analysis.trim.filter((t) => t.name.toLowerCase() !== cutName.toLowerCase()),
                    grow: d.analysis.grow.filter((g) => g.name.toLowerCase() !== card.name.toLowerCase()),
                  }
                : d.analysis,
            };
          }),
        }));
      },
      addCardByName: async (id, name, zone = "nursery", copies = 1) => {
        const { cards } = await resolveCardNames({ data: { names: [name] } });
        const card = Object.values(cards)[0];
        if (!card) {
          set({ error: `Not in the written corpus: ${name}` });
          return;
        }
        const add = Math.max(1, copies);
        set((s) => ({
          error: null,
          decks: s.decks.map((d) => {
            if (d.id !== id) return d;
            const exists = d.entries.find((e) => e.name.toLowerCase() === card.name.toLowerCase() && e.zone === zone);
            const nextCards = { ...d.cards, [card.name.toLowerCase()]: card };
            const entries = exists
              ? d.entries.map((e) => (e === exists ? { ...e, count: e.count + add } : e))
              : [...d.entries, { count: add, name: card.name, zone }];
            return { ...d, entries, cards: nextCards, soil: analyzeSoil(entries, nextCards, d.format) };
          }),
        }));
      },
      importList: async (id, raw, packet) => {
        set({ busy: "Resolving Oracle text…", error: null });
        try {
          const entries = parseDeckList(raw);
          if (!entries.length) {
            set({ busy: null, error: "No card lines found. Use 1x Name, or section headers like Creature." });
            return;
          }
          const { cards, unresolved } = await resolveCardNames({ data: { names: uniqueNames(entries) } });
          const commanderName = detectCommander(entries, cards);
          const playFormat = packet.playFormat ?? "commander";
          const format = engineOf(playFormat);
          const soil = analyzeSoil(entries, cards, format);
          const name = commanderName ?? entries[0]?.name ?? "Untitled";
          set((s) => {
            const short = abbreviate(name, takenShorts(s.decks, id));
            return {
              busy: null,
              spine: packet.job === "soil" ? "soil" : "plan",
              decks: s.decks.map((d) =>
                d.id === id
                  ? {
                      ...d,
                      name,
                      short,
                      rawList: raw,
                      entries,
                      cards,
                      unresolved,
                      commanderName,
                      format,
                      soil,
                      analysis: null,
                      packet: {
                        ...d.packet,
                        ...packet,
                        playFormat,
                        lanes: packet.lanes ?? [],
                        lane: packet.lanes?.[0] ?? packet.lane ?? null,
                        commanderJobs: packet.commanderJobs ?? d.packet.commanderJobs ?? [],
                        commanderJob: packet.commanderJobs?.[0] ?? packet.commanderJob ?? null,
                      },
                    }
                  : d,
              ),
            };
          });
        } catch (err) {
          set({ busy: null, error: err instanceof Error ? err.message : "Could not resolve that list" });
        }
      },
      tend: async (id) => {
        const deck = get().decks.find((d) => d.id === id);
        if (!deck || !deck.entries.length) return;
        set({ busy: "Reading Oracle…", error: null });
        try {
          let candidates: { name: string; synergy?: number; kind: "high" | "top" | "new" }[] = [];
          if (deck.commanderName) {
            const meta = await fetchCommanderMeta({ data: { commander: deck.commanderName } });
            if (meta.ok) {
              candidates = [
                ...meta.high.map((c) => ({ name: c.name, synergy: c.synergy, kind: "high" as const })),
                ...meta.top.map((c) => ({ name: c.name, synergy: c.synergy, kind: "top" as const })),
                ...meta.fresh.map((c) => ({ name: c.name, synergy: c.synergy, kind: "new" as const })),
              ];
            }
          }
          const seenCand = new Set<string>();
          const candNames = candidates
            .map((c) => c.name)
            .filter((n) => {
              const k = n.toLowerCase();
              if (seenCand.has(k)) return false;
              seenCand.add(k);
              return true;
            })
            .slice(0, 60);
          let candCards: Record<string, import("./types").CachedCard> = {};
          if (candNames.length) {
            const resolved = await resolveCardNames({ data: { names: candNames } });
            candCards = resolved.cards;
          }
          const richCands = candidates
            .map((c) => {
              const card = candCards[c.name.toLowerCase()];
              if (!card?.oracleText) return null;
              return {
                ...c,
                name: card.name,
                typeLine: card.typeLine,
                oracleText: card.oracleText,
                cmc: card.cmc,
                manaCost: card.manaCost,
                keywords: card.keywords,
                usd: card.usd,
              };
            })
            .filter((c): c is NonNullable<typeof c> => !!c);
          const names = deck.entries.map((e) => {
            const c = lookup(deck.cards, e.name);
            return {
              name: e.name,
              count: e.count,
              typeLine: c?.typeLine ?? "",
              oracleText: c?.oracleText ?? "",
              cmc: c?.cmc ?? 0,
              manaCost: c?.manaCost ?? "",
              zone: e.zone,
              usd: c?.usd ?? null,
              keywords: c?.keywords ?? [],
              colorIdentity: c?.colorIdentity ?? [],
              producedMana: c?.producedMana ?? [],
              power: c?.power ?? null,
              toughness: c?.toughness ?? null,
              legalities: c?.legalities ?? {},
              oracleId: c?.oracleId ?? "",
            };
          });
          set({ busy: "Looking at the list…" });
          const soilNow = analyzeSoil(deck.entries, deck.cards, deck.format);
          const raw = await tendDeck({
            data: {
              commander: deck.commanderName,
              format: deck.format,
              packet: deck.packet,
              names,
              inDeck: uniqueNames(deck.entries),
              candidates: richCands,
              scan: structureBrief(deck.commanderName, deck.format, deck.entries, deck.cards),
              soil: {
                landCount: soilNow.landCount,
                targetMin: soilNow.targetMin,
                targetMax: soilNow.targetMax,
                taplands: soilNow.taplands ?? [],
                tapBudget: soilNow.tapBudget,
                basicNeed: soilNow.basicNeed ?? "",
                colorHoles: soilNow.colorHoles ?? [],
                rationale: soilNow.rationale ?? "",
                highCmc: soilNow.highCmc,
                cheatHigh: soilNow.cheatHigh,
              },
              deckSize: mainCount(deck.entries),
            },
          });
          const analysis = normalizeAnalysis(raw);
          if (!analysis) {
            set({ busy: null, error: "Look failed — no review came back." });
            return;
          }
          const extraNames = [
            ...(analysis.grow ?? []).map((g) => g.name),
            ...(analysis.watch ?? []).map((w) => w.name),
          ];
          const missing = extraNames.filter((n) => !lookup({ ...deck.cards, ...candCards }, n));
          let extraCards: Record<string, import("./types").CachedCard> = { ...candCards };
          if (missing.length) {
            const resolved = await resolveCardNames({ data: { names: missing } });
            extraCards = resolved.cards;
          }
          const cap = budgetCapOf(deck.packet);
          if (cap != null && analysis.grow) {
            analysis.grow = analysis.grow.filter((g) => {
              const card = lookup({ ...deck.cards, ...extraCards }, g.name);
              return card?.usd == null || card.usd <= cap;
            });
          }
          set((s) => ({
            busy: null,
            spine: deck.packet.job === "soil" ? "soil" : "plan",
            decks: s.decks.map((d) =>
              d.id === id
                ? {
                    ...d,
                    cards: { ...d.cards, ...extraCards },
                    analysis,
                    soil: analyzeSoil(d.entries, { ...d.cards, ...extraCards }, d.format),
                  }
                : d,
            ),
          }));
        } catch (err) {
          set({ busy: null, error: err instanceof Error ? err.message : "Tend failed" });
        }
      },
    }),
    {
      name: "the-gardener-v1",
      partialize: (s) => ({ decks: s.decks, activeId: s.activeId, spine: s.spine }),
      skipHydration: true,
    },
  ),
);

export function activeDeck() {
  const { decks, activeId } = useGarden.getState();
  return decks.find((d) => d.id === activeId) ?? null;
}

export function identityFor(deck: Deck) {
  return colorIdentityOf(deck.commanderName, deck.cards, deck.entries);
}

export type { Fence, Job, Lane, Table } from "./types";
