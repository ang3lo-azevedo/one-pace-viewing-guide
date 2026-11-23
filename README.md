# One Pace Viewing Guide

A viewing guide for [One Pace](https://onepace.net), the fan edit that re-paces the
One Piece anime to match the manga. Check off episodes as you watch and keep track of
where you are.

Built with SolidJS, Vite, TypeScript and Tailwind CSS. There is no backend: progress
is kept in the browser's `localStorage` and can be exported or imported as JSON.

## Features

- Per-episode progress, saved locally, with JSON export and import.
- Progress dashboard: canon progress, sagas cleared, hours watched and remaining.
- Preferences: watch on One Pace or Stremio, spoiler-safe titles, theme (system, light or dark), which ratings to show, long times in days or hours; what to include (extras, non-canon, each kind of extra); pace a day, where the page opens, asking to rate on Trakt, confirming bulk marks.
- Separate hide non-canon option (the Live Action and canon specials are extras but stay), with Extra and Non-canon tags on every entry.
- Preferences section, with the choices also shown inside each affected section: pick the version of Fish-Man Island (One Piece Log or One Pace), The Adventures of the Straw Hats, G-8 and Boat Piece (Fun Pace or original anime), and where to watch Strong World (after Thriller Bark or after Post-War); Live Action placement (next to each arc, after Post-Enies Lobby, or after Thriller Bark).
- Egghead and Elbaph inside the Final Saga or as separate sections, and whether Catch up includes extras (also in Preferences).
- Search across titles, anime episode numbers and manga chapters.
- SeriesGraph rating badges and a rating-tier filter.
- Stream toggle for default links (One Pace Web or Stremio).
- Abbreviated titles that reveal the full title on hover or focus, to avoid spoilers.
- Responsive layout with light and dark themes.
- Continue watching: your next unwatched episode, with watch, mark watched and jump-to buttons.
- Rate an episode on Trakt right after marking it watched, from the list or the Continue watching card. Entries with few Trakt votes show the Trakt rating of the anime episodes they cover.
- Finish estimates at your recent pace (or Trakt history, or a pace you pick or type) for the whole list and every saga, arc and episode; long times shown in days and finish dates as weeks or months away; progress percentages by watch time.
- Counters for movies, specials, Live Action, filler and original anime. Alternative versions are optional and count the main version as done.
- Installable as an app (PWA) and usable offline once loaded.

## Data

`src/data/data.json` holds all episode data (sagas, arcs, sections, episodes, links,
notes and the details/sources for each section) and is the file to edit.

### Lengths

`npm run runtimes` (`scripts/fetch_runtimes.py`, also run before every build) adds each
entry's real length: One Pace episodes from onepace.net, movies, specials, Live Action and
original anime from Trakt, and Onigashima Paced, Kuma Cut / Shaved Egghead and Fun Pace from
their project spreadsheets. Entries without a published length fall back to an estimate.

### Ratings

Ratings come from [SeriesGraph](https://seriesgraph.com/show/37854-one-piece). Each
entry records the anime episode(s) it adapts, so a rating is the mean of the SeriesGraph
IMDb rating of those anime episodes, rounded to one decimal. Refresh them in place with:

```bash
npm run ratings     # python3 -I scripts/fetch_ratings.py
```

Each episode also shows its Trakt community rating (with vote count on hover) when it has
votes on Trakt (`npm run trakt-ratings`). All these refreshes run automatically before every build.

This updates episode, arc and saga ratings (and their tier colors) from SeriesGraph's
API. The Live Action gets its ratings from SeriesGraph's Live Action page, and films and
specials get theirs straight from IMDb's public ratings dataset
(`python3 -I scripts/fetch_imdb_ratings.py`), using the IMDb id from the Trakt mapping.

## Trakt sync (optional)

Connect a [Trakt](https://trakt.tv) account to sync watched episodes two ways. Login uses
**PKCE**, so there is no client secret and no server component; everything runs in the
browser. Configure it in `src/config.ts`:

- `traktClientId`: from your Trakt app at https://trakt.tv/oauth/applications
- `traktShowSlug`: the Trakt One Pace show slug (`one-pace`)

On the Trakt app, set the **Redirect URIs** to the site URL(s) and add them as **Allowed
origins** too (for browser CORS). Episodes are mapped to Trakt at build time: 466 of 472 One Pace releases map to the
Trakt One Pace show, and the Onigashima Paced, Kuma Cut / Shaved Egghead and One Piece Log
episodes sync to the original anime episodes they cover on Trakt's One Piece show. The **Connect Trakt** button is in the header; once connected, checking or bulk-marking
episodes syncs to Trakt, and watched episodes can be rated (1 to 10). Your watched
history is pulled from Trakt when the page opens and when you return to the tab (at
most every 5 minutes); pending changes are sent when the tab is hidden or closed.

### Episode ids

Each episode's `id` is the key of everyone's saved progress. `scripts/check_ids.py` runs at
the start of every build and fails it if an id is duplicated or disappears. To rename one
on purpose, add `"old-id": "new-id"` to `meta.idAliases` in `data.json` (saved progress is
migrated through it) and run `python3 -I scripts/check_ids.py --update`.

The site also rebuilds every Monday (scheduled workflow) so ratings stay current.

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
