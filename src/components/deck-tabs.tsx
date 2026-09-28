import { Plus, X } from "lucide-react";
import { Hint } from "./hint";
import { ManaDots } from "./mana-dots";
import { identityFor, useGarden } from "@/lib/store";
import { cn } from "@/lib/utils";

export function DeckTabs() {
  const decks = useGarden((s) => s.decks);
  const activeId = useGarden((s) => s.activeId);
  const setActive = useGarden((s) => s.setActive);
  const addEmptyDeck = useGarden((s) => s.addEmptyDeck);
  const removeDeck = useGarden((s) => s.removeDeck);

  return (
    <div className="flex min-w-0 items-end gap-1">
      <div className="tabs-strip flex min-w-0 items-end gap-1">
        {decks.map((deck) => {
          const on = deck.id === activeId;
          const colors = identityFor(deck);
          return (
            <div key={deck.id} className="group relative">
              <button
                type="button"
                title={deck.name}
                onClick={() => setActive(deck.id)}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-1 rounded-t-md px-3 pb-2 pt-2",
                  on ? "bg-bark text-cream" : "text-mute hover:text-cream",
                )}
              >
                <span className={cn("font-sans text-xs font-medium tracking-[0.18em]", on && "text-sap")}>
                  {deck.short}
                </span>
                <ManaDots colors={colors} />
                {on ? <span className="absolute inset-x-3 bottom-0 h-px bg-sap" /> : null}
              </button>
              {decks.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove ${deck.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDeck(deck.id);
                  }}
                  className="absolute -right-1 top-0 hidden rounded-full bg-loam p-0.5 text-mute hover:text-nightshade group-hover:block"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <Hint text="Add another Commander deck." side="bottom">
        <button
          type="button"
          aria-label="Add a Commander deck"
          onClick={() => addEmptyDeck()}
          className="mb-1 flex h-9 w-8 items-center justify-center rounded-md border border-sap/40 text-sap hover:bg-sap hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </Hint>
    </div>
  );
}
