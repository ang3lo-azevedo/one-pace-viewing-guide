# One Pace Viewing Guide

A viewing guide for [One Pace](https://onepace.net), the fan edit that re-paces the
One Piece anime to match the manga. Check off episodes as you watch and keep track of
where you are.

Built with SolidJS, Vite, TypeScript and Tailwind CSS. There is no backend: progress
is kept in the browser's `localStorage` and can be exported or imported as JSON.

## Features

- Per-episode progress, saved locally, with JSON export and import.
- Progress dashboard: canon progress, sagas cleared, hours watched and remaining.
- Canon-only vs. full list toggle (hide or show Movies, OVAs, Specials, Live Action, Fun Pace).
- Search across titles, anime episode numbers and manga chapters.
- SeriesGraph rating badges and a rating-tier filter.
- Stream toggle for default links (One Pace Web or Stremio).
- Abbreviated titles that reveal the full title on hover or focus, to avoid spoilers.
- Responsive layout with light and dark themes.

## Data

`src/data/data.json` holds the episode data and is the file to edit going forward. It
was generated once from the older Markdown guide (`one_pace_viewing_guide.md`) by
`scripts/parse_md_to_json.py`. To regenerate it from the Markdown:

```bash
npm run data        # python3 -I scripts/parse_md_to_json.py
```

### Ratings

Ratings come from [SeriesGraph](https://seriesgraph.com/show/37854-one-piece). Each
entry records the anime episode(s) it adapts, so a rating is the mean of the SeriesGraph
IMDb rating of those anime episodes, rounded to one decimal. Refresh them in place with:

```bash
npm run ratings     # python3 -I scripts/fetch_ratings.py
```

This updates episode, arc and saga ratings (and their tier colors) from SeriesGraph's
API. Live Action, movie and other entries without One Piece anime episode numbers keep
their existing ratings.

## Develop

```bash
npm install
npm run dev         # local dev server
npm run build       # type-check and production build to dist/
npm run preview     # preview the production build
```

## Deploy (GitHub Pages)

The site is static. `.github/workflows/deploy.yml` builds it and publishes it to Pages
on every push to `main`. In the repository, set Settings > Pages > Source to
"GitHub Actions". Vite's `base` is `./`, so the build works under any repository path
without hard-coding the repository name.
