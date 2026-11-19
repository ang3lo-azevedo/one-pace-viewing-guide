# Roadmap & TODOs

## [x] Move Viewing Guide to GitHub Pages

Status: done. The web app (SolidJS, Vite, TypeScript, Tailwind) is live at
https://ang3lo-azevedo.github.io/one-pace-viewing-guide/ and deploys from
`.github/workflows/deploy.yml`. Episode data lives in `src/data/data.json`, generated
from the Markdown by `scripts/parse_md_to_json.py`. See `README.md` for setup.

### Objective
Migrate the One Pace Viewing Guide from a static Markdown file into an interactive web application hosted via GitHub Pages.

### Motivation & Key Features
- **Bypass GitHub Markdown Limits:** Overcome GitHub's rendering limits on MathJax/LaTeX expressions and deep HTML `<details>` indentation.
- **Client-Side Progress Persistence:** Check off watched episodes with instant auto-save in browser `localStorage`, plus import/export functionality for backups across devices.
- **Dynamic Content Filtering:**
  - One-click toggle between **One Pace Canon Only** (472 episodes) and **Full Curated Experience** (including Movies, OVAs, and Specials).
  - Filter by Saga, Arc, or SeriesGraph Rating Tier (★ 9.7+ Masterpiece, ★ 9.0–9.6 Exceptional, etc.).
  - Instant text search across episode titles, anime episode numbers, and manga chapters.
- **Stream Preferences:**
  - One-click toggle for default streaming source (One Pace Web vs. Stremio Web).
  - Clean, spoiler-safe hover tooltips and rich episode preview cards.
- **Mobile & Desktop Responsive UI:** Lightweight, responsive design tailored for phone, tablet, and desktop viewing.
