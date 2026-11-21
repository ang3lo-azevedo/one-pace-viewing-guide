#!/usr/bin/env python3
"""Guard episode ids, which are the keys of everyone's saved progress.

Runs at the start of every build and fails it if:
  * two episodes share an id (they would share one checkbox), or
  * an id listed in src/data/episode-ids.lock.json no longer exists and is not mapped to a
    new id in data.json `meta.idAliases` (that episode would silently drop out of
    everyone's progress).

To rename an id on purpose, add {"old-id": "new-id"} to meta.idAliases (the site migrates
saved progress through it), then refresh the lock:

    python3 -I scripts/check_ids.py --update
"""
import json
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
LOCK = os.path.join(ROOT, "src", "data", "episode-ids.lock.json")


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    ids = [e["id"] for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"]]
    current = set(ids)
    aliases = data["meta"].get("idAliases", {})

    dups = [i for i, c in Counter(ids).items() if c > 1]
    if dups:
        sys.exit(f"duplicate episode ids: {dups}")

    if "--update" in sys.argv or not os.path.exists(LOCK):
        with open(LOCK, "w", encoding="utf-8") as f:
            json.dump(sorted(current), f, ensure_ascii=False, indent=0)
        print(f"episode id lock written ({len(current)} ids)")
        return

    locked = set(json.load(open(LOCK, encoding="utf-8")))
    missing = []
    for old in sorted(locked - current):
        new = aliases.get(old)
        if new not in current:
            missing.append(old)
    if missing:
        sys.exit(
            "episode ids disappeared (saved progress would be lost):\n  "
            + "\n  ".join(missing)
            + "\nMap them in data.json meta.idAliases or run: python3 -I scripts/check_ids.py --update"
        )
    added = len(current - locked)
    print(f"episode ids OK ({len(current)} ids{f', {added} new' if added else ''})")


if __name__ == "__main__":
    main()
