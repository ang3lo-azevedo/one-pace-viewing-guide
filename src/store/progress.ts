import { createStore, produce } from 'solid-js/store';
import { createEffect, createRoot } from 'solid-js';

const KEY = 'op-progress-v1';

type WatchedMap = Record<string, true>;

function load(): WatchedMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // legacy array form
      return Object.fromEntries(parsed.map((id: string) => [id, true]));
    }
    if (parsed && typeof parsed === 'object' && parsed.watched) return parsed.watched;
    return parsed ?? {};
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
  return !!state.watched[id];
}

export function toggle(id: string) {
  setState(
    produce((s) => {
      if (s.watched[id]) delete s.watched[id];
      else s.watched[id] = true;
    }),
  );
}

export function setWatched(id: string, value: boolean) {
  setState(
    produce((s) => {
      if (value) s.watched[id] = true;
      else delete s.watched[id];
    }),
  );
}

/** Mark/unmark many episode ids at once. */
export function setMany(ids: string[], value: boolean) {
  setState(
    produce((s) => {
      for (const id of ids) {
        if (value) s.watched[id] = true;
        else delete s.watched[id];
      }
    }),
  );
}

export function watchedCount(): number {
  return Object.keys(state.watched).length;
}

export function clearAll() {
  setState('watched', {});
}

export function exportJSON(): string {
  return JSON.stringify(
    { app: 'one-pace-viewing-guide', version: 1, watched: Object.keys(state.watched) },
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
  setState(
    produce((s) => {
      if (!merge) s.watched = {};
      for (const id of ids) if (typeof id === 'string') s.watched[id] = true;
    }),
  );
  return ids.length;
}
