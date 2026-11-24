#!/usr/bin/env python3
"""Map guide episodes to Trakt and add Trakt community ratings (src/data/data.json).

Runs before every build (public API, Client ID only). Two Trakt shows are used:

* "one-pace"  - the One Pace releases. Every guide entry with a onepace.net link is matched
  by normalized episode title (unique titles only). Entries without a title match use the
  episode number from their One Pace link, in the Trakt season their arc maps to (taken
  from the arc's other matches, or inferred from the neighbouring arcs). Stored as
  `traktEpisode` {season, number, trakt}, plus `traktRating`/`traktVotes` when the episode
  has votes.
* "one-piece" - the original anime. Canon-route entries that are not One Pace releases
  (Onigashima Paced, Kuma Cut / Shaved Egghead, One Piece Log) are mapped to the anime
  episodes they cover by absolute episode number. Stored as `traktAnime` [[season, number,
  trakt], ...] so syncing marks those anime episodes.
* "one-piece-2023" - the Netflix Live Action, matched by its SxEy number. Stored as
  `traktEpisode` with `show` set, plus its ratings.

If Trakt cannot be reached the existing data is left untouched.

Usage:  python3 -I scripts/fetch_trakt_ratings.py
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
CONFIG = os.path.join(ROOT, "src", "config.ts")
PACE_SHOW = "one-pace"
ANIME_SHOW = "one-piece"
LIVE_SHOW = "one-piece-2023"  # Netflix Live Action
# Fewer votes than this on Trakt and the rating comes from the anime episodes instead.
MIN_VOTES = 10
# Kinds that are not anime episodes (or have their own Trakt entry).
NO_ANIME_SYNC = {"netflix", "movie", "upcoming", "original-continuation"}

# Hand-checked fixes, keyed by the One Pace link slug: (Trakt season, episode) or None to
# leave an episode unmapped. Trakt's season layout differs from One Pace here, so neither
# the title nor the number lines up on its own.
OVERRIDES = {
    "baratie-03": (5, 4),             # "The Oath" is Trakt's "The Vow"
    "post-enies-lobby-01": (20, 1),   # Trakt S20 is ordered differently from One Pace
    "post-enies-lobby-02": (20, 2),
    "post-enies-lobby-03": None,      # folded into E2/E3 of Trakt's older cut; no episode of its own
    "post-enies-lobby-04": (20, 3),   # now "Briefs from Franky House", Trakt's "Forgive Yourself! Franky Departs!"
    "post-enies-lobby-06": (20, 5),   # "The Circling Bounties and The Duel on Banaro Island!"
}


def client_id():
    try:
        m = re.search(r"traktClientId:\s*'([^']+)'", open(CONFIG, encoding="utf-8").read())
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
    t = re.sub(r"\(extended\)", "", t)
    return re.sub(r"[^a-z0-9]+", "", t)


def anime_numbers(text):
    out = []
    text = re.sub(r"\[[^\]]*\]", "", text or "")  # "206 [207 ending]"
    for part in text.replace("–", "-").replace("—", "-").split(","):
        p = part.strip()
        r = re.match(r"^(\d+)\s*-\s*(\d+)$", p)
        if r:
            a, b = int(r.group(1)), int(r.group(2))
            if 0 <= b - a < 80:
                out += list(range(a, b + 1))
        elif p.isdigit():
            out.append(int(p))
    return out


def line_of(group, node):
    """Release line (same as fetch_ratings.py): "One Pace", "Onigashima Paced", ... main and
    alternative versions apart."""
    name = re.sub(r"(\s*\([^)]*\))+\s*$", "", group["label"]).split(" - ")[0].strip()
    return (group["kind"], name, bool(group.get("isAlternative") or node.get("isAlternative")))


def anime_shares(data):
    """{(line, anime number): releases of that line using it}: a split episode counts 1/N."""
    users = {}
    for saga in data["sagas"]:
        for node in saga["nodes"]:
            for group in node["groups"]:
                line = line_of(group, node)
                for ep in group["episodes"]:
                    for n in set(anime_numbers(ep.get("anime"))):
                        users.setdefault((line, n), set()).add(ep.get("paceNumber") or ep["id"])
    return {k: len(v) for k, v in users.items()}


def fetch(cid, slug):
    req = urllib.request.Request(
        f"https://api.trakt.tv/shows/{slug}/seasons?extended=full,episodes",
        headers={"trakt-api-version": "2", "trakt-api-key": cid, "User-Agent": "one-pace-guide/1.0"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def pace_key(ep):
    """("wano", 32) from a onepace.net link like ...#wano-32."""
    m = re.match(r"^(.*)-(\d+)$", ep["links"]["onepace"].split("#", 1)[1])
    return (m.group(1), int(m.group(2))) if m else (None, None)


