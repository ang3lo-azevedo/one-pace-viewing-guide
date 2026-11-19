#!/usr/bin/env python3
"""One-time (re-runnable) seeder: parse one_pace_viewing_guide.md -> src/data/data.json.

The Markdown is highly regular, so a stack-based line scanner is enough:

  Saga   : `N.  <details>`            (indent 0, outside blockquote)
  Node   : `N. <details>` / `-  <details>` / `<details>`  (indent >=4, outside blockquote)
  Group  : `> <details[ open]>`       (inside blockquote)
  Episode: `> - [ ]|[x] ...`          (inside blockquote)

Episodes attach to the innermost open group (an implicit group is created for
movie/special nodes that list bullets directly). After this seeding step the
generated data.json is the hand-editable source of truth.
"""
import json
import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_MD = os.path.join(ROOT, "one_pace_viewing_guide.md")
OUT_JSON = os.path.join(ROOT, "src", "data", "data.json")

TIERS = [
    {"min": 9.7, "label": "Masterpiece", "color": "#1DA1F2"},
    {"min": 9.0, "label": "Exceptional", "color": "#186A3B"},
    {"min": 8.0, "label": "Great", "color": "#28B463"},
    {"min": 7.0, "label": "Good", "color": "#F4D03F"},
    {"min": 0.0, "label": "Average", "color": "#F39C12"},
]

# ----------------------------------------------------------------------------- helpers

RATING_COLOR_RE = re.compile(r"\\color\{(#[0-9A-Fa-f]{6})\}\\text\{\(★\s*([0-9.]+)\)\}")
RATING_PLAIN_RE = re.compile(r"\(★\s*([0-9.]+)\)")
COLOR_STRIP_RE = re.compile(r"\$?\\color\{#[0-9A-Fa-f]{6}\}\\text\{\(★\s*[0-9.]+\)\}\$?")
SUMMARY_RE = re.compile(r"<summary>(.*?)</summary>")
LINK_RE = re.compile(r"\[\[([^\]]+)\]\]\(([^)]+)\)")
# Tooltip uses a non-greedy body so it tolerates nested unescaped quotes
# (e.g. `"They Call Him "Straw Hat" Luffy"`): it stops at the first `"` that
# is immediately followed by the closing `)`.
MD_LINK_RE = re.compile(r'^\[(?P<disp>[^\]]*)\]\((?P<url>[^\s)]+)(?:\s+"(?P<tt>.*?)")?\)')
PACE_NUM_RE = re.compile(r"\bPace\s+([0-9]+)\b")
META_KEYWORDS = ("Pace", "Anime", "Ch.", "Ch:", "Filler", "OVA", "Movie", "Novel",
                 "ONA", "Netflix", "Onigashima", "Kuma", "Shaved", "End of Wano",
                 "Fun Pace", "FunPace", "Original")


def tier_color(value):
    for t in TIERS:
        if value >= t["min"]:
            return t["color"]
    return TIERS[-1]["color"]


def slugify(text, fallback="x"):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or fallback


def extract_rating(text):
    """Return (value_float_or_None, color_or_None) and keep first match."""
    m = RATING_COLOR_RE.search(text)
    if m:
        return float(m.group(2)), m.group(1)
    m = RATING_PLAIN_RE.search(text)
    if m:
        v = float(m.group(1))
        return v, tier_color(v)
    return None, None


def clean_summary(raw):
    """Strip rating math, keep title and (meta) separate."""
    raw = COLOR_STRIP_RE.sub("", raw)
    rating, color = extract_rating(raw)
    # Remove a leading plain (★ x.x) too
    txt = RATING_PLAIN_RE.sub("", raw).strip()
    # Pull the first "(... • ...)" style meta parenthetical
    pace = anime = chapters = None
    meta_raw = None
    for pm in re.finditer(r"\(([^()]*)\)", txt):
        inner = pm.group(1)
        if any(k in inner for k in META_KEYWORDS) and ("•" in inner or "Pace" in inner or "Anime" in inner):
            meta_raw = inner
            break
    if meta_raw:
        pace, anime, chapters = split_meta(meta_raw)
        txt = txt.replace("(" + meta_raw + ")", "").strip()
    txt = re.sub(r"\s{2,}", " ", txt).strip(" •-")
    return txt, rating, color, pace, anime, chapters, meta_raw


