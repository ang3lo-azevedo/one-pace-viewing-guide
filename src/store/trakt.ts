import { focusAfterSync } from '../lib/focus';
import { createStore } from 'solid-js/store';
import { config, traktConfigured } from '../config';
import { flatById, guide } from '../lib/guide';
import { measurePace, PACE_WINDOW_DAYS, type Pace, type Play } from '../lib/pace';
import type { Episode } from '../types';
import { applyWatchTimes, onWatchedChange, progress } from './progress';

const KEY = 'op-trakt-v1';
const API = 'https://api.trakt.tv';
const TOKEN_URL = `${API}/oauth/token`;

interface TraktState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // epoch seconds
  username: string | null;
  /** Display name and avatar of the signed-in Trakt account. */
  name: string | null;
  avatar: string | null;
  status: 'idle' | 'connecting' | 'syncing';
  lastMessage: string | null;
  /** When watched history was last exchanged with Trakt (ms epoch). */
  lastSyncedAt: number | null;
  /** Our episode ids that map to a Trakt episode (known after the map is built). */
  mapped: Record<string, true>;
  /** Your own Trakt ratings (1-10), by our episode id. */
  myRatings: Record<string, number>;
  /** Watching pace measured from your Trakt history (last 28 days). */
  pace: Pace | null;
}

function load(): TraktState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { status: 'idle', lastMessage: null, mapped: {}, myRatings: {}, pace: null, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    username: null,
    name: null,
    avatar: null,
    status: 'idle',
    lastMessage: null,
    lastSyncedAt: null,
    mapped: {},
    myRatings: {},
    pace: null,
  };
}

const [trakt, setTrakt] = createStore<TraktState>(load());
export { trakt };

