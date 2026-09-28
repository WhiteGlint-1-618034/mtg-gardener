const STOP = new Set(["the", "of", "a", "and", "to", "in", "for"]);

export function abbreviate(name: string, taken: Set<string>): string {
  const cleaned = name.replace(/[^A-Za-z0-9\s,']/g, " ").trim();
  const parts = cleaned
    .split(/[\s,]+/)
    .map((p) => p.replace(/'/g, ""))
    .filter((p) => p && !STOP.has(p.toLowerCase()));
  const seed = (parts[0] ?? name).replace(/[^A-Za-z0-9]/g, "");
  let base = seed.slice(0, 5).toUpperCase().padEnd(Math.min(5, seed.length), "");
  if (base.length < 2) base = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 5).toUpperCase();
  if (!base) base = "DECK";
  let short = base.slice(0, 5);
  if (!taken.has(short)) return short;
  for (let i = 2; i < 100; i++) {
    const suffix = String(i);
    const next = (base.slice(0, 5 - suffix.length) + suffix).slice(0, 5);
    if (!taken.has(next)) return next;
  }
  return short;
}
