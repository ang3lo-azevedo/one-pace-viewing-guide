import { createStore, produce } from 'solid-js/store';
import { createEffect, createRoot } from 'solid-js';
import { guide } from '../lib/guide';

/** Renamed episode ids (old -> new), so saved progress survives id changes. */
const ALIASES: Record<string, string> = (guide.meta as { idAliases?: Record<string, string> }).idAliases ?? {};
const migrate = (id: string) => ALIASES[id] ?? id;

const KEY = 'op-progress-v1';

/**
 * Watched episodes -> when they were marked (ms epoch). `UNKNOWN` (1) means watched at an
 * unknown time (older saves, Trakt pulls, imports); those don't count toward your pace.
 */
type WatchedMap = Record<string, number>;
export const UNKNOWN = 1;

function load(): WatchedMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return Object.fromEntries(parsed.map((id: string) => [migrate(id), UNKNOWN])); // legacy
    const map = (parsed && typeof parsed === 'object' && parsed.watched) || parsed || {};
    return Object.fromEntries(
      Object.entries(map).map(([id, v]) => [migrate(id), typeof v === 'number' && v > UNKNOWN ? v : UNKNOWN]),
    );
  } catch {
    return {};
  }
}

const [state, setState] = createStore<{ watched: WatchedMap }>({ watched: load() });

// Persist on every change. Rooted so the global effect has an owner.
createRoot(() => {
  createEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ watched: state.watched }));
    } catch {
      /* storage full or unavailable, ignore */
    }
  });
});

export const progress = state;

export function isWatched(id: string): boolean {
  return state.watched[id] != null;
}

/** When an episode was marked watched (ms epoch), or null if unknown / not watched. */
export function watchedAt(id: string): number | null {
  const v = state.watched[id];
  return v != null && v > UNKNOWN ? v : null;
}

/**
 * Listeners are told which ids actually changed (used by Trakt sync). Changes made with
 * `silent` (pulling from Trakt, import, reset) are not reported, so they never echo back.
 */
type Listener = (ids: string[], watched: boolean) => void;
const listeners = new Set<Listener>();
export function onWatchedChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Mark/unmark many episode ids at once. */
export function setMany(ids: string[], value: boolean, opts: { silent?: boolean } = {}) {
  const changed = ids.filter((id) => isWatched(id) !== value);
  const now = opts.silent ? UNKNOWN : Date.now();
  if (!changed.length) return;
  setState(
    produce((s) => {
      for (const id of changed) {
        if (value) s.watched[id] = now;
        else delete s.watched[id];
      }
    }),
  );
  if (!opts.silent) for (const fn of listeners) fn(changed, value);
}

export function setWatched(id: string, value: boolean) {
  setMany([id], value);
}

export function toggle(id: string) {
  setMany([id], !state.watched[id]);
}

export function watchedCount(): number {
  return Object.keys(state.watched).length;
}

/**
 * Fill in watch times from another source (Trakt) for episodes that are marked watched
 * without a known time, and mark any that aren't watched yet. Silent: nothing is echoed
 * back to Trakt.
 */
export function applyWatchTimes(times: Record<string, number>) {
  setState(
    produce((s) => {
      for (const [id, t] of Object.entries(times)) {
        const cur = s.watched[id];
        if (cur == null || cur <= UNKNOWN) s.watched[id] = t > UNKNOWN ? t : UNKNOWN;
      }
    }),
  );
}

export function clearAll() {
  setState('watched', {});
}

export function exportJSON(): string {
  return JSON.stringify(
    // `watched` stays a plain id list (older versions can read it); `watchedAt` adds the times.
    { app: 'one-pace-viewing-guide', version: 2, watched: Object.keys(state.watched), watchedAt: { ...state.watched } },
    null,
    2,
  );
}

/** Returns number of ids imported, or throws on malformed input. */
export function importJSON(text: string, merge = false): number {
  const parsed = JSON.parse(text);
  const ids: string[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.watched)
      ? parsed.watched
      : parsed?.watched && typeof parsed.watched === 'object'
        ? Object.keys(parsed.watched)
        : null;
  if (!ids) throw new Error('Unrecognized progress file.');
  const times: Record<string, unknown> = (parsed?.watchedAt && typeof parsed.watchedAt === 'object' && parsed.watchedAt) || {};
  setState(
    produce((s) => {
      if (!merge) s.watched = {};
      for (const id of ids) {
        if (typeof id !== 'string') continue;
        const t = times[id];
        s.watched[migrate(id)] = typeof t === 'number' && t > UNKNOWN ? t : (s.watched[migrate(id)] ?? UNKNOWN);
      }
    }),
  );
  return ids.length;
}
