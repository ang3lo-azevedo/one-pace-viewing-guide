import { createEffect, createRoot, createSignal, on } from 'solid-js';
import { saveView } from '../lib/restore';
import { readVersions } from '../lib/versions';
import { prefs, setPrefs, type Prefs } from './prefs';
import { isConnected, traktFetch } from './trakt';

/**
 * Preferences synced through your Trakt account. Trakt has no place for an app's settings,
 * so they live in the description of one private, empty list on your account. The newest
 * change wins: each side keeps the time of its last change.
 *
 * Left out: the theme and where the page opens (per device), and the view filters (search,
 * rating, saga, hide watched), which are not preferences. Only when you turn it on
 * (Preferences, Behaviour): it makes a list on your Trakt account.
 */
const LIST_NAME = 'One Pace Viewing Guide settings';
const INTRO = 'Settings of the One Pace Viewing Guide, saved by the site. Please leave this list as it is.';
const META_KEY = 'op-prefs-sync-v1';
const LOCAL_ONLY = new Set<keyof Prefs>(['theme', 'openAt', 'search', 'tierMin', 'sagaId', 'hideWatched', 'syncPrefs']);
const enabled = () => prefs.syncPrefs && isConnected();

type Synced = Partial<Prefs>;
interface Meta {
  /** When the synced preferences last changed here, or were taken from Trakt (ms epoch). */
  updatedAt: number;
  listId: number | null;
}

const meta: Meta = (() => {
  try {
    return { updatedAt: 0, listId: null, ...JSON.parse(localStorage.getItem(META_KEY) ?? '{}') };
  } catch {
    return { updatedAt: 0, listId: null };
  }
})();
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore */
  }
};

const [syncState, setSyncState] = createSignal<{ at: number | null; error: string | null }>({ at: null, error: null });
/** When the preferences were last in step with Trakt, or why that failed. */
export { syncState as prefsSyncState };

function synced(): Synced {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prefs)) if (!LOCAL_ONLY.has(k as keyof Prefs)) out[k] = v;
  return JSON.parse(JSON.stringify(out));
}

/** Only keys this version of the site knows, with the type it expects. */
function clean(remote: Record<string, unknown>): Synced {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(remote)) {
    if (LOCAL_ONLY.has(k as keyof Prefs) || !(k in prefs)) continue;
    const cur = (prefs as unknown as Record<string, unknown>)[k];
    if (k === 'versions') out[k] = readVersions({ versions: v });
    else if (cur === null || v === null || typeof cur === typeof v) out[k] = v;
  }
  return out as Synced;
}

function parse(description: string | null | undefined): { updatedAt: number; prefs: Record<string, unknown> } | null {
  const i = description?.indexOf('{') ?? -1;
  if (!description || i < 0) return null;
  try {
    const data = JSON.parse(description.slice(i));
    return typeof data?.updatedAt === 'number' && data.prefs && typeof data.prefs === 'object' ? data : null;
  } catch {
    return null;
  }
}

let lastSeen = JSON.stringify(synced());
let applying = false;

/** Take the preferences from Trakt; a different version pick reloads the page (keeping your place). */
function apply(remote: Synced, updatedAt: number) {
  const versionsChanged = !!remote.versions && JSON.stringify(remote.versions) !== JSON.stringify(prefs.versions);
  applying = true;
  setPrefs(remote);
  applying = false;
  lastSeen = JSON.stringify(synced());
  meta.updatedAt = updatedAt;
  saveMeta();
  if (versionsChanged) {
    saveView();
    try {
      localStorage.setItem('op-prefs-v1', JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    location.reload();
  }
}

async function findList(): Promise<{ id: number; description: string | null } | null> {
  const r = await traktFetch('/users/me/lists');
  if (!r.ok) throw new Error(`Trakt answered ${r.status}`);
  const lists: { name: string; description: string | null; ids: { trakt: number } }[] = await r.json();
  const hit = lists.find((l) => l.ids.trakt === meta.listId) ?? lists.find((l) => l.name === LIST_NAME);
  return hit ? { id: hit.ids.trakt, description: hit.description } : null;
}

async function push(keepalive = false) {
  if (!meta.updatedAt) {
    meta.updatedAt = Date.now(); // first device to sync: its preferences become the shared ones
    saveMeta();
  }
  const description = `${INTRO}\n\n${JSON.stringify({ updatedAt: meta.updatedAt, prefs: synced() })}`;
  let r: Response;
  if (meta.listId) {
    r = await traktFetch(`/users/me/lists/${meta.listId}`, { method: 'PUT', body: JSON.stringify({ description }), keepalive });
    if (r.status !== 404) return done(r);
    meta.listId = null; // deleted on Trakt: make it again
  }
  r = await traktFetch('/users/me/lists', {
    method: 'POST',
    body: JSON.stringify({ name: LIST_NAME, description, privacy: 'private', display_numbers: false, allow_comments: false }),
    keepalive,
  });
  if (r.ok) {
    meta.listId = (await r.json()).ids?.trakt ?? null;
    saveMeta();
  }
  done(r);
}

function done(r: Response) {
  if (r.ok) setSyncState({ at: Date.now(), error: null });
  else
    setSyncState({
      at: null,
      error: r.status === 420 ? 'Your Trakt account has no free list left for the settings.' : `Trakt answered ${r.status}.`,
    });
}

/** After disconnecting: another account may connect next, so its saved preferences win. */
export function resetPrefsSync() {
  meta.updatedAt = 0;
  meta.listId = null;
  saveMeta();
  setSyncState({ at: null, error: null });
}

let busy = false;

/** Exchange preferences with Trakt: the side changed last wins. Call after connecting and on start. */
export async function syncPrefs(): Promise<void> {
  if (!enabled() || busy) return;
  busy = true;
  try {
    const list = await findList();
    if (list && meta.listId !== list.id) {
      meta.listId = list.id;
      saveMeta();
    }
    const remote = parse(list?.description);
    if (remote && remote.updatedAt > meta.updatedAt) {
      apply(clean(remote.prefs), remote.updatedAt);
      setSyncState({ at: Date.now(), error: null });
    } else if (!remote || meta.updatedAt > remote.updatedAt) await push();
    else setSyncState({ at: Date.now(), error: null });
  } catch (e) {
    setSyncState({ at: null, error: (e as Error).message });
  } finally {
    busy = false;
  }
}

// Turning it on: the preferences already on Trakt (from another device) win over this one's.
createRoot(() =>
  createEffect(
    on(
      () => prefs.syncPrefs,
      (on) => {
        if (!on) return setSyncState({ at: null, error: null });
        meta.updatedAt = 0;
        saveMeta();
        void syncPrefs();
      },
      { defer: true },
    ),
  ),
);

// Your own changes: note the time and send them a moment later.
let timer: ReturnType<typeof setTimeout> | undefined;
createRoot(() =>
  createEffect(
    on(
      () => JSON.stringify(synced()),
      (now) => {
        if (applying || now === lastSeen) return;
        lastSeen = now;
        meta.updatedAt = Date.now();
        saveMeta();
        clearTimeout(timer);
        if (enabled()) timer = setTimeout(() => {
            timer = undefined;
            void push().catch(() => undefined);
          }, 1500);
      },
      { defer: true },
    ),
  ),
);

if (typeof window !== 'undefined')
  window.addEventListener('pagehide', () => {
    if (timer === undefined || !enabled()) return;
    clearTimeout(timer);
    timer = undefined;
    void push(true).catch(() => undefined);
  });
