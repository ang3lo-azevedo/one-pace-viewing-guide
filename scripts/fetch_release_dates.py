#!/usr/bin/env python3
"""Release dates for everything in the guide (src/data/data.json).

* One Pace releases: onepace.net/en/releases, which lists every release (current and
  outdated) with its date. An episode gets `released` (its current release) and
  `firstReleased` (its oldest one, batches included) when that is older. Trakt's dates for
  the One Pace show are often off, so they are not used.
* Live Action and One Piece Log episodes, films and specials: Trakt (`released`).
* Original anime episodes: Trakt air dates, kept once in meta.animeAired {number: date}.
* Manga chapters: the One Piece Wiki's release date list, kept in meta.chapterDates.

Dates are YYYY-MM-DD. If a source cannot be reached its dates are left as they were.

Usage:  python3 -I scripts/fetch_release_dates.py
"""
import html as htmllib
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
CONFIG = os.path.join(ROOT, "src", "config.ts")
UA = {"User-Agent": "one-pace-guide/1.0"}
RELEASES = "https://onepace.net/en/releases"
WIKI = ("https://onepiece.fandom.com/api.php?action=query&prop=revisions&rvprop=content"
        "&rvslots=main&format=json&titles=Template:WhichMangaDate")
# Arc names onepace.net used before (its older releases keep them).
OLD_NAMES = {"alabasta": ["arabasta"]}
# Batches named differently from the arc.
BATCH_NAMES = {"wano": ["wano-act-1"]}


def get(url, headers=None, raw=False):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=60) as r:
        body = r.read().decode("utf-8")
    return body if raw else json.loads(body)


def client_id():
    m = re.search(r"traktClientId:\s*'([^']+)'", open(CONFIG, encoding="utf-8").read())
    return m.group(1) if m else os.environ.get("TRAKT_CLIENT_ID", "")


def trakt(cid, path):
    return get("https://api.trakt.tv" + path, {"trakt-api-version": "2", "trakt-api-key": cid})


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", re.sub(r"['\u2019]", "", text.lower())).strip("-")


def release_cards(html):
    """{slug: [(date, outdated)]} and {hash: [(date, outdated)]} from the releases page."""
    by_slug, by_hash = {}, {}
    starts = [m.start() for m in re.finditer(r'id="urn:btih:', html)] + [len(html)]
    for a, b in zip(starts, starts[1:]):
        seg = html[a:b]
        h = re.match(r'id="urn:btih:([0-9a-f]+)"', seg).group(1)
        text = htmllib.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", seg)).split(">", 1)[-1].strip())
        title = re.match(r"(.*?) Release(?:/Archival)? Date", text)
        when = re.search(r'<relative-date datetime="(\d{4}-\d\d-\d\d)', seg)
        if not (title and when):
            continue
        card = (when.group(1), "Outdated" in text)
        by_slug.setdefault(slugify(title.group(1)), []).append(card)
        by_hash.setdefault(h, []).append(card)
    return by_slug, by_hash


def pick(cards):
    """(current release, oldest release) of an episode's cards."""
    current = [d for d, old in cards if not old] or [d for d, _ in cards]
    return max(current), min(d for d, _ in cards)


def one_pace_dates(data, html):
    by_slug, by_hash = release_cards(html)
    done = 0
    for s in data["sagas"]:
        for n in s["nodes"]:
            for g in n["groups"]:
                for e in g["episodes"]:
                    link = e["links"].get("onepace") or ""
                    if "#urn:btih:" in link:
                        cards = by_hash.get(link.split("urn:btih:")[1], [])
                        direct = cards
                    elif "/watch#" in link:
                        slug = link.split("#", 1)[1]
                        m = re.match(r"^(.*?)-([\d.]+)$", slug)
                        arc, num = (m.group(1), m.group(2)) if m else (slug, "")
                        ext = "extended" in (e.get("fullTitle") or e["title"]).lower()
                        names = [arc] + OLD_NAMES.get(arc, [])
                        direct = []
                        for a in names:
                            key = f"{a}-{num}" if num else a
                            direct += by_slug.get(key + "-extended-cut", []) if ext else []
                            if not (ext and direct):
                                direct += by_slug.get(key, [])
                            if not direct and num in ("1", "01"):
                                direct += by_slug.get(a, [])  # one-episode arcs: "The Trials of Koby-Meppo"
                        batch = [c for a in names + BATCH_NAMES.get(arc, []) for c in by_slug.get(f"batch-{a}", [])]
                        cards = direct or batch
                        if direct:
                            cards = direct + batch  # batches only count for the first release
                    else:
                        continue
                    if not cards:
                        continue
                    current, first = pick(direct or cards)
                    first = min(first, pick(cards)[1])
                    e["released"] = current
                    if first < current:
                        e["firstReleased"] = first
                    done += 1
    return done


def wiki_chapter_dates():
    page = next(iter(get(WIKI)["query"]["pages"].values()))
    text = page["revisions"][0]["slots"]["main"]["*"]
    out = {}
    for num, m, d, y in re.findall(r"\|Chapter (\d+)=(\d{1,2})/(\d{1,2})/(\d{4})", text):
        out[num] = f"{y}-{int(m):02d}-{int(d):02d}"
    return dict(sorted(out.items(), key=lambda kv: int(kv[0])))


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    entries = [e for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]]
    report = []

    try:
        n = one_pace_dates(data, get(RELEASES, raw=True))
        report.append(f"{n} One Pace releases")
    except Exception as exc:
        print(f"  onepace.net releases skipped: {exc}", file=sys.stderr)

    cid = client_id()
    if cid:
        try:
            aired = {}
            for se in trakt(cid, "/shows/one-piece/seasons?extended=full,episodes"):
                if se["number"] == 0:
                    continue
                for ep in se.get("episodes", []):
                    if ep.get("number_abs") and ep.get("first_aired"):
                        aired[str(ep["number_abs"])] = ep["first_aired"][:10]
            data["meta"]["animeAired"] = dict(sorted(aired.items(), key=lambda kv: int(kv[0])))
            report.append(f"{len(aired)} anime air dates")

            # Episodes of other Trakt shows (Live Action, One Piece Log), by Trakt episode id.
            shows = {(e.get("traktEpisode") or {}).get("show") for e in entries} - {None}
            by_id = {}
            for show in shows:
                for se in trakt(cid, f"/shows/{show}/seasons?extended=full,episodes"):
                    for ep in se.get("episodes", []):
                        if ep.get("first_aired"):
                            by_id[ep["ids"]["trakt"]] = ep["first_aired"][:10]
            movies = {}
            for e in entries:
                te, tm = e.get("traktEpisode") or {}, e.get("traktMovie")
                if te.get("show") and te.get("trakt") in by_id:
                    e["released"] = by_id[te["trakt"]]
                elif tm and not e.get("fanEdit"):
                    if tm["slug"] not in movies:
                        movies[tm["slug"]] = trakt(cid, f"/movies/{tm['slug']}?extended=full").get("released")
                    if movies[tm["slug"]]:
                        e["released"] = movies[tm["slug"]]
            report.append(f"{len(movies)} films and specials")
        except Exception as exc:
            print(f"  Trakt dates skipped: {exc}", file=sys.stderr)

    try:
        data["meta"]["chapterDates"] = wiki_chapter_dates()
        report.append(f"{len(data['meta']['chapterDates'])} chapter dates")
    except Exception as exc:
        print(f"  chapter dates skipped: {exc}", file=sys.stderr)

    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("release dates: " + ", ".join(report))


if __name__ == "__main__":
    main()
