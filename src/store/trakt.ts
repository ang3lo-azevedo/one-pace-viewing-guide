import { createStore } from 'solid-js/store';
import { config, traktConfigured } from '../config';
import { guide } from '../lib/guide';
import type { Episode } from '../types';
import { onWatchedChange, setMany } from './progress';

const KEY = 'op-trakt-v1';
const API = 'https://api.trakt.tv';
const TOKEN_URL = `${API}/oauth/token`;

interface TraktState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // epoch seconds
  username: string | null;
  status: 'idle' | 'connecting' | 'syncing';
  lastMessage: string | null;
  /** Our episode ids that map to a Trakt episode (known after the map is built). */
  mapped: Record<string, true>;
  /** Your own Trakt ratings (1-10), by our episode id. */
  myRatings: Record<string, number>;
}

function load(): TraktState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { status: 'idle', lastMessage: null, mapped: {}, myRatings: {}, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    username: null,
    status: 'idle',
    lastMessage: null,
    mapped: {},
    myRatings: {},
  };
}

const [trakt, setTrakt] = createStore<TraktState>(load());
export { trakt };

function persist() {
  const { accessToken, refreshToken, expiresAt, username } = trakt;
  try {
    localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken, expiresAt, username }));
  } catch {
    /* ignore */
  }
}

export const isConnected = () => !!trakt.accessToken;

const redirectUri = () => window.location.origin + window.location.pathname;

// ---- PKCE helpers ------------------------------------------------------------

function base64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)).buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(digest) };
}

// ---- auth --------------------------------------------------------------------

/** Kick off the PKCE login (redirects away to Trakt). */
export async function connect() {
  if (!traktConfigured()) {
    alert('Set traktClientId in src/config.ts first.');
    return;
  }
  const state = crypto.randomUUID();
  const { verifier, challenge } = await makePkce();
  sessionStorage.setItem('trakt_state', state);
  sessionStorage.setItem('trakt_verifier', verifier);
  const u = new URL('https://trakt.tv/oauth/authorize');
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', config.traktClientId);
  u.searchParams.set('redirect_uri', redirectUri());
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  window.location.href = u.toString();
}

export function disconnect() {
  setTrakt({ accessToken: null, refreshToken: null, expiresAt: null, username: null, lastMessage: 'Disconnected.', myRatings: {} });
  persist();
}

/** On app load: if we returned from Trakt with ?code=, exchange it for a token. */
export async function handleRedirectCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return;

  const clean = window.location.origin + window.location.pathname;
  window.history.replaceState({}, '', clean);

  const verifier = sessionStorage.getItem('trakt_verifier');
  if (!state || state !== sessionStorage.getItem('trakt_state') || !verifier) {
    setTrakt('lastMessage', 'Trakt login failed: state/verifier mismatch.');
    return;
  }
  setTrakt('status', 'connecting');
  try {
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: config.traktClientId,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.access_token) throw new Error(data.error_description || data.error || 'token exchange failed');
    sessionStorage.removeItem('trakt_verifier');
    setTrakt({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 7776000),
      status: 'idle',
    });
    persist();
    await fetchUsername();
    setTrakt('lastMessage', 'Connected to Trakt. Pulling your history…');
    await pullFromTrakt();
    await loadMyRatings();
  } catch (e) {
    setTrakt({ status: 'idle', lastMessage: 'Trakt login failed: ' + (e as Error).message });
  }
}

async function ensureToken(): Promise<string | null> {
  if (!trakt.accessToken) return null;
  if (trakt.expiresAt && trakt.expiresAt - 60 < Math.floor(Date.now() / 1000) && trakt.refreshToken) {
    try {
      const resp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: trakt.refreshToken,
          client_id: config.traktClientId,
          redirect_uri: redirectUri(),
          grant_type: 'refresh_token',
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.access_token) {
        setTrakt({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 7776000),
        });
        persist();
      }
    } catch {
      /* keep old token */
    }
  }
  return trakt.accessToken;
}

async function traktFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await ensureToken();
  return fetch(API + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': config.traktClientId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
}

async function fetchUsername() {
  try {
    const r = await traktFetch('/users/me');
    if (r.ok) {
      const u = await r.json();
      setTrakt('username', u.username ?? u.ids?.slug ?? 'trakt user');
    }
  } catch {
    /* ignore */
  }
}

// ---- episode mapping ---------------------------------------------------------

