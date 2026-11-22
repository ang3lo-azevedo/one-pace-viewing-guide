import { For, Show, createSignal } from 'solid-js';
import { tiers } from '../lib/guide';

interface Source {
  name: string;
  url: string;
  what: string;
}

const SECTIONS: { title: string; items: Source[] }[] = [
  {
    title: 'Watching',
    items: [
      { name: 'One Pace', url: 'https://onepace.net/en/watch', what: 'Official One Pace player and release list. Default watch links point here.' },
      { name: 'Stremio Web', url: 'https://web.stremio.com', what: 'Alternative player for One Pace, the original anime, movies and Live Action.' },
      { name: 'One Piece Log', url: 'https://web.stremio.com/#/detail/series/tt33992229', what: 'Official remaster used as the main version of Fish-Man Island.' },
    ],
  },
  {
    title: 'Episode lists and watch order',
    items: [
      {
        name: 'One Pace episode guide (spreadsheet)',
        url: 'https://docs.google.com/spreadsheets/d/1HQRMJgu_zArp-sLnvFMDzOyjdsht87eFLECxMK858lA/edit?gid=0#gid=0',
        what: 'Arc, episode and manga chapter mapping for every One Pace release.',
      },
      {
        name: 'One Pace Watch Guide Companion',
        url: 'https://docs.google.com/document/d/1zYFrLPPS3FOYrz4MDyog8R9reAsGxOqM-Sxh2Y2EvXg/edit?tab=t.0#heading=h.7hgr1xkj23na',
        what: 'Community consensus on which movies, OVAs and specials are worth watching, and where.',
      },
      {
        name: 'One Pace Guide (r/OnePiece)',
        url: 'https://reddit.com/r/OnePiece/comments/16jsyop/one_pace_guide/',
        what: 'Community guide to One Pace with the recommended order for the films, specials and filler around it.',
      },
      { name: 'One Pace Dub Watch Guide', url: 'https://redd.it/1rtpukk', what: 'Use this instead if you watch the English dub. This guide assumes Japanese audio with subtitles.' },
      {
        name: 'Onigashima Paced (spreadsheet)',
        url: 'https://docs.google.com/spreadsheets/d/1HoYogAchoU5DWxVJzUy3eZcHMZk_hUmzUVnQm9KxeFI/edit?usp=sharing',
        what: 'Community edit used for the second half of Wano.',
      },
      {
        name: 'Kuma Cut + Shaved Egghead (spreadsheet)',
        url: 'https://docs.google.com/spreadsheets/d/1ODt-b2L9PyAr0xEWhj1yIOqp__crBFVXhvejblvP_mU/edit?usp=sharing',
        what: 'Community edits that continue Egghead past the latest One Pace release.',
      },
    ],
  },
  {
    title: 'Fun Pace (paced filler)',
    items: [
      {
        name: 'Fun Pace watch order (spreadsheet)',
        url: 'https://docs.google.com/spreadsheets/d/1LYxp1i5FldNiKdL8BKaQ3T8EeueCSpgDWvN51kCBcKI',
        what: 'Paced edits of filler arcs, for when you want the filler without the drag.',
      },
      { name: 'Fun Pace on Google Drive', url: 'https://drive.google.com/drive/folders/1wglxsln46TVM4LFOo4kVK910fyfl-fWS', what: 'Download folder.' },
      { name: 'Fun Pace on Mega', url: 'https://mega.nz/folder/D2AnVboT#jDllz0HMlVOVNBLdYxEmfQ', what: 'Download folder (mirror 1).' },
      { name: 'Fun Pace on Mega (2)', url: 'https://mega.nz/folder/GM9TAICA#8r9SaFgptfSWPSDBuzSknw', what: 'Download folder (mirror 2).' },
      { name: 'Fun Pace subtitles', url: 'https://github.com/ang3lo-azevedo/fun-pace-public-subtitles', what: 'Synced subtitle files.' },
    ],
  },
  {
    title: 'Ratings and tracking',
    items: [
      {
        name: 'SeriesGraph',
        url: 'https://seriesgraph.com/show/37854-one-piece',
        what: 'The star rating. Each entry is the average IMDb rating of the anime episodes it adapts. Arc and saga ratings average their One Pace episodes. Refreshed on every deploy.',
      },
      {
        name: 'Trakt',
        url: 'https://trakt.tv/shows/one-pace',
        what: 'The red "Trakt" badge is the community rating on Trakt (hover for the vote count). Connect your account to sync watched episodes both ways and rate episodes (your rating shows as a filled heart).',
      },
    ],
  },
];

