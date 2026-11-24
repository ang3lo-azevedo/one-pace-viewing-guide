#!/usr/bin/env python3
"""Follow One Pace's releases (src/data/data.json): Extended versions and the Wano hand-off.

Every One Pace release that has an Extended version on onepace.net is listed as that version.

The Wano hand-off between One Pace and Onigashima Paced is kept current:

The guide follows One Pace's own Wano releases (wano-01..N on onepace.net, shown as Wano 01-31
and Onigashima Raid 01..) and continues with the community Onigashima Paced edit after One
Pace's last chapter. When One Pace releases more of Wano, this script:

  * adds the new releases after the last Onigashima Raid episode (title, chapters, anime
    episodes and length from onepace.net), giving them the next Pace numbers and shifting the
    later Pace numbers by one per new release;
  * moves the Onigashima Paced episodes those releases now cover from "Onigashima Paced -
    Onigashima (29-...)" into the overlapping section, which is the alternative when you
    follow One Pace (Preferences > Wano: Onigashima).

Nothing changes while One Pace has not released anything new. If onepace.net cannot be
reached the data is left untouched.

Usage:  python3 -I scripts/sync_wano.py
"""
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
RAID_FIRST_SLUG = 32  # wano-32 is Onigashima Raid 01


def terms(raw):
    """'{"from":1028,"to":1028},{"from":1031,"to":1032}' -> '1028, 1031–1032'."""
    out = []
    for a, b in re.findall(r'"from":(\d+),"to":(\d+)', raw or ""):
        out.append(a if a == b else f"{a}–{b}")
    return ", ".join(out)


def last_number(text):
    nums = [int(x) for x in re.findall(r"\d+", text or "")]
    return max(nums) if nums else 0


def shift_pace_text(text, start, by):
    """Shift "Pace N" / "Pace N–M" / "Pace: Eps N–M" numbers >= start (not Fun Pace)."""
    if not text:
        return text

    def rep(m):
        a = int(m.group(2))
        out = f"{m.group(1)}{a + by if a >= start else a}"
        if m.group(4):
            b = int(m.group(4))
            out += f"{m.group(3)}{b + by if b >= start else b}"
        return out

    return re.sub(r"(?<!Fun )(Pace(?::)? (?:Eps )?)(\d+)(?:([–-])(\d+))?", rep, text)


