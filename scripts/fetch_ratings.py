#!/usr/bin/env python3
"""Refresh episode ratings in src/data/data.json directly from SeriesGraph.

SeriesGraph (https://seriesgraph.com/show/37854-one-piece) exposes per-anime-episode
IMDb ratings and IMDb ids via its JSON API; the rating itself is then read straight from IMDb's
daily dataset (SeriesGraph's copy lags a few votes), falling back to SeriesGraph's. Each One Pace entry records the anime episode(s) it adapts
(the `anime` field, e.g. "234-235" or "250-251, 256, 320"), so a rating is the mean of
the SeriesGraph IMDb rating of those anime episodes, rounded to one decimal. An anime episode
split across N releases counts 1/N in each. Arc and saga ratings are the mean of their canon
episodes weighted by length.

Entries whose `anime` field has no numeric anime episodes (Movies, OVAs, Specials, Live
Action, text-only entries) are left untouched. Arc (node) and saga ratings are recomputed
as the mean of their canon-route episode ratings so the whole tree stays consistent.

Usage:  python3 -I scripts/fetch_ratings.py
        python3 -I scripts/fetch_ratings.py --cache /tmp/sr.json   # use a saved API dump

Run with -I so a stray module in the CWD can't shadow the standard library.
"""
import argparse
import gzip
import json
import os
import re
import sys
import urllib.request
from decimal import ROUND_HALF_UP, Decimal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
SHOW_ID = 37854
API_URL = f"https://seriesgraph.com/api/shows/{SHOW_ID}/season-ratings"
LIVE_ACTION_API = "https://seriesgraph.com/api/shows/111110/season-ratings"
IMDB_URL = "https://datasets.imdbws.com/title.ratings.tsv.gz"

# Keep tiers in sync with data.json meta.tiers / src/types.ts.
TIERS = [
    (9.7, "#1DA1F2"),
    (9.0, "#186A3B"),
    (8.0, "#28B463"),
    (7.0, "#F4D03F"),
    (0.0, "#F39C12"),
]


def tier_color(value):
    for lo, color in TIERS:
        if value >= lo:
            return color
    return TIERS[-1][1]