def main():
    cid = client_id()
    if not cid:
        print("no Trakt client id (src/config.ts); skipping", file=sys.stderr)
        sys.exit(0)
    try:
        pace = fetch(cid, PACE_SHOW)
        anime = fetch(cid, ANIME_SHOW)
        live = fetch(cid, LIVE_SHOW)
    except Exception as exc:
        print(f"Trakt mapping skipped (fetch failed): {exc}", file=sys.stderr)
        sys.exit(0)

    data = json.load(open(DATA, encoding="utf-8"))
    entries = [(e, g) for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]]
    for e, _ in entries:
        for k in ("traktEpisode", "traktAnime", "traktMovie", "traktRating", "traktVotes", "traktRatingFrom"):
            e.pop(k, None)

    # ---- One Pace show -------------------------------------------------------
    counts = Counter()
    flat = []
    for s in pace:
        if s["number"] == 0:
            continue
        for e in s.get("episodes", []):
            n = norm(e.get("title"))
            flat.append((n, s["number"], e))
            counts[n] += 1
    by_title = {n: (sn, e) for n, sn, e in flat if counts[n] == 1}
    by_season = {s["number"]: {e["number"]: e for e in s.get("episodes", [])} for s in pace if s["number"] > 0}

    releases = [(e, g) for e, g in entries if (e["links"].get("onepace") or "").count("#") == 1 and pace_key(e)[0]]
    used, match, skip = set(), {}, set()
    for e, _ in releases:
        slug = e["links"]["onepace"].split("#", 1)[1]
        if slug in OVERRIDES:
            if OVERRIDES[slug] is None:
                skip.add(e["id"])
            else:
                sn, num = OVERRIDES[slug]
                te = by_season[sn][num]
                match[e["id"]] = (sn, te)
                used.add(te["ids"]["trakt"])
    for e, _ in releases:
        if e["id"] in match or e["id"] in skip:
            continue
        hit = by_title.get(norm(e.get("fullTitle")))
        if hit and hit[1]["ids"]["trakt"] not in used:
            match[e["id"]] = hit
            used.add(hit[1]["ids"]["trakt"])

    # Which Trakt season each arc lives in: majority of its title matches, otherwise the
    # season right after the previous arc's (arcs and seasons share the same order).
    votes = defaultdict(Counter)
    arc_order = []
    for e, _ in releases:
        arc, _num = pace_key(e)
        if arc not in arc_order:
            arc_order.append(arc)
        if e["id"] in match:
            votes[arc][match[e["id"]][0]] += 1
    arc_season, prev = {}, 0
    taken = {v.most_common(1)[0][0] for v in votes.values()}
    for arc in arc_order:
        if votes[arc]:
            arc_season[arc] = votes[arc].most_common(1)[0][0]
        elif prev + 1 in by_season and prev + 1 not in taken:
            arc_season[arc] = prev + 1
        prev = arc_season.get(arc, prev)

    # Fill the gaps by number, using the numbering shift of the matched episodes around each
    # gap (Trakt sometimes has an extra or missing episode in an arc). If the matched
    # neighbours disagree on the shift, the episode is left unmapped rather than guessed.
    by_arc = defaultdict(list)
    for e, _ in releases:
        by_arc[pace_key(e)[0]].append(e)
    for arc, eps in by_arc.items():
        sn = arc_season.get(arc)
        season = by_season.get(sn, {})
        if not season:
            continue
        offsets = {}
        for e in eps:
            if e["id"] in match and match[e["id"]][0] == sn:
                offsets[e["id"]] = match[e["id"]][1]["number"] - pace_key(e)[1]
        for i, e in enumerate(eps):
            if e["id"] in match or e["id"] in skip:
                continue
            below = next((offsets[x["id"]] for x in reversed(eps[:i]) if x["id"] in offsets), None)
            above = next((offsets[x["id"]] for x in eps[i + 1:] if x["id"] in offsets), None)
            if below is not None and above is not None and below != above:
                continue
            if below is None and above not in (None, 0):
                continue  # gap at the start of an arc: only trust an unshifted numbering
            shift = below if below is not None else above
            if shift is None:
                if len(eps) != len(season):
                    continue
                shift = 0
            te = season.get(pace_key(e)[1] + shift)
            if te and te["ids"]["trakt"] not in used:
                match[e["id"]] = (sn, te)
                used.add(te["ids"]["trakt"])

    rated = 0
    for e, _ in releases:
        if e["id"] not in match:
            continue
        sn, te = match[e["id"]]
        e["traktEpisode"] = {"season": sn, "number": te["number"], "trakt": te["ids"]["trakt"]}
        if te.get("rating") and te.get("votes"):
            e["traktRating"] = round(float(te["rating"]), 1)
            e["traktVotes"] = int(te["votes"])
            rated += 1

    # ---- Netflix Live Action -------------------------------------------------
    live_eps = {(se["number"], e["number"]): e for se in live if se["number"] > 0 for e in se.get("episodes", [])}
    live_mapped = 0
    for e, g in entries:
        if g["kind"] != "netflix":
            continue
        m = re.search(r"S(\d+)E(\d+)", e.get("title") or "")
        te = live_eps.get((int(m.group(1)), int(m.group(2)))) if m else None
        if not te:
            continue
        e["traktEpisode"] = {"season": te["season"] if "season" in te else int(m.group(1)), "number": te["number"],
                             "trakt": te["ids"]["trakt"], "show": LIVE_SHOW}
        if te.get("rating") and te.get("votes"):
            e["traktRating"] = round(float(te["rating"]), 1)
            e["traktVotes"] = int(te["votes"])
        live_mapped += 1

    # ---- original anime (community cuts) -------------------------------------
    abs_index = {}
    for s in anime:
        if s["number"] == 0:
            continue
        for e in s.get("episodes", []):
            if e.get("number_abs"):
                abs_index[e["number_abs"]] = [s["number"], e["number"], e["ids"]["trakt"]]
    anime_eps = {}  # absolute number -> Trakt anime episode (with rating and votes)
    for s in anime:
        if s["number"] == 0:
            continue
        for e in s.get("episodes", []):
            if e.get("number_abs"):
                anime_eps[e["number_abs"]] = e
    # Everything with anime episodes but no Trakt entry of its own (community cuts, One Pace
    # releases Trakt lacks, fixed variants, Fun Pace, the original anime alternatives, specials)
    # syncs through the anime episodes it covers.
    cuts = 0
    for e, g in entries:
        # A scene clipped from an episode does not mean the whole anime episode was watched.
        if "traktEpisode" in e or g["kind"] in NO_ANIME_SYNC or e.get("clip"):
            continue
        nums = anime_numbers(e.get("anime"))
        if nums and all(n in abs_index for n in nums):
            e["traktAnime"] = [abs_index[n] for n in nums]
            cuts += 1

    # ---- movies and specials (Trakt movies) ------------------------------------
    movies = json.load(open(os.path.join(ROOT, "scripts", "trakt-movies.json"), encoding="utf-8"))["movies"]
    movie_info = {}
    for m in movies:
        try:
            req = urllib.request.Request(
                f"https://api.trakt.tv/movies/{m['trakt']}?extended=full",
                headers={"trakt-api-version": "2", "trakt-api-key": cid, "User-Agent": "one-pace-guide/1.0"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                movie_info[m["trakt"]] = json.load(resp)
        except Exception as exc:
            print(f"  movie {m['trakt']} skipped: {exc}", file=sys.stderr)
    films = 0
    for e, _ in entries:
        slug = next((m["trakt"] for m in movies if (e.get("title") or "").startswith(m["title"])), None)
        info = movie_info.get(slug) if slug else None
        if not info:
            continue
        e["traktMovie"] = {"slug": slug, "trakt": info["ids"]["trakt"], "imdb": info["ids"].get("imdb")}
        if info.get("rating") and info.get("votes"):
            e["traktRating"] = round(float(info["rating"]), 1)
            e["traktVotes"] = int(info["votes"])
        films += 1

    # ---- ratings from the anime ---------------------------------------------------
    # Few people rate One Pace episodes on Trakt. Entries without a Trakt rating of their own
    # get the vote-weighted rating of the original anime episodes they cover.
    # A rating from a handful of votes is noise, so the anime's wins below MIN_VOTES.
    # Votes weight each anime episode, and an episode split across N releases counts 1/N.
    shares = anime_shares(data)
    line_by_ep = {e["id"]: line_of(g, n) for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]}
    from_anime = 0
    for e, g in entries:
        if g["kind"] in NO_ANIME_SYNC or "traktMovie" in e or e.get("traktVotes", 0) >= MIN_VOTES:
            continue
        line = line_by_ep[e["id"]]
        eps = [(n, anime_eps[n]) for n in anime_numbers(e.get("anime")) if n in anime_eps]
        eps = [(n, x) for n, x in eps if x.get("rating") and x.get("votes")]
        weights = [(x["rating"], x["votes"] / shares.get((line, n), 1)) for n, x in eps]
        total = sum(w for _, w in weights)
        if total:
            e["traktRating"] = round(sum(r * w for r, w in weights) / total, 1)
            e["traktVotes"] = sum(x["votes"] for _, x in eps)
            e["traktRatingFrom"] = "anime"
            from_anime += 1

    data["meta"]["traktRatingsSource"] = f"Trakt (https://trakt.tv/shows/{PACE_SHOW})"
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    missing = [e["title"] for e, _ in releases if e["id"] not in match]
    print(f"Trakt: {len(match)}/{len(releases)} One Pace releases mapped, {rated} with ratings, "
          f"{cuts} community cuts mapped to the original anime, {films} movies/specials, "
          f"{live_mapped} Live Action episodes, {from_anime} rated from the anime episodes they cover")
    if missing:
        print("  unmapped:", "; ".join(t[:30] for t in missing))


if __name__ == "__main__":
    main()