def main():
    try:
        if len(sys.argv) > 1:  # a saved copy of the page, for testing
            html = open(sys.argv[1], encoding="utf-8").read().replace('\\"', '"')
        else:
            req = urllib.request.Request("https://onepace.net/en/watch", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                html = resp.read().decode("utf-8").replace('\\"', '"')
    except Exception as exc:
        print(f"Wano sync skipped (onepace.net unreachable): {exc}", file=sys.stderr)
        return

    releases = {}
    for m in re.finditer(r'"slug":"wano-(\d+)","part":', html):
        n = int(m.group(1))
        seg = html[m.start(): m.start() + 3000]
        title = re.search(r'"title":"(.*?)","titleRepeats', seg)
        ch = re.search(r'"chapters":\{"terms":\[(.*?)\]', seg)
        ep = re.search(r'"episodes":\{"terms":\[(.*?)\]', seg)
        releases.setdefault(n, {
            "title": title.group(1) if title else f"Wano {n}",
            "chapters": terms(ch.group(1) if ch else ""),
            "anime": terms(ep.group(1) if ep else ""),
        })

    data = json.load(open(DATA, encoding="utf-8"))

    # Every One Pace release that has an Extended version is listed as that version, like
    # "Arlong Park 05 Extended" (Loguetown 01 is Extended only with Daddy the Father: skipped).
    starts = [(m.start(), m.group(1)) for m in re.finditer(r'"slug":"([a-z0-9.-]+)","part":', html)]
    extended = set()
    for i, (pos, slug) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(html)
        if '"cut":"extended"' in html[pos:end]:
            extended.add(slug)
    switched = []
    for s in data["sagas"]:
        for n in s["nodes"]:
            for g in n["groups"]:
                for e in g["episodes"]:
                    link = e["links"].get("onepace") or ""
                    slug = link.split("#", 1)[1] if link.count("#") == 1 else None
                    if slug not in extended or (e.get("withExtra") or {}).get("title") or " Extended" in e["title"]:
                        continue
                    head, sep, rest = e["title"].partition(" - ")
                    e["title"] = f"{head} Extended{sep}{rest}"
                    if not any("xtended version" in x for x in e.get("notes") or []):
                        e["notes"] = (e.get("notes") or []) + [
                            "This extended version restores scenes One Pace cuts from the regular release. Pick \"Extended\" on One Pace."]
                    switched.append(head)
    if switched:
        print(f"Extended: now using the extended version of {', '.join(switched)}")

    wano = next(n for s in data["sagas"] for n in s["nodes"] if n["id"] == "wano-country-arc")
    raid = [g for g in wano["groups"] if g["label"].startswith("One Pace - Onigashima Raid")]
    raid_last = raid[-1]
    have = {int(m.group(1)) for g in raid for e in g["episodes"]
            for m in [re.search(r"#wano-(\d+)$", e["links"].get("onepace") or "")] if m}
    new = sorted(n for n in releases if n > max(have))
    if not new:
        print(f"Wano: One Pace is at wano-{max(have)}, nothing new")
        if switched:
            with open(DATA, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        return

    # Pace numbers: the new releases continue after the last Raid episode; later ones shift.
    start = raid_last["episodes"][-1]["paceNumber"] + 1
    by = len(new)
    for s in data["sagas"]:
        s["pace"] = shift_pace_text(s.get("pace"), start, by)
        for n in s["nodes"]:
            n["pace"] = shift_pace_text(n.get("pace"), start, by)
            for g in n["groups"]:
                if g.get("info") and g["info"].get("text"):
                    g["info"]["text"] = shift_pace_text(g["info"]["text"], start, by)
                for e in g["episodes"]:
                    if e.get("paceNumber") and e["paceNumber"] >= start:
                        e["paceNumber"] += by
                    for k in ("pace", "meta"):
                        e[k] = shift_pace_text(e.get(k), start, by)

    template = raid_last["episodes"][-1]
    for i, n in enumerate(new):
        r = releases[n]
        num = start + i
        e = {k: None for k in template}
        e.update({
            "title": f"Onigashima Raid {n - RAID_FIRST_SLUG + 1:02d} - {r['title']}",
            "fullTitle": r["title"], "pace": f"Pace {num}", "paceNumber": num,
            "anime": r["anime"] or None, "chapters": r["chapters"] or None,
            "meta": f"Pace {num} • Anime {r['anime']} • Ch. {r['chapters']}",
            "links": {"onepace": f"https://onepace.net/en/watch#wano-{n}", "stremio": None, "netflix": None,
                      "mega": None, "drive": None, "nyaa": None, "other": None},
            "canon": True, "id": f"one-pace-onigashima-raid:wano-{n}", "notes": [],
        })
        for k in ("traktEpisode", "traktAnime", "traktRating", "traktVotes", "traktRatingFrom", "runtime", "runtimeSource"):
            e.pop(k, None)
        raid_last["episodes"].append(e)
    total = sum(len(g["episodes"]) for g in raid)
    raid_last["label"] = re.sub(r"\(\d+–\d+\)", f"(12–{total})", raid_last["label"])

    # Onigashima Paced episodes now covered by One Pace move to the overlapping section.
    one_pace_last = max(last_number(e.get("chapters")) for g in raid for e in g["episodes"])
    overlap = next(g for g in wano["groups"] if g.get("version") == "wano:paced")
    rest = next(g for g in wano["groups"] if g["label"].startswith("Onigashima Paced - Onigashima (") and not g.get("version"))
    moved = [e for e in rest["episodes"] if last_number(e.get("chapters")) <= one_pace_last]
    if moved:
        overlap["episodes"] += moved
        rest["episodes"] = rest["episodes"][len(moved):]
        k = len(overlap["episodes"])
        overlap["label"] = f"Onigashima Paced - Onigashima (01–{k})"
        rest["label"] = f"Onigashima Paced - Onigashima ({k + 1}–{k + len(rest['episodes'])})"

    data["meta"]["paceNumberedCount"] = data["meta"].get("paceNumberedCount", 0) + by
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Wano: added One Pace wano-{new[0]}..{new[-1]}; {len(moved)} Onigashima Paced episodes are now the alternative")


if __name__ == "__main__":
    main()
