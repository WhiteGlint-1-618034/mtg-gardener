import { ArrowRight } from "lucide-react";
import type { CachedCard } from "@/lib/types";

export function CardHover({
  card,
  swap,
  x,
  y,
}: {
  card: CachedCard;
  swap?: CachedCard | null;
  x: number;
  y: number;
}) {
  const pair = Boolean(swap?.image || swap);
  const width = pair ? 520 : 240;
  const left = Math.min(x + 18, typeof window !== "undefined" ? window.innerWidth - width - 16 : x);
  const top = Math.min(Math.max(12, y - 40), typeof window !== "undefined" ? window.innerHeight - (pair ? 380 : 420) : y);

  if (pair && swap) {
    return (
      <aside className="card-preview" style={{ left, top }}>
        <Face card={card} />
        <ArrowRight className="swap-arrow" />
        <Face card={swap} />
      </aside>
    );
  }

  return (
    <aside className="card-preview card-preview-single" style={{ left, top }}>
      <Face card={card} />
      <div className="space-y-1 p-3">
        <p className="font-display text-sm text-parchment">{card.name}</p>
        <p className="text-xs text-mute">
          {card.manaCost} · {card.typeLine}
        </p>
        <p className="max-h-28 overflow-hidden text-xs leading-snug text-cream/85">
          {card.oracleText || "No Oracle text."}
        </p>
      </div>
    </aside>
  );
}

function Face({ card }: { card: CachedCard }) {
  const src = card.image || card.imageSmall;
  return (
    <div className="card-preview-face">
      {src ? <img src={src} alt={card.name} /> : <span>{card.name}</span>}
    </div>
  );
}
