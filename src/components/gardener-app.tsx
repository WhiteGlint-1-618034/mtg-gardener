import { useEffect } from "react";
import { DeckList } from "./deck-list";
import { DeckTabs } from "./deck-tabs";
import { Intake } from "./intake";
import { DeckTools } from "./spine";
import { useGarden } from "@/lib/store";

export function GardenerApp() {
  const decks = useGarden((s) => s.decks);
  const activeId = useGarden((s) => s.activeId);
  const addEmptyDeck = useGarden((s) => s.addEmptyDeck);
  const busy = useGarden((s) => s.busy);
  const error = useGarden((s) => s.error);

  useEffect(() => {
    void Promise.resolve(useGarden.persist.rehydrate());
  }, []);

  const deck = decks.find((d) => d.id === activeId) ?? decks[0] ?? null;
  const empty = !deck || deck.entries.length === 0;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-soil text-cream">
      <header className="flex shrink-0 items-end gap-6 border-b border-filigree/20 px-4 pt-3">
        <div className="mb-2 shrink-0">
          <p className="font-display text-lg tracking-[0.18em] text-parchment">THE GARDENER</p>
          <p className="text-[10px] tracking-[0.16em] text-mute">COMMANDER DECK TENDER</p>
        </div>
        <DeckTabs />
        {busy ? <p className="mb-2 ml-auto text-xs text-sap">{busy}</p> : null}
        {error && !empty ? <p className="mb-2 ml-auto text-xs text-nightshade">{error}</p> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {empty && deck ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Intake deckId={deck.id} />
          </div>
        ) : null}
        {empty && !deck ? (
          <div className="flex h-full items-center justify-center">
            <button type="button" className="chip" data-on="true" onClick={() => addEmptyDeck()}>
              New deck
            </button>
          </div>
        ) : null}
        {!empty && deck ? (
          <>
            <DeckTools deck={deck} />
            <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
              <DeckList deck={deck} />
            </main>
          </>
        ) : null}
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-filigree/15 px-4 py-1 text-[10px] tracking-wide text-mute">
        <p className="min-w-0 truncate">
          Card data © Wizards of the Coast · Oracle via Scryfall · Commander recs via EDHREC · Fan content, unofficial
        </p>
        <a
          href="https://x.com/_WhiteGlint"
          target="_blank"
          rel="noreferrer"
          title="_WhiteGlint on X"
          className="flex shrink-0 items-center gap-1.5 text-mute hover:text-parchment"
        >
          Created by
          <img
            src="/whiteglint.jpg"
            alt="_WhiteGlint"
            className="size-4 rounded-full outline outline-1 outline-filigree/30"
          />
        </a>
      </footer>
    </div>
  );
}
