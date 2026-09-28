"""Build the local catalog from Scryfall oracle, Scryfall rulings, and Commander Spellbook.

Sources (downloaded into data/catalog/raw):
  oracle-cards.jsonl.gz  https://api.scryfall.com/bulk-data
  rulings.jsonl.gz
  variants.json.gz       https://json.commanderspellbook.com/variants.json.gz
"""

import gzip
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data" / "catalog"
RAW = ROOT / "raw"
OUT = ROOT / "built"
OUT.mkdir(parents=True, exist_ok=True)

SKIP_LAYOUT = {"token", "emblem", "art_series", "double_faced_token", "planar"}
RULING_HINT = ("battlefield", "graveyard", "exile", "copy", "power", "toughness", "zone", "stack", "commander", "dies", "enters")


def oracle_text(card: dict) -> str:
    if card.get("oracle_text"):
        return card["oracle_text"]
    faces = card.get("card_faces") or []
    return "\n//\n".join(f.get("oracle_text") or "" for f in faces if f.get("oracle_text"))


def ingest_cards() -> dict[str, str]:
    name_to_id: dict[str, str] = {}
    n = 0
    path = OUT / "cards.jsonl"
    with gzip.open(RAW / "oracle-cards.jsonl.gz", "rt") as src, path.open("w") as dst:
        for line in src:
            card = json.loads(line)
            if card.get("layout") in SKIP_LAYOUT:
                continue
            legal = (card.get("legalities") or {}).get("commander")
            if legal not in ("legal", "banned"):
                continue
            text = oracle_text(card)
            if not text and "Land" not in (card.get("type_line") or ""):
                continue
            rec = {
                "id": card.get("oracle_id"),
                "n": card["name"],
                "t": card.get("type_line") or "",
                "o": text,
                "ci": card.get("color_identity") or [],
                "cmc": card.get("cmc") or 0,
                "mc": card.get("mana_cost") or "",
                "kw": card.get("keywords") or [],
                "pw": card.get("power"),
                "tu": card.get("toughness"),
                "leg": legal,
                "rel": card.get("released_at"),
                "prod": card.get("produced_mana") or [],
            }
            dst.write(json.dumps(rec, ensure_ascii=False) + "\n")
            name_to_id[card["name"].lower()] = card.get("oracle_id") or ""
            n += 1
    print(f"cards {n}")
    return name_to_id


def ingest_rulings() -> None:
    buckets: dict[str, list[tuple[int, str]]] = defaultdict(list)
    with gzip.open(RAW / "rulings.jsonl.gz", "rt") as src:
        for line in src:
            row = json.loads(line)
            oid = row.get("oracle_id")
            comment = (row.get("comment") or "").strip()
            if not oid or not comment:
                continue
            low = comment.lower()
            rank = 0 if any(h in low for h in RULING_HINT) else 1
            buckets[oid].append((rank, comment))
    kept = 0
    with (OUT / "rulings.jsonl").open("w") as dst:
        for oid, rows in buckets.items():
            rows.sort(key=lambda r: r[0])
            comments = []
            for _, comment in rows:
                if comment in comments:
                    continue
                comments.append(comment)
                if len(comments) == 4:
                    break
            dst.write(json.dumps({"id": oid, "c": comments}, ensure_ascii=False) + "\n")
            kept += 1
    print(f"rulings {kept}")


def iter_variants():
    dec = json.JSONDecoder()
    with gzip.open(RAW / "variants.json.gz", "rt") as src:
        buf = ""
        while '"variants"' not in buf:
            chunk = src.read(1 << 20)
            if not chunk:
                return
            buf += chunk
        buf = buf[buf.find("[", buf.find('"variants"')) + 1 :]
        while True:
            buf = buf.lstrip()
            if buf.startswith(","):
                buf = buf[1:]
                continue
            if buf.startswith("]"):
                return
            if not buf.startswith("{"):
                chunk = src.read(1 << 20)
                if not chunk:
                    return
                buf += chunk
                continue
            try:
                obj, idx = dec.raw_decode(buf)
            except json.JSONDecodeError:
                chunk = src.read(1 << 20)
                if not chunk:
                    return
                buf += chunk
                continue
            yield obj
            buf = buf[idx:]


def ingest_lines() -> None:
    seen: set[tuple[str, ...]] = set()
    n = 0
    with (OUT / "lines.jsonl").open("w") as dst:
        for variant in iter_variants():
            if variant.get("status") != "OK" or variant.get("spoiler"):
                continue
            if not (variant.get("legalities") or {}).get("commander"):
                continue
            uses = variant.get("uses") or []
            if not 2 <= len(uses) <= 3:
                continue
            cards = [u["card"]["name"] for u in uses if u.get("card", {}).get("name")]
            if len(cards) != len(uses):
                continue
            commanders = [u["card"]["name"] for u in uses if u.get("mustBeCommander")]
            key = tuple(sorted(c.lower() for c in cards))
            if key in seen:
                continue
            seen.add(key)
            produces = []
            for item in variant.get("produces") or []:
                name = ((item.get("feature") or {}).get("name")) or ""
                if name and name not in produces:
                    produces.append(name)
            rec = {"cards": cards, "produces": produces[:4]}
            if len(commanders) == 1:
                rec["commander"] = commanders[0]
            dst.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
            if n % 20000 == 0:
                print(f"lines {n}")
    print(f"lines {n}")


if __name__ == "__main__":
    ingest_cards()
    ingest_rulings()
    ingest_lines()