def split_meta(meta_raw):
    pace = anime = chapters = None
    for part in meta_raw.split("•"):
        p = part.strip()
        low = p.lower()
        if low.startswith("anime"):
            anime = p[len("Anime"):].strip() or p
        elif low.startswith("ch."):
            chapters = p[len("Ch."):].strip()
        elif low.startswith("ch:"):
            chapters = p[len("Ch:"):].strip()
        elif ("pace" in low or low.startswith("onigashima") or low.startswith("end of wano")
              or low.startswith("kuma") or low.startswith("shaved")):
            pace = p
    return pace, anime, chapters


def group_kind(label):
    low = label.lower()
    if "netflix" in low:
        return "netflix", False
    if "fun pace" in low or "funpace" in low:
        return "funpace", False
    if "onigashima" in low or "end of wano" in low:
        return "onigashima", True
    if "kuma cut" in low or "shaved egghead" in low:
        return "kuma-shaved", True
    if "original anime continuation" in low:
        return "original-continuation", False
    if "original anime" in low:
        return "original", False
    if "one piece log" in low:
        return "log", False
    if "upcoming" in low:
        return "upcoming", False
    if "straw hat theatre" in low or "omnivorous" in low:
        return "theatre", False
    if "fixed" in low or "tweaked" in low:
        return "onepace", True
    if low.startswith("special") or low.startswith("tv special"):
        return "special", False
    if low == "filler" or low.startswith("filler"):
        return "filler", False
    if "one pace" in low:
        return "onepace", True
    return "other", False


def node_type(label):
    low = label.lower()
    if "movie" in low:
        return "movie"
    if low.startswith("special") or "special:" in low:
        return "special"
    if low.startswith("filler"):
        return "filler"
    if "one pace special" in low:
        return "special"
    if "upcoming" in low:
        return "upcoming"
    return "arc"

# ----------------------------------------------------------------------------- episode parse


def parse_episode(content):
    ep = {
        "title": None, "fullTitle": None, "rating": None, "tierColor": None,
        "pace": None, "paceNumber": None, "anime": None, "chapters": None,
        "meta": None, "description": None,
        "links": {"onepace": None, "stremio": None, "netflix": None,
                  "mega": None, "drive": None, "nyaa": None, "other": None},
    }
    # Primary markdown link at the start -> title + url + tooltip
    primary_url = None
    m = MD_LINK_RE.match(content)
    if m:
        ep["title"] = m.group("disp").strip()
        ep["fullTitle"] = (m.group("tt") or m.group("disp")).strip()
        primary_url = m.group("url")
        rest = content[m.end():]
    else:
        rest = content

    # Secondary [[Label]](url) links
    for lm in LINK_RE.finditer(content):
        assign_link(ep["links"], lm.group(1), lm.group(2))
    content_wo_links = LINK_RE.sub("", content)

    # Primary link slot (depends on host)
    if primary_url:
        assign_primary(ep["links"], primary_url)

    # Rating
    rating, color = extract_rating(content)
    ep["rating"] = rating
    ep["tierColor"] = color

    # Metadata parenthetical: last "(...)" containing a meta keyword
    meta_raw = None
    for pm in re.finditer(r"\(([^()]*)\)", content_wo_links):
        inner = pm.group(1)
        if any(k in inner for k in META_KEYWORDS):
            meta_raw = inner
    if meta_raw:
        ep["meta"] = meta_raw
        ep["pace"], ep["anime"], ep["chapters"] = split_meta(meta_raw)
        pn = PACE_NUM_RE.search(meta_raw)
        if pn:
            ep["paceNumber"] = int(pn.group(1))

    # Plain-text title (non-linked movie/special rows). Cut at the rating or the
    # metadata parenthetical -- NOT at ": " (titles like "Movie 06: Baron..." use it).
    if not ep["title"]:
        plain = content_wo_links
        cuts = []
        mr = re.search(r"\$?\\color|\(★", plain)
        if mr:
            cuts.append(mr.start())
        if meta_raw:
            idx = plain.find("(" + meta_raw)
            if idx != -1:
                cuts.append(idx)
        cut = min(cuts) if cuts else len(plain)
        title = plain[:cut].strip().strip("*").strip(" •")
        ep["title"] = re.sub(r"\s{2,}", " ", title) or "Untitled"
        ep["fullTitle"] = ep["title"]

    # Trailing description after ": " or ") - " following the meta
    desc = None
    tail = content_wo_links
    if meta_raw:
        after = tail.split("(" + meta_raw + ")", 1)
        if len(after) == 2:
            tail = after[1]
    dm = re.search(r"(?::\s+|\s-\s+)(.*)$", tail)
    if dm:
        cand = COLOR_STRIP_RE.sub("", dm.group(1)).strip()
        cand = re.sub(r"\s{2,}", " ", cand)
        if len(cand) > 3:
            desc = cand
    ep["description"] = desc
    return ep