def round1(value):
    """Mean rounded half-up to one decimal, matching the guide's convention."""
    return float(Decimal(value).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def parse_anime(text):
    """Pull integer anime episode numbers out of an `anime` field."""
    if not text:
        return []
    nums = []
    text = text.replace("–", "-").replace("—", "-")
    for part in re.split(r"[,/]", text):
        part = part.strip()
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", part)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if 0 < b - a < 60:  # guard against absurd ranges
                nums.extend(range(a, b + 1))
        elif re.match(r"^\d+$", part):
            nums.append(int(part))
    return nums


def anime_shares(data, parse):
    """How many releases of the same line use each anime episode, so a split episode counts
    1/N in each (anime 353 is half of Thriller Bark 08 and half of 09).

    A "line" is one series of releases (One Pace, Onigashima Paced, Fun Pace, the original
    anime...), main and alternative versions counted separately, and several cuts of the same
    release (fixed / tweaked variants, same Pace number) count once.
    Returns {(line, anime number): number of releases}.
    """
    users = {}
    for saga in data["sagas"]:
        for node in saga["nodes"]:
            for group in node["groups"]:
                line = line_of(group, node)
                for ep in group["episodes"]:
                    release = ep.get("paceNumber") or ep["id"]
                    for n in set(parse(ep.get("anime"))):
                        users.setdefault((line, n), set()).add(release)
    return {k: len(v) for k, v in users.items()}


def line_of(group, node):
    """The release line: "One Pace" (all its arcs), "Onigashima Paced", "Kuma Cut"... from the
    section label, main and alternative versions apart."""
    name = re.sub(r"(\s*\([^)]*\))+\s*$", "", group["label"]).split(" - ")[0].strip()
    return (group["kind"], name, bool(group.get("isAlternative") or node.get("isAlternative")))


def load_ratings(cache):
    if cache:
        with open(cache, encoding="utf-8") as f:
            payload = json.load(f)
    else:
        req = urllib.request.Request(API_URL, headers={"User-Agent": "one-pace-guide/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.load(resp)
    by_num, tconst = {}, {}
    for season in payload:
        for ep in season.get("episodes", []):
            n = ep.get("episode_number")
            rating = ep.get("imdb_rating") or ep.get("vote_average") or ep.get("community_avg")
            if n is not None and rating:
                by_num[n] = rating
            if n is not None and ep.get("tconst"):
                tconst[n] = ep["tconst"]
    # The rating itself straight from IMDb's daily dataset (SeriesGraph's copy lags a few votes).
    fresh = imdb_ratings(set(tconst.values()))
    for n, t in tconst.items():
        if t in fresh:
            by_num[n] = fresh[t]
    print(f"IMDb: {sum(1 for t in tconst.values() if t in fresh)}/{len(tconst)} anime episodes rated straight from IMDb")
    return by_num


_imdb_cache = {}


def imdb_ratings(wanted):
    """{tconst: rating} from IMDb's public daily ratings file; {} if it cannot be reached."""
    if not wanted:
        return {}
    try:
        if "all" not in _imdb_cache:
            req = urllib.request.Request(IMDB_URL, headers={"User-Agent": "one-pace-guide/1.0"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                _imdb_cache["all"] = gzip.decompress(resp.read()).decode("utf-8")
        out = {}
        for line in _imdb_cache["all"].splitlines():
            t, _, rest = line.partition("\t")
            if t in wanted:
                out[t] = float(rest.split("\t")[0])
        return out
    except Exception as exc:
        print(f"IMDb dataset skipped, using SeriesGraph's copy: {exc}", file=sys.stderr)
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", help="Read the API response from a local JSON file instead of fetching.")
    ap.add_argument("--strict", action="store_true", help="Exit non-zero if the fetch fails.")
    args = ap.parse_args()

    try:
        by_num = load_ratings(args.cache)
    except Exception as exc:  # network down, API moved, etc. -- keep existing ratings.
        print(f"ratings refresh skipped (could not reach SeriesGraph): {exc}", file=sys.stderr)
        sys.exit(1 if args.strict else 0)
    if not by_num:
        print("ratings refresh skipped (empty response)", file=sys.stderr)
        sys.exit(1 if args.strict else 0)
    print(f"SeriesGraph: {len(by_num)} anime episodes with ratings")

    data = json.load(open(DATA, encoding="utf-8"))

    updated = unchanged = skipped = 0
    big_changes = []

    shares = anime_shares(data, parse_anime)
    for saga in data["sagas"]:
        saga_vals = []
        for node in saga["nodes"]:
            node_vals = []
            for group in node["groups"]:
                line = line_of(group, node)
                # The `anime` field of Live Action entries points at the adapted
                # One Piece anime episodes, but Netflix is a different show with its
                # own ratings, so never remap those.
                remappable = group["kind"] != "netflix"
                for ep in group["episodes"]:
                    nums = [n for n in parse_anime(ep.get("anime")) if n in by_num] if remappable else []
                    if nums:
                        # Mean of the anime episodes' IMDb ratings, a split episode counting 1/N.
                        w = {n: Decimal(1) / shares.get((line, n), 1) for n in nums}
                        new = round1(sum(Decimal(str(by_num[n])) * w[n] for n in nums) / sum(w.values()))
                        old = ep.get("rating")
                        if old != new:
                            updated += 1
                            if old is not None and abs(old - new) >= 0.3:
                                big_changes.append((abs(old - new), old, new, ep["title"][:40]))
                        else:
                            unchanged += 1
                        ep["rating"] = new
                        ep["tierColor"] = tier_color(new)
                    else:
                        skipped += 1
                    # Arc/saga ratings average every canon-route episode shown (One Pace,
                    # Onigashima Paced, Kuma Cut / Shaved Egghead, One Piece Log).
                    # Weighted by length, so a 35-minute release counts more than a 15-minute one.
                    if ep.get("canon") and ep.get("rating") is not None:
                        pair = (Decimal(str(ep["rating"])), Decimal(str(ep.get("runtime") or 24)))
                        node_vals.append(pair)
                        saga_vals.append(pair)
            # Recompute arc/movie/special rating from its canon episodes when available.
            if node_vals:
                node["rating"] = round1(sum(r * m for r, m in node_vals) / sum(m for _, m in node_vals))
        if saga_vals:
            saga["rating"] = round1(sum(r * m for r, m in saga_vals) / sum(m for _, m in saga_vals))

    # Live Action: its own SeriesGraph page (TMDB 111110), matched by season and episode.
    try:
        req = urllib.request.Request(LIVE_ACTION_API, headers={"User-Agent": "one-pace-guide/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            la = json.load(resp)
        la_rating, la_tconst = {}, {}
        for season in la:
            for ep in season.get("episodes", []):
                r = ep.get("imdb_rating") or ep.get("vote_average")
                if r:
                    la_rating[(ep.get("season_number") or season.get("season_number"), ep.get("episode_number"))] = r
                if ep.get("tconst"):
                    la_tconst[(ep.get("season_number") or season.get("season_number"), ep.get("episode_number"))] = ep["tconst"]
        fresh = imdb_ratings(set(la_tconst.values()))
        for k, t in la_tconst.items():
            if t in fresh:
                la_rating[k] = fresh[t]
        la_updated = 0
        for saga in data["sagas"]:
            for node in saga["nodes"]:
                for group in node["groups"]:
                    if group["kind"] != "netflix":
                        continue
                    for ep in group["episodes"]:
                        m = re.match(r"S(\d+)E(\d+)", ep.get("title") or "")
                        r = la_rating.get((int(m.group(1)), int(m.group(2)))) if m else None
                        if r:
                            ep["rating"] = round1(Decimal(str(r)))
                            ep["tierColor"] = tier_color(ep["rating"])
                            la_updated += 1
        print(f"Live Action: {la_updated} episodes rated from SeriesGraph")
    except Exception as exc:
        print(f"Live Action ratings skipped: {exc}", file=sys.stderr)

    data["meta"]["ratingsSource"] = "SeriesGraph IMDb (https://seriesgraph.com/show/37854-one-piece)"

    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"episodes: updated={updated} unchanged={unchanged} skipped(no anime mapping)={skipped}")
    if big_changes:
        big_changes.sort(reverse=True)
        print(f"notable changes (|delta| >= 0.3): {len(big_changes)}")
        for delta, old, new, title in big_changes[:15]:
            print(f"  {old} -> {new}  ({title})")


if __name__ == "__main__":
    main()
