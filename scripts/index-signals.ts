import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { parseCard } from "../src/lib/engine/parse.ts";
import type { CachedCard } from "../src/lib/types.ts";

const src = "/workspace/data/catalog/built/cards.jsonl";
const dst = createWriteStream("/workspace/data/catalog/built/cards.sig.jsonl");

const rl = createInterface({ input: createReadStream(src), crlfDelay: Infinity });
let n = 0;
for await (const line of rl) {
  const row = JSON.parse(line) as {
    id: string;
    n: string;
    t: string;
    o: string;
    ci: string[];
    cmc: number;
    mc: string;
    kw: string[];
    pw: string | null;
    tu: string | null;
    leg: "legal" | "banned";
    rel: string | null;
    prod: string[];
  };
  const card: CachedCard = {
    oracleId: row.id,
    name: row.n,
    typeLine: row.t,
    oracleText: row.o,
    manaCost: row.mc,
    cmc: row.cmc,
    colors: row.ci,
    colorIdentity: row.ci,
    producedMana: row.prod,
    keywords: row.kw,
    power: row.pw,
    toughness: row.tu,
    legalities: { commander: row.leg },
    image: null,
    imageBack: null,
    releasedAt: row.rel,
    usd: null,
  };
  const signals = parseCard(card);
  dst.write(
    JSON.stringify({
      ...row,
      p: [...signals.produces],
      c: [...signals.consumes],
      i: [...signals.implicit],
      r: [...signals.roles],
      ty: [...signals.types],
    }) + "\n",
  );
  n += 1;
  if (n % 5000 === 0) console.log(n);
}
dst.end();
console.log("indexed", n);
