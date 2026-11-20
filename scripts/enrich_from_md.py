#!/usr/bin/env python3
"""Merge structural details from the Markdown guide into src/data/data.json.

data.json is the hand-maintained source of truth (it carries refreshed ratings and the
spoiler-free descriptions), so instead of regenerating it this script re-parses the
Markdown to a temporary file and copies over only:

  * group `info`         - each section's details table (spreadsheet, One Pace Web and
                           Stremio links, episode/chapter summary)
  * group `afterEpisode` - sections nested inside another one (e.g. the Monsters special in
                           the middle of Thriller Bark) are shown right after that episode

It also fixes canon flags for Return to Sabaody / Fish-Man Island, where the official
One Piece Log remaster is the main version and One Pace is the alternative.

Usage:  python3 -I scripts/enrich_from_md.py
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")
PARSER = os.path.join(ROOT, "scripts", "parse_md_to_json.py")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        fresh_path = os.path.join(tmp, "fresh.json")
        subprocess.run([sys.executable, "-I", PARSER, "--out", fresh_path], check=True, stdout=subprocess.DEVNULL)
        fresh = json.load(open(fresh_path, encoding="utf-8"))
    data = json.load(open(DATA, encoding="utf-8"))

    # Episodes that close their section: nesting after one of these is just "at the end",
    # so those sections stay separate instead of being inlined.
    last_ids = {
        g["episodes"][-1]["id"]
        for s in fresh["sagas"] for n in s["nodes"] for g in n["groups"] if g["episodes"]
    }

    info_n = inline_n = canon_n = 0
    for s_new, s_old in zip(fresh["sagas"], data["sagas"], strict=True):
        for n_new, n_old in zip(s_new["nodes"], s_old["nodes"], strict=True):
            if n_new["id"] != n_old["id"]:
                sys.exit(f"structure mismatch: {n_new['id']} vs {n_old['id']}")
            for g_new, g_old in zip(n_new["groups"], n_old["groups"], strict=True):
                if g_new["id"] != g_old["id"]:
                    sys.exit(f"structure mismatch: {g_new['id']} vs {g_old['id']}")
                if g_new.get("info"):
                    g_old["info"] = g_new["info"]
                    info_n += 1
                anchor = g_new.get("afterEpisode")
                if anchor and anchor not in last_ids:
                    g_old["afterEpisode"] = anchor
                    inline_n += 1
                else:
                    g_old.pop("afterEpisode", None)

                # Canon route fixes.
                label = g_old["label"]
                if g_old["kind"] == "log" and not g_old["isAlternative"]:
                    g_old["canonPath"] = True
                elif label.startswith("Fixed Fish-Man Island") or "(Fixed Group Shot)" in label:
                    # Fixed variants of One Pace episodes live inside the alternative path.
                    g_old["canonPath"] = False
                    g_old["isAlternative"] = True
                for ep in g_old["episodes"]:
                    want = bool(g_old["canonPath"] and not g_old["isAlternative"])
                    if ep.get("canon") != want:
                        ep["canon"] = want
                        canon_n += 1

    data["meta"]["canonPathCount"] = sum(
        1 for s in data["sagas"] for n in s["nodes"] for g in n["groups"] for e in g["episodes"] if e["canon"]
    )
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"info tables: {info_n}  inline sections: {inline_n}  canon flags changed: {canon_n}")
    print(f"canon route episodes now: {data['meta']['canonPathCount']}")


if __name__ == "__main__":
    main()