/** Normalize an episode title for fuzzy comparison across data sources. */
function norm(t: string): string {
  if (!t) return '';
  return t
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\benter\b/g, '')
    .replace(/\bthe\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

interface MapResult {
  toTrakt: Map<string, number>; // our episode id -> trakt episode id
  fromTrakt: Map<number, string>; // trakt episode id -> our episode id
  bySeasonEp: Map<string, string>; // "<seasonNumber>:<episodeNumber>" -> our episode id
  matched: number;
  total: number;
}

let cachedMap: MapResult | null = null;
let mapPromise: Promise<MapResult> | null = null;

/** Build the Trakt episode map once (concurrent callers share the same request). */
function getMap(): Promise<MapResult> {
  if (cachedMap) return Promise.resolve(cachedMap);
  mapPromise ??= buildMap().finally(() => (mapPromise = null));
  return mapPromise;
}

/**
 * Map our One Pace episodes to the Trakt "One Pace" show. Trakt's seasons are unnamed but
 * follow the same arc order, so we match primarily by normalized episode title (unique
 * titles only) and fall back to position (arc index + episode number) when an arc and its
 * aligned Trakt season have the same episode count.
 */
async function buildMap(): Promise<MapResult> {
  if (cachedMap) return cachedMap;

  const r = await traktFetch(`/shows/${config.traktShowSlug}/seasons?extended=episodes`);
  if (!r.ok) throw new Error(`Trakt show "${config.traktShowSlug}" not found (${r.status})`);
  const seasons: any[] = await r.json();

  // Global index of unique normalized titles.
  const titleCount = new Map<string, number>();
  const flat: { sn: number; en: number; tid: number; nt: string }[] = [];
  for (const s of seasons)
    for (const e of s.episodes || []) {
      if (e.ids?.trakt == null) continue;
      const nt = norm(e.title || '');
      flat.push({ sn: s.number, en: e.number, tid: e.ids.trakt, nt });
      titleCount.set(nt, (titleCount.get(nt) || 0) + 1);
    }
  const titleIdx = new Map<string, { sn: number; en: number; tid: number }>();
  for (const f of flat) if (titleCount.get(f.nt) === 1) titleIdx.set(f.nt, f);

  // Trakt episodes by number within each season, in season order.
  const tSeasons = seasons.map((s) => {
    const byNum = new Map<number, { en: number; tid: number }>();
    for (const e of s.episodes || []) if (e.ids?.trakt != null) byNum.set(e.number, { en: e.number, tid: e.ids.trakt });
    return { num: s.number, count: (s.episodes || []).length, byNum };
  });

  // Our onepace arcs in order.
  const arcs: Episode[][] = [];
  for (const sg of guide.sagas)
    for (const nd of sg.nodes)
      for (const g of nd.groups) if (g.kind === 'onepace' && !g.isAlternative) arcs.push(g.episodes);

  const toTrakt = new Map<string, number>();
  const bySeasonEp = new Map<string, string>();
  let total = 0;
  arcs.forEach((eps, ai) => {
    const ts = tSeasons[ai];
    eps.forEach((e, ei) => {
      total++;
      let hit = titleIdx.get(norm(e.fullTitle || ''));
      if (!hit && ts && ts.count === eps.length) {
        const byn = ts.byNum.get(ei + 1);
        if (byn) hit = { sn: ts.num, en: byn.en, tid: byn.tid };
      }
      if (hit) {
        toTrakt.set(e.id, hit.tid);
        bySeasonEp.set(`${hit.sn}:${hit.en}`, e.id);
      }
    });
  });

  const fromTrakt = new Map<number, string>();
  for (const [ours, tid] of toTrakt) fromTrakt.set(tid, ours);
  cachedMap = { toTrakt, fromTrakt, bySeasonEp, matched: toTrakt.size, total };
  setTrakt('mapped', Object.fromEntries([...toTrakt.keys()].map((k) => [k, true as const])));
  return cachedMap;
}

// ---- sync --------------------------------------------------------------------

/** Pull watched history from Trakt and mark matching episodes watched locally. */
export async function pullFromTrakt(): Promise<void> {
  if (!isConnected()) return;
  setTrakt('status', 'syncing');
  try {
    const map = await getMap();
    const r = await traktFetch(`/shows/${config.traktShowSlug}/progress/watched?hidden=false&specials=false`);
    if (!r.ok) throw new Error(`progress ${r.status}`);
    const prog = await r.json();
    const watchedIds: string[] = [];
    for (const season of prog.seasons || [])
      for (const ep of season.episodes || [])
        if (ep.completed) {
          const ourId = map.bySeasonEp.get(`${season.number}:${ep.number}`);
          if (ourId) watchedIds.push(ourId);
        }
    // Silent: these came from Trakt, so they must not be pushed back.
    if (watchedIds.length) setMany(watchedIds, true, { silent: true });
    setTrakt({ status: 'idle', lastMessage: `Pulled ${watchedIds.length} watched from Trakt (${map.matched}/${map.total} episodes mapped).` });
  } catch (e) {
    setTrakt({ status: 'idle', lastMessage: 'Pull failed: ' + (e as Error).message });
  }
}

async function sendHistory(ourIds: string[], watched: boolean): Promise<number> {
  const map = await getMap();
  const episodes = ourIds
    .map((id) => map.toTrakt.get(id))
    .filter((v): v is number => v != null)
    .map((trakt) => ({ ids: { trakt } }));
  if (!episodes.length) return 0;
  const r = await traktFetch(watched ? '/sync/history' : '/sync/history/remove', {
    method: 'POST',
    body: JSON.stringify({ episodes }),
  });
  if (!r.ok) throw new Error(`history ${r.status}`);
  return episodes.length;
}

/** Push locally-watched episodes to Trakt history. */
export async function pushToTrakt(watchedLocalIds: string[]): Promise<void> {
  if (!isConnected()) return;
  setTrakt('status', 'syncing');
  try {
    const n = await sendHistory(watchedLocalIds, true);
    setTrakt({ status: 'idle', lastMessage: n ? `Pushed ${n} episodes to Trakt.` : 'Nothing to push (no mapped watched episodes).' });
  } catch (e) {
    setTrakt({ status: 'idle', lastMessage: 'Push failed: ' + (e as Error).message });
  }
}

// Every local change (single checkbox, Mark arc/saga, Catch up, Mark all) is queued and sent
// to Trakt in one batch shortly after, so bulk actions sync too without flooding the API.
const pending = new Map<string, boolean>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

async function flush() {
  flushTimer = undefined;
  if (!isConnected() || !pending.size) return;
  const add: string[] = [];
  const remove: string[] = [];
  for (const [id, w] of pending) (w ? add : remove).push(id);
  pending.clear();
  try {
    const a = add.length ? await sendHistory(add, true) : 0;
    const r = remove.length ? await sendHistory(remove, false) : 0;
    if (a || r) setTrakt('lastMessage', `Synced to Trakt: ${a} added, ${r} removed.`);
  } catch (e) {
    setTrakt('lastMessage', 'Trakt sync failed: ' + (e as Error).message);
  }
}

onWatchedChange((ids, watched) => {
  if (!isConnected()) return;
  for (const id of ids) pending.set(id, watched);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1500);
});