function persist() {
  const { accessToken, refreshToken, expiresAt, username, name, avatar, lastSyncedAt, pace } = trakt;
  try {
    localStorage.setItem(KEY, JSON.stringify({ accessToken, refreshToken, expiresAt, username, name, avatar, lastSyncedAt, pace }));
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
  setTrakt({ accessToken: null, refreshToken: null, expiresAt: null, username: null, name: null, avatar: null, lastMessage: 'Disconnected.', myRatings: {}, lastSyncedAt: null, pace: null });
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

/** Load the signed-in account's username, display name and avatar (and remember them). */
async function fetchUsername() {
  try {
    const r = await traktFetch('/users/settings');
    if (!r.ok) return;
    const u = (await r.json()).user ?? {};
    setTrakt({
      username: u.username ?? u.ids?.slug ?? null,
      name: u.name || null,
      avatar: u.images?.avatar?.full ?? null,
    });
    persist();
  } catch {
    /* ignore */
  }
}

// ---- episode mapping ---------------------------------------------------------
// The mapping is computed at build time (scripts/fetch_trakt_ratings.py) and stored on each
// episode: One Pace releases point at the Trakt "one-pace" show and the Live Action at
// "one-piece-2023" (`traktEpisode`), and
// community cuts (Onigashima Paced, Kuma Cut / Shaved Egghead, One Piece Log) point at the
// original anime episodes they cover on the "one-piece" show (`traktAnime`).

const ANIME_SHOW = 'one-piece';

interface MapResult {
  toTrakt: Map<string, number>; // our episode id -> One Pace trakt episode id
  fromTrakt: Map<number, string>; // One Pace trakt episode id -> our episode id
  bySeasonEp: Map<string, string>; // "<show>:<season>:<episode>" -> our episode id (One Pace and Live Action)
  toAnime: Map<string, [number, number, number][]>; // our id -> anime [season, number, trakt]
  toMovie: Map<string, number>; // our id -> Trakt movie id (movies and specials)
  fromMovie: Map<number, string[]>; // Trakt movie id -> our ids (a film can appear twice)
  matched: number;
  total: number;
}

let cachedMap: MapResult | null = null;

function getMap(): Promise<MapResult> {
  if (cachedMap) return Promise.resolve(cachedMap);
  const toTrakt = new Map<string, number>();
  const fromTrakt = new Map<number, string>();
  const bySeasonEp = new Map<string, string>();
  const toAnime = new Map<string, [number, number, number][]>();
  const toMovie = new Map<string, number>();
  const fromMovie = new Map<number, string[]>();
  let total = 0;
  for (const s of guide.sagas)
    for (const n of s.nodes)
      for (const g of n.groups)
        for (const e of g.episodes as Episode[]) {
          if (e.links.onepace || e.canon) total++;
          const t = e.traktEpisode;
          if (t?.trakt) {
            toTrakt.set(e.id, t.trakt);
            fromTrakt.set(t.trakt, e.id);
            bySeasonEp.set(`${t.show ?? config.traktShowSlug}:${t.season}:${t.number}`, e.id);
          } else if (e.traktAnime?.length) toAnime.set(e.id, e.traktAnime);
          if (e.traktMovie) {
            total++;
            toMovie.set(e.id, e.traktMovie.trakt);
            fromMovie.set(e.traktMovie.trakt, [...(fromMovie.get(e.traktMovie.trakt) ?? []), e.id]);
          }
        }
  cachedMap = { toTrakt, fromTrakt, bySeasonEp, toAnime, toMovie, fromMovie, matched: toTrakt.size + toAnime.size + toMovie.size, total };
  setTrakt('mapped', Object.fromEntries([...toTrakt.keys(), ...toMovie.keys()].map((k) => [k, true as const])));
  return Promise.resolve(cachedMap);
}

// ---- sync --------------------------------------------------------------------

/** Last pull in this page session (not persisted, so each page load pulls once). */
let lastPullAt = 0;

/** Completed episodes of a Trakt show: "<season>:<episode>" -> last watched time (ms, 0 if unknown). */
async function completedMap(slug: string): Promise<Map<string, number>> {
  const r = await traktFetch(`/shows/${slug}/progress/watched?hidden=false&specials=false`);
  if (r.status === 404) return new Map();
  if (!r.ok) throw new Error(`progress ${r.status}`);
  const prog = await r.json();
  const done = new Map<string, number>();
  for (const season of prog.seasons || [])
    for (const ep of season.episodes || [])
      if (ep.completed) done.set(`${season.number}:${ep.number}`, ep.last_watched_at ? Date.parse(ep.last_watched_at) || 0 : 0);
  return done;
}

/** Pull watched history from Trakt and mark matching episodes watched locally (with Trakt's dates). */
export async function pullFromTrakt(): Promise<void> {
  if (!isConnected()) return;
  setTrakt('status', 'syncing');
  try {
    const map = await getMap();
    const times: Record<string, number> = {};
    const shows = new Set([...map.bySeasonEp.keys()].map((k) => k.split(':')[0]));
    for (const show of shows)
      for (const [key, t] of await completedMap(show)) {
        const ourId = map.bySeasonEp.get(`${show}:${key}`);
        if (ourId) times[ourId] = t;
      }
    // A community cut counts as watched once every anime episode it covers is watched.
    if (map.toAnime.size) {
      const anime = await completedMap(ANIME_SHOW);
      for (const [ourId, eps] of map.toAnime)
        if (eps.every(([s, n]) => anime.has(`${s}:${n}`))) times[ourId] = Math.max(...eps.map(([s, n]) => anime.get(`${s}:${n}`) ?? 0));
    }
    // Movies and specials.
    if (map.toMovie.size) {
      const r = await traktFetch('/sync/watched/movies');
      if (r.ok)
        for (const it of await r.json()) {
          const t = it.last_watched_at ? Date.parse(it.last_watched_at) || 0 : 0;
          for (const ourId of map.fromMovie.get(it.movie?.ids?.trakt) ?? []) times[ourId] = t;
        }
    }
    // Silent: these came from Trakt, so they must not be pushed back.
    applyWatchTimes(times);
    focusAfterSync();
    lastPullAt = Date.now();
    setTrakt('lastSyncedAt', lastPullAt);
    persist();
    setTrakt({ status: 'idle', lastMessage: `Pulled ${Object.keys(times).length} watched from Trakt (${map.matched}/${map.total} episodes mapped).` });
    void loadTraktPace();
  } catch (e) {
    setTrakt({ status: 'idle', lastMessage: 'Pull failed: ' + (e as Error).message });
  }
}

async function sendHistory(ourIds: string[], watched: boolean, keepalive = false): Promise<number> {
  const map = await getMap();
  const ids = new Set<number>();
  const movies = new Set<number>();
  for (const id of ourIds) {
    const t = map.toTrakt.get(id);
    if (t != null) ids.add(t);
    for (const [, , tid] of map.toAnime.get(id) ?? []) ids.add(tid);
    const m = map.toMovie.get(id);
    if (m != null) movies.add(m);
  }
  if (!watched) {
    // Keep anime episodes / films that another still-watched entry also covers.
    const changing = new Set(ourIds);
    for (const [ourId, eps] of map.toAnime)
      if (!changing.has(ourId) && progress.watched[ourId]) for (const [, , tid] of eps) ids.delete(tid);
    for (const [ourId, m] of map.toMovie) if (!changing.has(ourId) && progress.watched[ourId]) movies.delete(m);
  }
  if (!ids.size && !movies.size) return 0;
  const r = await traktFetch(watched ? '/sync/history' : '/sync/history/remove', {
    method: 'POST',
    body: JSON.stringify({
      episodes: [...ids].map((trakt) => ({ ids: { trakt } })),
      movies: [...movies].map((trakt) => ({ ids: { trakt } })),
    }),
    keepalive,
  });
  if (!r.ok) throw new Error(`history ${r.status}`);
  return ourIds.filter((id) => map.toTrakt.has(id) || map.toAnime.has(id) || map.toMovie.has(id)).length;
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

async function flush(keepalive = false) {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (!isConnected() || !pending.size) return;
  const batch = new Map(pending);
  pending.clear();
  const add: string[] = [];
  const remove: string[] = [];
  for (const [id, w] of batch) (w ? add : remove).push(id);
  try {
    const a = add.length ? await sendHistory(add, true, keepalive) : 0;
    const r = remove.length ? await sendHistory(remove, false, keepalive) : 0;
    setTrakt('lastSyncedAt', Date.now());
    persist();
    if (a || r) setTrakt('lastMessage', `Synced to Trakt: ${a} added, ${r} removed.`);
  } catch (e) {
    // Put the changes back (newer local changes win) and retry in 30 s.
    for (const [id, w] of batch) if (!pending.has(id)) pending.set(id, w);
    flushTimer = setTimeout(() => flush(), 30_000);
    setTrakt('lastMessage', 'Trakt sync failed, will retry: ' + (e as Error).message);
  }
}

onWatchedChange((ids, watched) => {
  if (!isConnected()) return;
  for (const id of ids) pending.set(id, watched);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1500);
});

// ---- pace from Trakt history ---------------------------------------------------

/** Trakt shows that are part of this guide. */
const PACE_SHOWS = new Set(['one-pace', 'one-piece', 'one-piece-2023', 'one-piece-log-fish-man-island-saga']);

/**
 * Measure your watching pace from Trakt: every One Piece play (One Pace, original anime,
 * Live Action, One Piece Log, films) in the last 28 days, using this guide's real lengths
 * where known. Bulk-added history is filtered out by measurePace.
 */
export async function loadTraktPace(): Promise<void> {
  if (!isConnected()) return;
  try {
    const map = await getMap();
    const since = new Date(Date.now() - PACE_WINDOW_DAYS * 86_400_000).toISOString();
    const plays: Play[] = [];
    for (let page = 1; page <= 10; page++) {
      const r = await traktFetch(`/sync/history?start_at=${encodeURIComponent(since)}&limit=500&page=${page}&extended=full`);
      if (!r.ok) break;
      const items: any[] = await r.json();
      for (const it of items) {
        const t = Date.parse(it.watched_at);
        if (!t) continue;
        if (it.type === 'episode' && PACE_SHOWS.has(it.show?.ids?.slug)) {
          const ours = map.fromTrakt.get(it.episode?.ids?.trakt);
          const runtime = (ours && flatById.get(ours)?.ep.runtime) || it.episode?.runtime || 24;
          plays.push({ t, min: runtime });
        } else if (it.type === 'movie' && /one piece|monsters/i.test(it.movie?.title ?? '')) {
          plays.push({ t, min: it.movie?.runtime || 100 });
        }
      }
      const pages = Number(r.headers.get('X-Pagination-Page-Count') ?? '1');
      if (page >= pages) break;
    }
    setTrakt('pace', measurePace(plays));
    persist();
  } catch {
    /* keep the previous pace */
  }
}

// ---- ratings -----------------------------------------------------------------

/** Load your own episode ratings from Trakt. */
export async function loadMyRatings(): Promise<void> {
  if (!isConnected()) return;
  try {
    const map = await getMap();
    const mine: Record<string, number> = {};
    const r = await traktFetch('/sync/ratings/episodes');
    if (r.ok)
      for (const it of await r.json()) {
        const ours = map.fromTrakt.get(it.episode?.ids?.trakt);
        if (ours && it.rating) mine[ours] = it.rating;
      }
    if (map.toMovie.size) {
      const rm = await traktFetch('/sync/ratings/movies');
      if (rm.ok)
        for (const it of await rm.json())
          for (const ours of map.fromMovie.get(it.movie?.ids?.trakt) ?? []) if (it.rating) mine[ours] = it.rating;
    }
    // Arcs: your season ratings on the One Pace show, keyed "season:<trakt id>".
    const rs = await traktFetch('/sync/ratings/seasons');
    if (rs.ok)
      for (const it of await rs.json()) if (it.season?.ids?.trakt && it.rating) mine[`season:${it.season.ids.trakt}`] = it.rating;
    setTrakt('myRatings', mine);
  } catch {
    /* ignore */
  }
}

/** Rate an arc (its season of the One Pace show on Trakt) 1-10, or remove your rating with null. */
export async function rateSeason(seasonTraktId: number, rating: number | null): Promise<void> {
  if (!isConnected()) return;
  const key = `season:${seasonTraktId}`;
  const prev = trakt.myRatings[key];
  setTrakt('myRatings', key, rating ?? undefined!);
  try {
    const item = { ...(rating == null ? {} : { rating }), ids: { trakt: seasonTraktId } };
    const r = await traktFetch(rating == null ? '/sync/ratings/remove' : '/sync/ratings', {
      method: 'POST',
      body: JSON.stringify({ seasons: [item] }),
    });
    if (!r.ok) throw new Error(`ratings ${r.status}`);
  } catch (e) {
    setTrakt('myRatings', key, prev ?? undefined!);
    setTrakt('lastMessage', 'Rating failed: ' + (e as Error).message);
  }
}

/** Rate an episode, movie or special on Trakt (1-10), or remove your rating with null. */
export async function rateEpisode(ourId: string, rating: number | null): Promise<void> {
  if (!isConnected()) return;
  const map = await getMap();
  const episode = map.toTrakt.get(ourId);
  const movie = map.toMovie.get(ourId);
  if (episode == null && movie == null) return;
  // A film listed twice (main and alternative placement) shares one rating.
  const same = movie != null ? (map.fromMovie.get(movie) ?? [ourId]) : [ourId];
  const prev = trakt.myRatings[ourId];
  for (const id of same) setTrakt('myRatings', id, rating ?? undefined!);
  try {
    const item = { ...(rating == null ? {} : { rating }), ids: { trakt: (episode ?? movie)! } };
    const r = await traktFetch(rating == null ? '/sync/ratings/remove' : '/sync/ratings', {
      method: 'POST',
      body: JSON.stringify(episode != null ? { episodes: [item] } : { movies: [item] }),
    });
    if (!r.ok) throw new Error(`ratings ${r.status}`);
  } catch (e) {
    for (const id of same) setTrakt('myRatings', id, prev ?? undefined!);
    setTrakt('lastMessage', 'Rating failed: ' + (e as Error).message);
  }
}

/** On app start with a saved login: build the episode map and load your ratings. */
const AUTO_PULL_EVERY = 5 * 60_000;

/** Pull from Trakt if the last exchange is older than 5 minutes. */
async function autoPull() {
  if (!isConnected() || trakt.status !== 'idle') return;
  if (lastPullAt && Date.now() - lastPullAt < AUTO_PULL_EVERY) return;
  await pullFromTrakt();
}

let listenersAdded = false;

/**
 * On app start with a saved login: load the profile, episode map and ratings, then pull
 * your watched history. While the page is open it pulls again when you come back to the tab
 * (at most every 5 minutes), and sends pending changes when the tab is hidden or closed.
 */
export async function initTrakt(): Promise<void> {
  if (!isConnected()) return;
  if (!listenersAdded) {
    listenersAdded = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
      else autoPull();
    });
    window.addEventListener('pagehide', () => flush(true));
  }
  try {
    await fetchUsername();
    await getMap();
    await autoPull();
    await loadMyRatings();
    await loadTraktPace();
  } catch {
    /* ignore; the menu shows errors on manual actions */
  }
}
