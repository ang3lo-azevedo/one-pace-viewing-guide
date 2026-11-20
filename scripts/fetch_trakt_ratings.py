#!/usr/bin/env python3
"""Add Trakt community ratings to src/data/data.json.

Fetches the Trakt "one-pace" show's episodes (public API, Client ID only) and copies each
episode's Trakt rating + vote count onto the matching One Pace episode. Matching mirrors the
app's mapper: by normalized episode title, with a positional fallback when an arc and its
aligned Trakt season have the same episode count. Trakt ratings are sparse (many episodes
have few or no votes), so only ratings with at least one vote are stored.

Usage:  python3 -I scripts/fetch_trakt_ratings.py
Run with -I so a stray local module can't shadow the standard library.
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
CONFIG = os.path.join(ROOT, "src", "config.ts")
SLUG = "one-pace"


def client_id():
    try:
        text = open(CONFIG, encoding="utf-8").read()
        m = re.search(r"traktClientId:\s*'([^']+)'", text)
        if m:
            return m.group(1)
    except OSError:
        pass
    return os.environ.get("TRAKT_CLIENT_ID", "")


def norm(t):
    if not t:
        return ""
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\benter\b", "", t)
    t = re.sub(r"\bthe\b", "", t)
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", t)).strip()


def fetch_seasons(cid):
    req = urllib.request.Request(
        f"https://api.trakt.tv/shows/{SLUG}/seasons?extended=full,episodes",
        headers={"trakt-api-version": "2", "trakt-api-key": cid, "User-Agent": "one-pace-guide/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    cid = client_id()
    if not cid:
        print("no Trakt client id (src/config.ts); skipping", file=sys.stderr)
        sys.exit(0)
    try:
        seasons = fetch_seasons(cid)
    except Exception as exc:
        print(f"Trakt ratings skipped (fetch failed): {exc}", file=sys.stderr)
        sys.exit(0)

    # Global unique-title index + per-season episodes.
    counts = {}
    flat = []
    for s in seasons:
        for e in s.get("episodes", []):
            n = norm(e.get("title"))
            flat.append((n, s["number"], e))
            counts[n] = counts.get(n, 0) + 1
    title_idx = {n: e for n, _, e in flat if counts[n] == 1}
    season_eps = [{ "count": len(s.get("episodes", [])), "byNum": {e["number"]: e for e in s.get("episodes", [])} } for s in seasons]

    data = json.load(open(DATA, encoding="utf-8"))
    arcs = []
    for s in data["sagas"]:
        for n in s["nodes"]:
            for g in n["groups"]:
                if g["kind"] == "onepace" and not g["isAlternative"]:
                    arcs.append(g["episodes"])

    applied = cleared = 0
    for ai, eps in enumerate(arcs):
        ts = season_eps[ai] if ai < len(season_eps) else None
        for ei, ep in enumerate(eps):
            te = title_idx.get(norm(ep.get("fullTitle")))
            if te is None and ts and ts["count"] == len(eps):
                te = ts["byNum"].get(ei + 1)
            if te:
                # Remember where the episode lives on Trakt, so the badge can link to it.
                ep["traktEpisode"] = {"season": te.get("season"), "number": te.get("number")}
            rating = te.get("rating") if te else None
            votes = te.get("votes") if te else None
            if rating and votes:
                ep["traktRating"] = round(float(rating), 1)
                ep["traktVotes"] = int(votes)
                applied += 1
            elif "traktRating" in ep:
                del ep["traktRating"]
                ep.pop("traktVotes", None)
                cleared += 1

    data["meta"]["traktRatingsSource"] = f"Trakt (https://trakt.tv/shows/{SLUG})"
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Trakt ratings applied to {applied} episodes (cleared {cleared})")


if __name__ == "__main__":
    main()
