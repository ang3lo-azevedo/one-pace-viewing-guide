import { createStore } from 'solid-js/store';
import { createEffect, createRoot, createSignal } from 'solid-js';
import { saveView } from '../lib/restore';
import { readVersions, type Versions } from '../lib/versions';

const KEY = 'op-prefs-v1';

export type StreamSource = 'onepace' | 'stremio' | 'netflix' | 'crunchyroll';
export type Theme = 'dark' | 'light' | 'system';
export type LiveActionPlacement = 'arc' | 'post-enies-lobby-arc' | 'thriller-bark-arc';
import type { ExtraCategory } from '../lib/guide';
export type { ExtraCategory };

export interface Prefs {
  canonOnly: boolean;
  streamSource: StreamSource;
  search: string;
  /** Minimum rating tier to show, or null for all. */
  tierMin: number | null;
  /** Saga id to focus on, or null for all. */
  sagaId: string | null;
  hideWatched: boolean;
  /** Hide spoilery episode subtitles (reveal on hover). */
  spoilerSafe: boolean;
  /** Extra content types hidden from the list and from progress. */
  hiddenExtras: ExtraCategory[];
  /** Minutes watched per day for finish dates, or null to use your recent history. */
  paceMinutes: number | null;
  /** Hide everything that is not story canon (films, filler, most specials). */
  hideNonCanon: boolean;
  /** Where the Live Action episodes go: next to each arc, or all together after an arc. */
  liveActionPlacement: LiveActionPlacement;
  /** Show Egghead and Elbaph as their own sections instead of inside the Final Saga. */
  splitFinalSaga: boolean;
  /** "Catch up" also marks the extras (films, specials, Live Action, filler) before that point. */
  catchUpExtras: boolean;
  /** Picked version per section (Fish-Man Island, G-8, Strong World...), see lib/versions.ts. */
  versions: Versions;
  theme: Theme;
  /** With spoiler-safe on: show the full titles of episodes you have watched. */
  revealWatched: boolean;
  /** Where the page opens: at your last watched episode, or at the top. */
  openAt: 'last' | 'top';
  /** Offer to rate on Trakt right after marking an episode watched. */
  askRate: boolean;
  /** Keep the preferences the same on all your devices through Trakt (see prefsSync.ts). */
  syncPrefs: boolean;
  /** Ask before Mark arc / Mark saga / Catch up and other bulk changes. */
  confirmBulk: boolean;
  /** Which ratings the badges show. */
  ratingsShown: 'both' | 'seriesgraph' | 'trakt';
  /** Long durations in days ("12d 1h") or hours ("289h"). */
  longTimes: 'days' | 'hours';
}

const DEFAULTS: Prefs = {
  canonOnly: false,
  streamSource: 'onepace',
  search: '',
  tierMin: null,
  sagaId: null,
  hideWatched: false,
  spoilerSafe: true,
  hiddenExtras: [],
  paceMinutes: null,
  hideNonCanon: false,
  liveActionPlacement: 'arc',
  splitFinalSaga: false,
  catchUpExtras: true,
  versions: readVersions({}),
  theme: 'dark',
  revealWatched: true,
  openAt: 'last',
  askRate: true,
  syncPrefs: false,
  confirmBulk: true,
  ratingsShown: 'both',
  longTimes: 'days',
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, versions: readVersions(parsed), search: '' }; // never persist search text as active
  } catch {
    return { ...DEFAULTS };
  }
}

const [prefs, setPrefs] = createStore<Prefs>(load());

createRoot(() => {
  createEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  });

  // Keep the <html> dark class in sync with the theme preference ("system" follows the device).
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const [systemDark, setSystemDark] = createSignal(media.matches);
  media.addEventListener('change', (e) => setSystemDark(e.matches));
  createEffect(() => {
    const dark = prefs.theme === 'system' ? systemDark() : prefs.theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
  });
});

export { prefs, setPrefs };

/** Whether the page is dark right now (resolves "system"). */
export const isDark = () => document.documentElement.classList.contains('dark');

/** Header button: switch to the opposite of what is showing now. */
export function toggleTheme() {
  setPrefs('theme', isDark() ? 'light' : 'dark');
}

export function resetFilters() {
  // Only the view filters: what to include (extras, non-canon, content types) is a preference.
  setPrefs({ search: '', tierMin: null, sagaId: null, hideWatched: false });
}

export function toggleExtra(cat: ExtraCategory) {
  const cur = prefs.hiddenExtras;
  setPrefs('hiddenExtras', cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]);
}

/** Change a version (it reshapes the guide data, applied at load), then reload keeping your place. */
export function setVersion(key: string, value: string) {
  if (prefs.versions[key] === value) return;
  setPrefs('versions', key, value);
  saveView();
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...prefs, versions: { ...prefs.versions, [key]: value } }));
  } catch {
    /* ignore */
  }
  location.reload();
}
