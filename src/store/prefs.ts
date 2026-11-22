import { createStore } from 'solid-js/store';
import { createEffect, createRoot } from 'solid-js';
import { saveView } from '../lib/restore';
import { readVersions, type Versions } from '../lib/versions';

const KEY = 'op-prefs-v1';

export type StreamSource = 'onepace' | 'stremio';
export type Theme = 'dark' | 'light';
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

  // Keep the <html> dark class in sync with the theme preference.
  createEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  });
});

export { prefs, setPrefs };

export function toggleTheme() {
  setPrefs('theme', prefs.theme === 'dark' ? 'light' : 'dark');
}

export function resetFilters() {
  setPrefs({ search: '', tierMin: null, sagaId: null, hideWatched: false, canonOnly: false, hiddenExtras: [], hideNonCanon: false });
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
