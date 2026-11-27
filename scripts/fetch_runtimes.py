#!/usr/bin/env python3
"""Add real runtimes (minutes) to src/data/data.json.

Runs before every build (non-fatal: on network errors the existing values are kept).

  * One Pace episodes: onepace.net/en/watch lists every episode ("slug" + "duration").
  * Onigashima Paced, Kuma Cut / Shaved Egghead and Fun Pace: their project spreadsheets
    (Fun Pace only publishes minutes per arc, so G-8 episodes get the arc average).
  * Movies and specials: Trakt movie runtimes (titles mapped in MOVIES below).
  * Live Action and One Piece Log: Trakt episode runtimes of those shows.
  * Original anime entries (alternatives, fillers, specials with anime episode numbers):
    the sum of the original episodes' runtimes on Trakt's One Piece show.

Each episode gets `runtime` (minutes) and `runtimeSource`. Entries with no published
length (Fun Pace, Onigashima Paced, Kuma Cut / Shaved Egghead, upcoming films) keep none
and the site falls back to an estimate. The original anime runtimes are also stored in
meta.animeRuntimes for the "vs full anime" comparison.

Usage:  python3 -I scripts/fetch_runtimes.py
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
CONFIG = os.path.join(ROOT, "src", "config.ts")
UA = {"User-Agent": "one-pace-guide/1.0"}

# Guide entry title prefix -> Trakt movie slug (shared with fetch_trakt_ratings.py).
MOVIES = [(m["title"], m["trakt"]) for m in json.load(open(os.path.join(ROOT, "scripts", "trakt-movies.json")))["movies"]]
LIVE_ACTION_SHOW = "one-piece-2023"
# Community projects publish their lengths in their spreadsheets (CSV export).
SHEET = "https://docs.google.com/spreadsheets/d/{}/export?format=csv"
ONIGASHIMA_SHEET = "1HoYogAchoU5DWxVJzUy3eZcHMZk_hUmzUVnQm9KxeFI"   # Onigashima Paced + End of Wano
KUMA_SHAVED_SHEET = "1ODt-b2L9PyAr0xEWhj1yIOqp__crBFVXhvejblvP_mU"  # Kuma Cut + Shaved Egghead
FUN_PACE_SHEET = "1LYxp1i5FldNiKdL8BKaQ3T8EeueCSpgDWvN51kCBcKI"     # Fun Pace (minutes per arc)

# Stremio codes of One Pace arcs that have fixed/tweaked variant episodes.
STREMIO_ARCS = {"FI": "fishman-island", "PH": "punk-hazard"}


def client_id():
    try:
        m = re.search(r"traktClientId:\s*'([^']+)'", open(CONFIG, encoding="utf-8").read())
        if m:
            return m.group(1)
    except OSError:
        pass
    return os.environ.get("TRAKT_CLIENT_ID", "")


def get(url, headers=None, raw=False):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = resp.read()
    return body.decode("utf-8") if raw else json.loads(body)


def minutes(text):
    """'17 min' / '1 hr' / '1 hr 5 min' -> minutes."""
    h = re.search(r"(\d+)\s*hr", text)
    m = re.search(r"(\d+)\s*min", text)
    total = (int(h.group(1)) * 60 if h else 0) + (int(m.group(1)) if m else 0)
    return total or None


def anime_numbers(text):
    out = []
    text = re.sub(r"\[[^\]]*\]", "", text or "").replace("–", "-").replace("—", "-")
    for part in re.split(r"[,/]", text):
        p = part.strip()
        r = re.match(r"^(\d+)\s*-\s*(\d+)$", p)
        if r:
            a, b = int(r.group(1)), int(r.group(2))
            if 0 <= b - a < 80:
                out += list(range(a, b + 1))
        elif p.isdigit():
            out.append(int(p))
    return out


def clock_minutes(text):
    """'34:35', '1:02:10' or '22m39s' -> minutes (rounded)."""
    text = (text or "").strip()
    m = re.fullmatch(r"(?:(\d+):)?(\d+):(\d{2})", text)
    if m:
        return round(int(m.group(1) or 0) * 60 + int(m.group(2)) + int(m.group(3)) / 60) or None
    m = re.fullmatch(r"(?:(\d+)h)?\s*(\d+)m\s*(?:(\d+)s)?", text)
    if m:
        return round(int(m.group(1) or 0) * 60 + int(m.group(2)) + int(m.group(3) or 0) / 60) or None
    return None


def sheet_rows(sheet_id):
    import csv
    import io
    return list(csv.reader(io.StringIO(get(SHEET.format(sheet_id), raw=True))))


def community_durations():
    """Lengths from the Onigashima Paced, Kuma Cut / Shaved Egghead and Fun Pace sheets."""
    out = {"onigashima": {}, "endofwano": {}, "kuma": {}, "funpace": {}}
    try:
        block = None
        for row in sheet_rows(ONIGASHIMA_SHEET):
            head = (row[0] if row else "").strip()
            if head.startswith("Onigashima #"):
                block = "onigashima"
            elif head.startswith("End of Wano #"):
                block = "endofwano"
            elif block and re.fullmatch(r"[\d.]+", head) and len(row) > 3 and clock_minutes(row[3]):
                out[block][str(float(head))] = clock_minutes(row[3])
    except Exception as exc:
        print(f"  Onigashima sheet skipped: {exc}", file=sys.stderr)
    try:
        for row in sheet_rows(KUMA_SHAVED_SHEET):
            m = re.search(r"(\d{4}(?:\+\d+)?)\s*$", row[1] if len(row) > 4 else "")
            if m and clock_minutes(row[4]):
                out["kuma"][m.group(1)] = clock_minutes(row[4])
    except Exception as exc:
        print(f"  Kuma Cut sheet skipped: {exc}", file=sys.stderr)
    try:
        rows = sheet_rows(FUN_PACE_SHEET)
        hdr = rows[0]
        ci, cm = hdr.index("FunPace Eps"), hdr.index("FunPace Mins")
        for row in rows[1:]:
            if len(row) > cm and re.fullmatch(r"[\d.]+", row[0].strip()):
                try:
                    out["funpace"][row[0].strip()] = (float(row[cm]), int(float(row[ci] or 1)))
                except ValueError:
                    pass
    except Exception as exc:
        print(f"  Fun Pace sheet skipped: {exc}", file=sys.stderr)
    return out


def onepace_durations():
    html = get("https://onepace.net/en/watch", raw=True).replace('\\"', '"')
    out = {}
    for m in re.finditer(r'"slug":"([a-z0-9-]+-\d+(?:\.\d+)?)","part":', html):
        d = re.search(r'"duration":"([^"]+)"', html[m.end():m.end() + 6000])
        if d and minutes(d.group(1)):
            out.setdefault(m.group(1), minutes(d.group(1)))
    return out


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    entries = [(e, g) for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]]
    node_of = {id(e): n["title"] for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]}

    def n_title(e):
        return node_of[id(e)]
    cid = client_id()
    th = {"trakt-api-version": "2", "trakt-api-key": cid}

    try:
        op = onepace_durations()
    except Exception as exc:
        print(f"runtimes skipped (onepace.net unreachable): {exc}", file=sys.stderr)
        sys.exit(0)
    try:
        anime = get("https://api.trakt.tv/shows/one-piece/seasons?extended=full,episodes", th)
        live = get(f"https://api.trakt.tv/shows/{LIVE_ACTION_SHOW}/seasons?extended=full,episodes", th)
        movies = {slug: get(f"https://api.trakt.tv/movies/{slug}?extended=full", th).get("runtime") for _, slug in MOVIES}
        log_show = get("https://api.trakt.tv/search/imdb/tt33992229?type=show", th)[0]["show"]["ids"]["slug"]
        log = get(f"https://api.trakt.tv/shows/{log_show}/seasons?extended=full,episodes", th)
    except Exception as exc:
        print(f"runtimes skipped (Trakt unreachable): {exc}", file=sys.stderr)
        sys.exit(0)

    community = community_durations()
    # Fun Pace arcs in this guide -> their row in the Fun Pace sheet.
    FUN_PACE_ROWS = {"G8 Arc": "16.1"}

    anime_rt = {}
    for s in anime:
        if s["number"] == 0:
            continue
        for e in s.get("episodes", []):
            if e.get("number_abs") and e.get("runtime"):
                anime_rt[e["number_abs"]] = e["runtime"]
    live_rt = {(s["number"], e["number"]): e.get("runtime") for s in live for e in s.get("episodes", [])}
    log_rt = {e["number"]: e.get("runtime") for s in log if s["number"] > 0 for e in s.get("episodes", [])}

    counts = {}
    for e, g in entries:
        # Anime-only scenes keep the length of their clip ("05:40–07:44" is 2 minutes).
        if e.get("clip"):
            a, b = [sum(int(x) * m for x, m in zip(t.strip().split(":"), (60, 1))) for t in e["clip"].replace("-", "–").split("–")]
            e["runtime"], e["runtimeSource"] = max(1, round((b - a) / 60)), "clip"
            counts["clip"] = counts.get("clip", 0) + 1
            continue
        e.pop("runtime", None)
        e.pop("runtimeSource", None)
        rt, src = None, None
        link = e["links"].get("onepace") or ""
        slug = link.split("#", 1)[1] if link.count("#") == 1 else None
        title = e.get("title") or ""
        # Fixed/tweaked variants have no onepace.net link; they match the standard release
        # through their Stremio code (e.g. onepace/FI_7 -> fishman-island-07).
        code = re.search(r"/onepace/([A-Z]+)_(\d+)$", e["links"].get("stremio") or "")
        if not slug and code and code.group(1) in STREMIO_ARCS:
            slug = f"{STREMIO_ARCS[code.group(1)]}-{int(code.group(2)):02d}"
        if slug and slug in op:
            rt, src = op[slug], "onepace"
        elif g["kind"] == "netflix":
            m = re.match(r"S(\d+)E(\d+)", title)
            if m:
                rt, src = live_rt.get((int(m.group(1)), int(m.group(2)))), "trakt"
        elif g["kind"] in ("onigashima", "onigashima-plus") and e.get("pace"):
            m = re.match(r"(Onigashima Paced|End of Wano)\s+([\d.]+)", e["pace"])
            if m:
                block = "onigashima" if m.group(1).startswith("Onigashima") else "endofwano"
                rt, src = community[block].get(str(float(m.group(2)))), "sheet"
        elif g["kind"] == "kuma-shaved":
            m = re.search(r"(\d{4}(?:\+\d+)?)\s*$", e.get("fullTitle") or "")
            if m:
                rt, src = community["kuma"].get(m.group(1)), "sheet"
        elif re.match(r"FunPace \d", e.get("pace") or "") or (g["kind"] == "funpace" and n_title(e) in FUN_PACE_ROWS):
            m = re.match(r"FunPace ([\d.]+)", e.get("pace") or "")
            row = community["funpace"].get(m.group(1) if m else FUN_PACE_ROWS[n_title(e)])
            if row:
                total, count = row
                rt, src = round(total / max(count, 1)), "sheet" if count == 1 else "sheet-average"
        elif g["kind"] == "log":
            m = re.match(r"Log (\d+)", title)
            if m:
                rt, src = log_rt.get(int(m.group(1))), "trakt"
        else:
            slug = next((s for prefix, s in MOVIES if title.startswith(prefix)), None)
            if slug:
                rt, src = movies.get(slug), "trakt"
            elif g["kind"] in ("original", "filler", "special") and not title.startswith("Fun Pace"):
                nums = anime_numbers(e.get("anime")) or [int(x) for x in re.findall(r"^Episode (\d+)", title)]
                if nums and all(n in anime_rt for n in nums):
                    rt, src = sum(anime_rt[n] for n in nums), "anime"
        if rt:
            e["runtime"] = int(rt)
            e["runtimeSource"] = src
            counts[src] = counts.get(src, 0) + 1

    data["meta"]["animeRuntimes"] = {str(k): v for k, v in sorted(anime_rt.items())}
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    missing = [(g["kind"], e["title"][:28]) for e, g in entries if "runtime" not in e]
    print(f"runtimes: {sum(counts.values())}/{len(entries)} real ({counts}); "
          f"{len(missing)} estimated: {sorted(set(k for k, _ in missing))}")


if __name__ == "__main__":
    main()
