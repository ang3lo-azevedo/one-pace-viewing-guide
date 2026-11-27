#!/usr/bin/env python3
"""Mark non-canon entries in src/data/data.json (`nonCanon: true`).

"Canon" here means the story, not the main viewing route: the Live Action series and a
few specials are canon (and part of the main route: `canon: true`), while films and filler are not canon.

  * Filler of any kind (Fun Pace, anime filler, entries whose info says "Filler") and all
    films are non-canon.
  * Specials follow the guide's notes; CANON_SPECIALS lists the canon ones (written by Oda
    or adapted from canon material).
  * Upcoming films are left untagged until they are out.

Usage:  python3 -I scripts/canon_flags.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")

CANON_SPECIALS = ("Monsters: 103", "Pace Special: Strong World", "Wapol")


def non_canon(e, g, n):
    title, meta = e.get("title") or "", e.get("meta") or ""
    if g["kind"] in ("upcoming", "original-continuation", "netflix"):
        return False
    if g["kind"] in ("funpace", "filler", "movie") or n["type"] in ("movie", "filler"):
        return True
    if re.search(r"\bfiller\b", f"{title} {meta}", re.I):
        return True
    if g["kind"] in ("special", "theatre"):
        return not title.startswith(CANON_SPECIALS)
    return False


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    count = 0
    for s in data["sagas"]:
        for n in s["nodes"]:
            for g in n["groups"]:
                for e in g["episodes"]:
                    if non_canon(e, g, n):
                        e["nonCanon"] = True
                        count += 1
                    else:
                        e.pop("nonCanon", None)
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"non-canon entries: {count}")


if __name__ == "__main__":
    main()
