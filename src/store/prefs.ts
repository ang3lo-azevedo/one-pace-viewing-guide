import { createStore } from 'solid-js/store';
import { createEffect, createRoot } from 'solid-js';

const KEY = 'op-prefs-v1';

export type StreamSource = 'onepace' | 'stremio';
export type Theme = 'dark' | 'light';
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
  theme: 'dark',
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed, search: '' }; // never persist search text as active
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
  setPrefs({ search: '', tierMin: null, sagaId: null, hideWatched: false, canonOnly: false, hiddenExtras: [] });
}

export function toggleExtra(cat: ExtraCategory) {
  const cur = prefs.hiddenExtras;
  setPrefs('hiddenExtras', cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat]);
}