def assign_primary(links, url):
    if "onepace.net" in url:
        links["onepace"] = url
    elif "stremio" in url:
        if not links["stremio"]:
            links["stremio"] = url
    elif "drive.google" in url:
        links["drive"] = links["drive"] or url
    elif "mega.nz" in url:
        links["mega"] = links["mega"] or url
    elif "nyaa" in url:
        links["nyaa"] = links["nyaa"] or url
    else:
        links["other"] = links["other"] or url


def assign_link(links, label, url):
    low = label.lower()
    if "stremio" in low:
        links["stremio"] = links["stremio"] or url
    elif "netflix" in low:
        links["netflix"] = links["netflix"] or url
    elif "mega" in low:
        links["mega"] = links["mega"] or url
    elif "drive" in low:
        links["drive"] = links["drive"] or url
    elif "nyaa" in low:
        links["nyaa"] = links["nyaa"] or url
    else:
        links["other"] = links["other"] or url

# ----------------------------------------------------------------------------- main scan


def main():
    with open(SRC_MD, encoding="utf-8") as f:
        lines = f.read().splitlines()

    sagas = []
    stack = []  # entries: {"type": saga|node|group, "obj": ...}
    saga_ids = {}
    node_counter = 0
    warnings = []

    def cur(type_):
        for e in reversed(stack):
            if e["type"] == type_:
                return e["obj"]
        return None

    def top():
        return stack[-1] if stack else None

    for ln, raw in enumerate(lines, 1):
        stripped = raw.strip()
        if not stripped:
            continue
        in_bq = stripped.startswith(">")
        body = stripped.lstrip(">").strip() if in_bq else stripped
        indent = len(raw) - len(raw.lstrip(" "))

        # ---- close ----
        if body.startswith("</details>"):
            if stack:
                stack.pop()
            continue

        # ---- details open ----
        if "<details" in body and "<summary" not in body:
            sm = None
            # summary may be on the same logical block; look ahead a few lines
            for look in range(ln, min(ln + 3, len(lines))):
                mm = SUMMARY_RE.search(lines[look].strip().lstrip(">"))
                if mm:
                    sm = mm.group(1)
                    break
            default_open = "open" in body
            if not in_bq and indent == 0:
                # Saga
                title, rating, color, pace, anime, chapters, _ = clean_summary(sm or "Saga")
                sid = slugify(title, "saga")
                if sid in saga_ids:
                    sid = f"{sid}-{len(saga_ids)}"
                saga_ids[sid] = True
                obj = {"id": sid, "title": title, "rating": rating,
                       "pace": pace, "anime": anime, "chapters": chapters, "nodes": []}
                sagas.append(obj)
                # reset stack to this saga
                stack[:] = [{"type": "saga", "obj": obj}]
            elif not in_bq and indent >= 4:
                # Node (arc / movie / special / filler)
                nonlocal_saga = cur("saga")
                if nonlocal_saga is None:
                    warnings.append(f"L{ln}: node without saga")
                    continue
                title, rating, color, pace, anime, chapters, _ = clean_summary(sm or "Node")
                node_counter += 1
                ntype = node_type(sm or title)
                node_alt = "alternative" in (sm or "").lower()
                obj = {"id": slugify(title, f"node-{node_counter}"), "type": ntype,
                       "title": title, "rating": rating, "pace": pace,
                       "anime": anime, "chapters": chapters,
                       "isAlternative": node_alt, "groups": []}
                nonlocal_saga["nodes"].append(obj)
                # pop back to saga level then push node
                while stack and stack[-1]["type"] != "saga":
                    stack.pop()
                stack.append({"type": "node", "obj": obj})
            else:
                # Group (inside blockquote)
                node = cur("node")
                if node is None:
                    warnings.append(f"L{ln}: group without node")
                    continue
                label, rating, color, pace, anime, chapters, _ = clean_summary(sm or "Group")
                kind, canon_path = group_kind(label)
                is_alt = "(alternative)" in (sm or "").lower() or "alternative" in label.lower()
                obj = {"id": slugify(label, f"group-{len(node['groups'])}"),
                       "label": label, "kind": kind, "canonPath": canon_path and not is_alt,
                       "isAlternative": is_alt, "defaultOpen": default_open,
                       "rating": rating, "notes": [], "episodes": []}
                node["groups"].append(obj)
                stack.append({"type": "group", "obj": obj})
            continue

        # ---- episode ----
        em = re.match(r"- \[( |x|X)\]\s*(.*)", body)
        if em and in_bq:
            node = cur("node")
            if node is None:
                warnings.append(f"L{ln}: episode without node")
                continue
            grp = top()
            if not grp or grp["type"] != "group":
                # implicit group for bullets directly under a node
                kind = node["type"] if node["type"] in ("movie", "special", "filler", "upcoming") else "onepace"
                canon_path = kind in ("onepace",)
                node_alt = node.get("isAlternative", False)
                grp_obj = {"id": slugify(node["title"], "group") + "-main",
                           "label": node["title"], "kind": kind,
                           "canonPath": canon_path and not node_alt,
                           "isAlternative": node_alt, "defaultOpen": True,
                           "rating": node.get("rating"), "notes": [], "episodes": []}
                node["groups"].append(grp_obj)
                stack.append({"type": "group", "obj": grp_obj})
                grp = top()
            group_obj = grp["obj"]
            ep = parse_episode(em.group(2))
            ep["canon"] = bool(group_obj["canonPath"] and not group_obj["isAlternative"])
            ep["id"] = make_ep_id(group_obj, ep)
            group_obj["episodes"].append(ep)
            continue

        # ---- note sub-bullet or group note ----
        note_m = re.match(r"-\s+(?:Note:\s*)?(.*)", body) if in_bq else None
        if note_m and in_bq:
            grp = top()
            text = re.sub(r"\s{2,}", " ", note_m.group(1)).strip()
            if text:
                if grp and grp["type"] == "group" and grp["obj"]["episodes"]:
                    grp["obj"]["episodes"][-1].setdefault("notes", []).append(text)
                elif grp and grp["type"] == "group":
                    grp["obj"]["notes"].append(text)
            continue
        if in_bq and body.startswith("Note:"):
            grp = top()
            if grp and grp["type"] == "group":
                grp["obj"]["notes"].append(body[len("Note:"):].strip())
            continue

    data = {
        "meta": {
            "generatedFrom": "one_pace_viewing_guide.md",
            "generatedAt": date.today().isoformat(),
            "tiers": TIERS,
        },
        "sagas": sagas,
    }

    # ---- stats ----
    n_nodes = sum(len(s["nodes"]) for s in sagas)
    all_eps, canon_eps, pace_eps = 0, 0, 0
    pace_numbers = set()
    for s in sagas:
        for n in s["nodes"]:
            for g in n["groups"]:
                for e in g["episodes"]:
                    all_eps += 1
                    if e["canon"]:
                        canon_eps += 1
                    if g["kind"] == "onepace" and e.get("paceNumber"):
                        pace_eps += 1
                        pace_numbers.add(e["paceNumber"])
    data["meta"]["sagaCount"] = len(sagas)
    data["meta"]["nodeCount"] = n_nodes
    data["meta"]["episodeCount"] = all_eps
    data["meta"]["canonPathCount"] = canon_eps
    data["meta"]["paceNumberedCount"] = len(pace_numbers)

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Wrote {OUT_JSON}")
    print(f"  sagas={len(sagas)} nodes={n_nodes} episodes={all_eps}")
    print(f"  canon-path episodes={canon_eps}  pace-numbered (official 472 set)={len(pace_numbers)}")
    if pace_numbers:
        print(f"  pace range: {min(pace_numbers)}..{max(pace_numbers)}")
    if warnings:
        print(f"  WARNINGS ({len(warnings)}):")
        for w in warnings[:20]:
            print("   -", w)


def make_ep_id(group_obj, ep):
    base = None
    url = ep["links"].get("onepace") or ep["links"].get("stremio")
    if url and "#" in url:
        base = url.rsplit("#", 1)[-1]
    elif url:
        base = url.rstrip("/").rsplit("/", 1)[-1]
    if not base:
        base = slugify(ep["title"] or "ep")
    return f"{group_obj['id']}:{base}"


if __name__ == "__main__":
    main()