export default function InfoPanel() {
  const [open, setOpen] = createSignal(false);
  return (
    <div class="card overflow-hidden">
      <button
        class="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-sea-100 dark:hover:bg-sea-800/40"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
      >
        <span class="text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
          ▶
        </span>
        <span class="font-display text-sm font-extrabold uppercase tracking-wide text-accent-600 dark:text-accent-400">About this guide & sources</span>
      </button>

      <Show when={open()}>
        <div class="space-y-5 border-t border-sea-200 px-4 py-4 text-sm dark:border-sea-800">
          <p class="text-sea-600 dark:text-sea-300">
            One Pace is a fan edit of the One Piece anime that removes filler, repeated flashbacks and padding to match
            the pacing of the manga. This guide follows the One Pace releases as the canon route and adds the movies,
            specials, OVAs and Live Action episodes the community considers worth watching, placed where they fit.
            Generic filler movies, recaps and crossovers are left out.
          </p>

          <ul class="space-y-1.5 text-xs text-sea-500 dark:text-sea-400">
            <li>
              <b class="text-sea-700 dark:text-sea-200">Spoiler-safe:</b> episode subtitles are hidden until you hover
              them. Turn it off in Preferences to see full titles.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Extra and Non-canon tags:</b> Extra is anything outside the
              One Pace route (films, specials, filler, Live Action, original anime). Non-canon is what is not part of
              the story (films, filler and most specials). The Live Action and a few specials are extras but still
              canon, so "Hide extras" and "Hide non-canon" are separate switches.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Live Action:</b> it introduces characters and reveals earlier
              than the anime. In Preferences you can keep each episode next to its arc, or move the whole show after
              Post-Enies Lobby or after Thriller Bark (the safest point).
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Final Saga:</b> Egghead and Elbaph can stay inside one Final
              Saga or be listed as separate sections, in Preferences.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Lengths:</b> real runtimes from onepace.net, Trakt (movies,
              specials, Live Action, original anime) and the Onigashima Paced, Kuma Cut and Fun Pace spreadsheets. The
              few without a published length are estimated and shown with "~". Hidden content types (Filters) are left out of
              the times and percentages. Percentages are by watch time, so a movie counts for more than a single
              episode.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Finish dates:</b> based on the watch time of episodes you
              checked in the last 28 days (or your Trakt history when connected). You can also pick or type a pace a
              day, like 90, 1h30 or 2 eps. Each remaining episode, arc and saga shows when you'd reach it at that pace.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Versions:</b> in Preferences, pick the One Piece Log or One Pace
              for Fish-Man Island, and Fun Pace or the original anime for filler like G-8.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Alternative versions</b> are optional and never count as
              remaining. Watching an alternative instead (for example the original anime episodes of G-8) also counts
              the main version as done.
            </li>
            <li>
              <b class="text-sea-700 dark:text-sea-200">Progress</b> is stored in this browser only. Use the Progress menu
              in the header to export or import it, or connect Trakt to sync it and rate episodes after watching.
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <span class="font-semibold text-sea-500 dark:text-sea-400">Rating tiers:</span>
            <For each={tiers}>
              {(t, i) => (
                <span class="rounded-md px-1.5 py-0.5 font-semibold" style={{ 'background-color': t.color + '26', color: t.color }}>
                  {t.label} {i() === 0 ? `${t.min}+` : i() === tiers.length - 1 ? `< ${tiers[i() - 1].min}` : `${t.min}+`}
                </span>
              )}
            </For>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <For each={SECTIONS}>
              {(sec) => (
                <div>
                  <h4 class="mb-1.5 text-xs font-bold uppercase tracking-wide text-sea-400">{sec.title}</h4>
                  <ul class="space-y-1.5">
                    <For each={sec.items}>
                      {(s) => (
                        <li class="text-xs">
                          <a href={s.url} target="_blank" rel="noopener noreferrer" class="font-semibold text-accent-500 hover:underline dark:text-accent-300">
                            {s.name}
                          </a>
                          <span class="text-sea-500 dark:text-sea-400"> · {s.what}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
