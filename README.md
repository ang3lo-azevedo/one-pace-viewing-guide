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

Each episode also shows its Trakt community rating (with vote count on hover) when it has
votes on Trakt (`npm run trakt-ratings`). Both refreshes run automatically before every build.

This updates episode, arc and saga ratings (and their tier colors) from SeriesGraph's
API. Live Action, movie and other entries without One Piece anime episode numbers keep
their existing ratings.

## Trakt sync (optional)

Connect a [Trakt](https://trakt.tv) account to sync watched episodes two ways. Login uses
**PKCE**, so there is no client secret and no server component; everything runs in the
browser. Configure it in `src/config.ts`:

- `traktClientId`: from your Trakt app at https://trakt.tv/oauth/applications
- `traktShowSlug`: the Trakt One Pace show slug (`one-pace`)

On the Trakt app, set the **Redirect URIs** to the site URL(s) and add them as **Allowed
origins** too (for browser CORS). Episodes map to Trakt by title with a positional
fallback (~98% of the standard One Pace releases; Wano/Egghead-continuation cuts that use
Stremio-only links are not mapped). The **Connect Trakt** button is in the header; once connected, checking or bulk-marking
episodes syncs to Trakt, and watched episodes can be rated (1 to 10). Your watched
history is pulled from Trakt when the page opens and when you return to the tab (at
most every 5 minutes); pending changes are sent when the tab is hidden or closed.

### Arc details and placement

`npm run enrich` (`scripts/enrich_from_md.py`) copies each section's details table
(episode guide spreadsheet, One Pace Web and Stremio links) from the Markdown guide into
`data.json`, records sections that sit in the middle of an arc (like the Monsters special in
Thriller Bark), and marks the One Piece Log remaster as the canon route for Return to
Sabaody and Fish-Man Island. It only touches those fields, so ratings and the spoiler-free
descriptions are kept.

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