// ---- ratings -----------------------------------------------------------------

/** Load your own episode ratings from Trakt. */
export async function loadMyRatings(): Promise<void> {
  if (!isConnected()) return;
  try {
    const map = await getMap();
    const r = await traktFetch('/sync/ratings/episodes');
    if (!r.ok) return;
    const items: any[] = await r.json();
    const mine: Record<string, number> = {};
    for (const it of items) {
      const ours = map.fromTrakt.get(it.episode?.ids?.trakt);
      if (ours && it.rating) mine[ours] = it.rating;
    }
    setTrakt('myRatings', mine);
  } catch {
    /* ignore */
  }
}

/** Rate an episode on Trakt (1-10), or remove your rating with null. */
export async function rateEpisode(ourId: string, rating: number | null): Promise<void> {
  if (!isConnected()) return;
  const map = await getMap();
  const traktId = map.toTrakt.get(ourId);
  if (traktId == null) return;
  const prev = trakt.myRatings[ourId];
  setTrakt('myRatings', ourId, rating ?? undefined!);
  try {
    const r = await traktFetch(rating == null ? '/sync/ratings/remove' : '/sync/ratings', {
      method: 'POST',
      body: JSON.stringify({ episodes: [{ ...(rating == null ? {} : { rating }), ids: { trakt: traktId } }] }),
    });
    if (!r.ok) throw new Error(`ratings ${r.status}`);
  } catch (e) {
    setTrakt('myRatings', ourId, prev ?? undefined!);
    setTrakt('lastMessage', 'Rating failed: ' + (e as Error).message);
  }
}

/** On app start with a saved login: build the episode map and load your ratings. */
export async function initTrakt(): Promise<void> {
  if (!isConnected()) return;
  try {
    await getMap();
    await loadMyRatings();
  } catch {
    /* ignore; the menu shows errors on manual actions */
  }
}
