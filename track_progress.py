import re
import sys

FILE = 'one_pace_viewing_guide.md'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Calculate overall checklist items
total_checked = len(re.findall(r'>\s*-\s*\[x\]', content, re.IGNORECASE))
total_unchecked = len(re.findall(r'>\s*-\s*\[ \]', content))
total_all = total_checked + total_unchecked
total_pct = (total_checked / total_all * 100) if total_all else 0.0

# 2. Calculate One Pace specific episodes
lines = [l for l in content.splitlines() if '> - [' in l]
fixed_pairs = [
    ('Fixed Fish-Man Island 07', 'https://onepace.net/en/watch#fishman-island-07'),
    ('Fixed Group Shot', 'https://onepace.net/en/watch#fishman-island-15'),
    ('Tweaked Punk Hazard 20', 'https://onepace.net/en/watch#punk-hazard-20'),
]
pair_keys = [p[1] for p in fixed_pairs]

std_pace = [l for l in lines if 'https://onepace.net/en/watch#' in l and 'Pace ' in l and not any(k in l for k in pair_keys)]
std_checked = sum(1 for l in std_pace if '- [x]' in l.lower())

pair_checked = 0
for fixed_name, pace_url in fixed_pairs:
    f_line = next((l for l in lines if fixed_name in l), None)
    p_line = next((l for l in lines if pace_url in l), None)
    if (f_line and '- [x]' in f_line.lower()) or (p_line and '- [x]' in p_line.lower()):
        pair_checked += 1

pace_checked = std_checked + pair_checked
pace_total = len(std_pace) + len(fixed_pairs)
pace_unchecked = pace_total - pace_checked
pace_pct = (pace_checked / pace_total * 100) if pace_total else 0.0

def make_bar(pct, length=20):
    filled = int(round(length * (pct / 100.0)))
    return '█' * filled + '░' * (length - filled)

pace_bar = make_bar(pace_pct)
all_bar = make_bar(total_pct)

print("=== Viewing Progress Summary ===")
print(f"One Pace Canon: {pace_checked} watched, {pace_unchecked} missing, {pace_total} total ({pace_pct:.1f}%) [{pace_bar}]")
print(f"All Items:      {total_checked} watched, {total_unchecked} missing, {total_all} total ({total_pct:.1f}%) [{all_bar}]")

# Build Markdown block
tracker_block = f"""> [!TIP]
> **Viewing Progress Tracker:**
>
> | Category | Watched | Missing | Total | Progress |
> | :--- | :---: | :---: | :---: | :---: |
> | **One Pace (Canon)** | **{pace_checked}** | **{pace_unchecked}** | **{pace_total}** | `{pace_bar}` **{pace_pct:.1f}%** |
> | **All Content (incl. Movies/Fillers)** | **{total_checked}** | **{total_unchecked}** | **{total_all}** | `{all_bar}` **{total_pct:.1f}%** |
>
> Check off episodes (`- [x]`) as you watch. Run `python3 track_progress.py` to recalculate your progress automatically!"""

# Insert or update tracker block at the bottom
content = re.sub(r'\n*> \[!TIP\]\s*\n>\s*\*\*Viewing Progress Tracker:\*\*[\s\S]*?(?=\n\n> \[!|\n\n---)', '', content)
content = re.sub(r'\n*---\n*> \[!TIP\]\s*\n>\s*\*\*Viewing Progress Tracker:\*\*[\s\S]*\Z', '', content.rstrip())
content = content.rstrip() + '\n\n---\n\n' + tracker_block + '\n'

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nSuccessfully updated {FILE} with live progress stats.")
