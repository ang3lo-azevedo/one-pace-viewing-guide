#!/usr/bin/env python3
"""Star ratings of films and specials straight from IMDb (src/data/data.json).

Episodes made of anime episodes get their star from SeriesGraph (fetch_ratings.py), which
averages the IMDb ratings of those episodes. Films and specials are single IMDb titles, so
their star is that title's IMDb rating, read from IMDb's public daily dataset
(https://datasets.imdbws.com/title.ratings.tsv.gz). The IMDb id comes from the Trakt movie
mapping (fetch_trakt_ratings.py, run first). Sections made only of such entries get the mean.

If IMDb cannot be reached the existing data is left untouched.

Usage:  python3 -I scripts/fetch_imdb_ratings.py
"""
import gzip
import io
import json
import os
import sys
import urllib.request
from decimal import ROUND_HALF_UP, Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
URL = "https://datasets.imdbws.com/title.ratings.tsv.gz"

# Same tiers as fetch_ratings.py / data.json meta.tiers.
TIERS = [(9.7, "#1DA1F2"), (9.0, "#186A3B"), (8.0, "#28B463"), (7.0, "#F4D03F"), (0.0, "#F39C12")]


def tier_color(value):
    return next(color for lo, color in TIERS if value >= lo)


def round1(value):
    return float(Decimal(value).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    wanted = {
        e["traktMovie"]["imdb"]
        for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]
        if (e.get("traktMovie") or {}).get("imdb")
    }
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "one-pace-guide/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = gzip.GzipFile(fileobj=io.BytesIO(resp.read()))
        ratings = {}
        for line in io.TextIOWrapper(raw, encoding="utf-8"):
            tconst, _, rest = line.partition("\t")
            if tconst in wanted:
                avg, votes = rest.strip().split("\t")
                ratings[tconst] = (float(avg), int(votes))
    except Exception as exc:
        print(f"IMDb ratings skipped (could not reach IMDb): {exc}", file=sys.stderr)
        sys.exit(0)

    changed = []
    for s in data["sagas"]:
        for n in s["nodes"]:
            node_vals, all_imdb = [], True
            for g in n["groups"]:
                for e in g["episodes"]:
                    hit = ratings.get((e.get("traktMovie") or {}).get("imdb"))
                    if e.get("fanEdit"):  # a fan edit is not the official film: no rating of its own
                        e["rating"] = e["tierColor"] = None
                        e.pop("imdbVotes", None)
                        hit = None
                    if not hit:
                        all_imdb = False
                        continue
                    new = round1(hit[0])
                    if e.get("rating") != new:
                        changed.append(f"{e['title'][:40]}: {e.get('rating')} -> {new}")
                    e["rating"], e["tierColor"], e["imdbVotes"] = new, tier_color(new), hit[1]
                    node_vals.append(new)
            # Film and special sections: the star is their entry's IMDb rating.
            if node_vals and all_imdb:
                n["rating"] = round1(sum(Decimal(str(v)) for v in node_vals) / len(node_vals))
            elif all(e.get("fanEdit") for g in n["groups"] for e in g["episodes"]):
                n["rating"] = None
                for g in n["groups"]:
                    g["rating"] = None

    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"IMDb: {len(ratings)} films/specials rated, {len(changed)} changed")
    for c in changed:
        print("  ", c)


if __name__ == "__main__":
    main()
