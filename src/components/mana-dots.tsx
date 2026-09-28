import { cn } from "@/lib/utils";

const COLOR: Record<string, string> = {
  W: "bg-mana-w",
  U: "bg-mana-u",
  B: "bg-mana-b ring-1 ring-filigree/30",
  R: "bg-mana-r",
  G: "bg-mana-g",
};

export function ManaDots({ colors, size = "sm" }: { colors: string[]; size?: "sm" | "md" }) {
  if (!colors.length) {
    return <span className={cn("inline-block rounded-full bg-mute/50", size === "sm" ? "size-1.5" : "size-2")} />;
  }
  return (
    <span className="flex items-center justify-center gap-0.5">
      {colors.map((c) => (
        <span
          key={c}
          title={c}
          className={cn("rounded-full", COLOR[c] ?? "bg-mute", size === "sm" ? "size-1.5" : "size-2")}
        />
      ))}
    </span>
  );
}
