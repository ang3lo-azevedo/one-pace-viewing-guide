#!/usr/bin/env python3
"""Rewrite movie/special/filler descriptions in data.json to be spoiler-free.

The original blurbs name future arcs, characters and events (e.g. "spoilers for
the climax of Wano", "Luffy and Uta's childhood"). Placement in the guide already
tells you *where* to watch each film, so the text only needs the film's identity and
a spoiler-free watch note. This replaces the known spoilery blurbs with safe ones and
strips any inline markdown links. Re-runnable and idempotent.

Usage:  python3 -I scripts/sanitize_descriptions.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "src", "data", "data.json")

# Matched on a distinctive substring of the current text -> spoiler-free replacement.
DESCRIPTION_FIXES = [
    ("chronicling legendary pirate history",
     "Canon prologue written by Eiichiro Oda. Watch right before Movie 10: Strong World."),
    ("Covers time skip training",
     "Covers the crew's training during the two-year time skip. Warning: the final few minutes contain spoilers for later arcs, so stop before the ending."),
    ("Watch immediately after reunion",
     "Acclaimed 2024 special directed by Megumi Ishitani. Watch at its placement in this guide."),
    ("celebrating the 20th anime anniversary",
     "All-star theatrical film celebrating the anime's 20th anniversary (2019)."),
    ("Prequel arc to Film Red detailing",
     "Short two-episode prequel to Movie 15: Film Red. Watch at its placement in this guide."),
    ("Contains major spoilers for the climax of Wano",
     "Warning: contains major spoilers for earlier arcs, so watch only at its placement in this guide."),
    ("fashion runway adventure",
     "Directed by Haruka Kamatani (One Piece: Fan Letter), with character designs by Takashi Kojima. Adapts Jun Esaka's spin-off novel. Watch at the start of the Final Saga."),
]

NOTE_FIXES = [
    ("Alternative Watch Placement",
     "Alternative placement: the original One Pace release of this prologue reveals later story details, so if you use it instead of the Fun Pace version, watch it at the alternative placement later in this guide."),
    ("Watch Order & Spoilers",
     "Watch order: this film fits right after the current arc. If you watch the anime tie-in prequel Little East Blue, use the Fun Pace version, as the original broadcast version reveals later story details. The film can also be saved for the alternative placement later in this guide."),
]

# Whole-entry fixes, matched on the start of the current title. The upcoming films were
# parsed with their full (spoilery) blurb as the title, so title and description are reset.
ENTRY_FIXES = [
    ("One Piece Film: God Valley",
     {"title": "One Piece Film: God Valley (2027)",
      "description": "Upcoming film for the manga's 30th anniversary. Watch at its placement in this guide once it is released."}),
    ("One Piece Film: BAAD",
     {"title": "One Piece Film: BAAD (2029)",
      "description": "Upcoming film for the anime's 30th anniversary. Watch at its placement in this guide once it is released."}),
]

# Spoilery phrases inside episode notes -> neutral wording (timestamps are kept).
PHRASE_FIXES = [
    ("to watch the Emperors' clash filler scene", "to watch an anime-only scene"),
    ("an extra minute of the Oden vs. Whitebeard clash exists", "an extra minute of a flashback fight exists"),
    ("an emotional duel in the snow is expanded", "a flashback duel is expanded"),
]

# Plain wording instead of promotional phrasing (substring -> replacement, in descriptions
# and notes). Facts such as directors, timestamps and episode numbers are kept.
WORDING_FIXES = [
    ('the iconic "Walk to Arlong Park" scene', 'the "Walk to Arlong Park" scene'),
    ("Fan-favorite early One Piece film.", "Early One Piece film, not canon."),
    ("Fan-favorite slice-of-life filler depicting daily life aboard the ship.",
     "Slice-of-life filler about daily life aboard the ship."),
    ("Fan-favorite theatrical film written directly by Eiichiro Oda.", "Theatrical film written by Eiichiro Oda."),
    ("Acclaimed 2024 special directed by Megumi Ishitani.", "2024 special directed by Megumi Ishitani."),
    ("Fan-favorite film overseen by Oda.", "Film with Eiichiro Oda as executive producer."),
    ("All-star theatrical film celebrating the anime's 20th anniversary (2019).",
     "Theatrical film for the anime's 20th anniversary (2019)."),
    ("**Extended Sakuga Climax:** Anime Episode 870 features legendary, world-class uncut animation for the arc's climactic battle. Watching the uncut original episode is highly recommended.",
     "**Longer fight:** Anime Episode 870 has more animation for the arc's final fight than One Pace keeps. Consider watching the original episode."),
    ("Watch Anime Ep 818 for expanded peak fight.", "Anime Episode 818 has a longer version of this fight."),
    ("**Megumi Ishitani Masterpiece:** Directed by Megumi Ishitani, Anime Episode 957 features movie-level storyboarding and cinematic direction covering the global aftermath of the Reverie. Highly recommended to experience uncut!",
     "**Directed by Megumi Ishitani:** Anime Episode 957 has film-like storyboarding for the news after the Reverie. Consider watching it uncut."),
    ("**Megumi Ishitani Masterpiece:** Directed by Megumi Ishitani, Anime Episode 982 features breathtaking theatrical direction and visual animation. Highly recommended to experience uncut!",
     "**Directed by Megumi Ishitani:** Anime Episode 982 has film-like direction and animation. Consider watching it uncut."),
    ("**Must-Watch in Original Anime:** Directed by Megumi Ishitani, Anime Episode 1015 is widely acclaimed as the single greatest episode in One Piece history. Watching the uncut original episode is strongly recommended for the best experience!",
     "**Directed by Megumi Ishitani:** Anime Episode 1015 is one of the highest-rated episodes of the anime. Consider watching the original episode uncut."),
    ("(expanded battle sequences and cinematic buildups)", "(expanded fight scenes)"),
]

MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def fix_text(text, fixes):
    if not text:
        return text
    for needle, replacement in fixes:
        if needle in text:
            return replacement
    # Strip any leftover inline markdown links: [label](url) -> label
    return MD_LINK.sub(r"\1", text)


def main():
    data = json.load(open(DATA, encoding="utf-8"))
    changed = 0
    for saga in data["sagas"]:
        for node in saga["nodes"]:
            for group in node["groups"]:
                for ep in group["episodes"]:
                    for prefix, fields in ENTRY_FIXES:
                        if (ep.get("title") or "").startswith(prefix) and ep.get("title") != fields["title"]:
                            ep["title"] = ep["fullTitle"] = fields["title"]
                            ep["description"] = fields["description"]
                            ep["notes"] = []
                            changed += 1
                    if ep.get("notes"):
                        fixed = []
                        for n in ep["notes"]:
                            for old, new in PHRASE_FIXES:
                                n = n.replace(old, new)
                            fixed.append(n)
                        if fixed != ep["notes"]:
                            ep["notes"] = fixed
                            changed += 1
                    for field in ("description",):
                        if ep.get(field):
                            v = ep[field]
                            for a, b in WORDING_FIXES:
                                v = v.replace(a, b)
                            if v != ep[field]:
                                ep[field] = v
                                changed += 1
                    if ep.get("notes"):
                        notes = ep["notes"]
                        for a, b in WORDING_FIXES:
                            notes = [n.replace(a, b) for n in notes]
                        if notes != ep["notes"]:
                            ep["notes"] = notes
                            changed += 1
                    new_desc = fix_text(ep.get("description"), DESCRIPTION_FIXES)
                    if new_desc != ep.get("description"):
                        ep["description"] = new_desc
                        changed += 1
                    if ep.get("notes"):
                        new_notes = [fix_text(n, NOTE_FIXES) for n in ep["notes"]]
                        if new_notes != ep["notes"]:
                            ep["notes"] = new_notes
                            changed += 1
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"sanitized {changed} descriptions/notes")


if __name__ == "__main__":
    main()
