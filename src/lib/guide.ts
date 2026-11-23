import raw from '../data/data.json';
import type { Episode, GuideData, Group, GuideNode, Saga, Tier } from '../types';
import { readVersions, versionSet, type Versions } from './versions';

export const guide = raw as unknown as GuideData;
export const tiers: Tier[] = guide.meta.tiers;

// Stable unique keys (node ids can repeat, e.g. two "One Pace Special" entries).
guide.sagas.forEach((saga, si) =>
  saga.nodes.forEach((node, ni) => {
    node.uid = `${si}.${ni}`;
    node.groups.forEach((group, gi) => (group.uid = `${si}.${ni}.${gi}`));
  }),
);

// Interchangeable versions (Preferences, see versions.ts): the picked one is the main route, the
// others become optional alternatives. Applied once at load; changing one reloads the page.
export const versionChoice: Versions = (() => {
  try {
    return readVersions(JSON.parse(localStorage.getItem('op-prefs-v1') ?? '{}'));
  } catch {
    return readVersions({});
  }
})();
const isAltVersion = (version: string) => {
  const [set, value] = version.split(':');
  return versionChoice[set] !== value;
};
const altLabel = (label: string, alt: boolean) => {
  const base = label.replace(/\s*\(Alternative\)\s*$/i, '');
  return alt ? `${base} (Alternative)` : base;
};
for (const saga of guide.sagas)
  for (const node of saga.nodes) {
    // A whole node can be a version (Strong World after Thriller Bark or after Post-War).
    if (node.version) {
      const alt = isAltVersion(node.version);
      node.isAlternative = alt;
      node.title = altLabel(node.title, alt);
      for (const group of node.groups) {
        group.isAlternative = alt;
        group.label = altLabel(group.label, alt);
        group.defaultOpen = !alt;
      }
    }
    for (const group of node.groups) {
      if (!group.version) continue;
      const alt = isAltVersion(group.version);
      group.isAlternative = alt;
      if (!group.afterEpisode) {
        group.label = altLabel(group.label, alt);
        group.defaultOpen = !alt;
      }
      // Sets like Fish-Man Island are canon whichever version you watch.
      if (versionSet.get(group.version.split(':')[0])?.canon) for (const ep of group.episodes) ep.canon = !alt;
    }
  }
// The picked version comes first in its arc (stable, so everything else keeps its order).
for (const saga of guide.sagas)
  for (const node of saga.nodes) {
    if (!node.groups.some((g) => g.version)) continue;
    const late = (g: Group) => (g.version && g.isAlternative && !g.afterEpisode ? 1 : 0);
    node.groups = node.groups.map((g, i) => ({ g, i })).sort((x, y) => late(x.g) - late(y.g) || x.i - y.i).map((x) => x.g);
  }

// Monsters after Thriller Bark: no longer inside episode 13, so no pause, nothing skipped,
// and the "pause here" / "skip the last minute" notes go.
if (versionChoice.monsters === 'after')
  for (const saga of guide.sagas)
    for (const node of saga.nodes)
      for (const group of node.groups) {
        if (group.setting !== 'monsters') continue;
        const anchor = group.afterEpisode;
        delete group.afterEpisode;
        for (const ep of group.episodes) {
          delete ep.skipMinutes;
          ep.notes = (ep.notes ?? []).filter((n) => !/skip the last minute/i.test(n));
        }
        for (const g of node.groups) for (const ep of g.episodes) if (ep.id === anchor) ep.notes = (ep.notes ?? []).filter((n) => !/^Pause at/i.test(n));
      }

// Official streaming links, where there is one: Netflix for the Live Action (its show page;
// Netflix has no public per-episode links), Crunchyroll for the original anime (a search, its
// pages have opaque ids), and a JustWatch search for films and specials (which services have
// it in your country).
const NETFLIX_LIVE_ACTION = 'https://www.netflix.com/title/80217863';
const CRUNCHYROLL_ONE_PIECE = 'https://www.crunchyroll.com/search?q=One%20Piece';
const justWatchCountry = (() => {
  const region = (typeof navigator !== 'undefined' ? navigator.language : 'en-US').split('-')[1]?.toLowerCase() ?? 'us';
  return region === 'gb' ? 'uk' : region;
})();
const justWatch = (title: string) => {
  const name = title.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/^(?:One Piece\s+)?(Fun Pace Special|Pace Special|Movie|Film|Special|TV Special)\s*\d*\s*[:-]\s*/i, '').trim();
  const q = /one piece/i.test(name) ? name : `One Piece ${name}`;
  return `https://www.justwatch.com/${justWatchCountry}/search?q=${encodeURIComponent(q)}`;
};
for (const saga of guide.sagas)
  for (const node of saga.nodes)
    for (const group of node.groups)
      for (const ep of group.episodes) {
        if (group.kind === 'netflix') ep.links.netflix ??= NETFLIX_LIVE_ACTION;
        if ((group.kind === 'original' || group.kind === 'original-continuation') && /^\s*\d/.test(ep.anime ?? ''))
          ep.links.crunchyroll ??= CRUNCHYROLL_ONE_PIECE;
        if (ep.traktMovie || group.kind === 'movie') ep.links.justwatch ??= justWatch(ep.fullTitle || ep.title);
      }

// Minutes skipped at this placement come off the runtime (Monsters: skip its last minute).
for (const saga of guide.sagas)
  for (const node of saga.nodes)
    for (const group of node.groups)
      for (const ep of group.episodes) if (ep.skipMinutes && ep.runtime) ep.runtime -= ep.skipMinutes;

export interface FlatEpisode {
  ep: Episode;
  group: Group;
  node: GuideNode;
  saga: Saga;
}

export const flatEpisodes: FlatEpisode[] = [];
for (const saga of guide.sagas)
  for (const node of saga.nodes)
    for (const group of node.groups)
      for (const ep of group.episodes) flatEpisodes.push({ ep, group, node, saga });

export const flatById = new Map(flatEpisodes.map((f) => [f.ep.id, f]));

/** Canon-path episode ids (the recommended One Pace viewing route). */
export const canonIds: string[] = flatEpisodes.filter((f) => f.ep.canon).map((f) => f.ep.id);
export const allIds: string[] = flatEpisodes.map((f) => f.ep.id);

/** Official numbered "Pace N" episodes (the 472 canon set stat). */
export const paceNumberedIds: string[] = flatEpisodes
  .filter((f) => f.group.kind === 'onepace' && f.ep.paceNumber != null)
  .map((f) => f.ep.id);

export type ExtraCategory = 'liveAction' | 'movies' | 'specials' | 'filler' | 'original' | 'alternatives';

export const EXTRA_LABELS: Record<ExtraCategory, string> = {
  liveAction: 'Live Action',
  movies: 'Movies',
  specials: 'Specials',
  filler: 'Filler & Fun Pace',
  original: 'Original anime',
  alternatives: 'Alternatives',
};

/** Which hideable "extra" category an entry belongs to, or null for the canon route. */
export function extraCategory(group: Group, node: GuideNode): ExtraCategory | null {
  // Alternatives first: a canon section can still be the version you did not pick.
  if (group.isAlternative || node.isAlternative) return 'alternatives';
  if (group.episodes.length && group.episodes.every((e) => e.canon)) return null;
  if (group.version && versionSet.get(group.version.split(':')[0])?.filler) return 'filler';
  switch (group.kind) {
    case 'netflix':
      return 'liveAction';
    case 'movie':
    case 'upcoming':
      return 'movies';
    case 'special':
    case 'theatre':
      return 'specials';
    case 'filler':
    case 'funpace':
      return 'filler';
    case 'original':
    case 'original-continuation':
      return 'original';
    default:
      return null;
  }
}

/** Episode ids in watch order (document order). */
/**
 * Watch order as shown on screen: sections nested in another one (e.g. the Monsters special
 * in the middle of Thriller Bark) come right after the episode they follow.
 */
export const displayIndex = new Map<string, number>();
{
  let k = 0;
  for (const saga of guide.sagas)
    for (const node of saga.nodes) {
      const ids = new Set(node.groups.flatMap((g) => g.episodes.map((e) => e.id)));
      const inline = new Map<string, Group[]>();
      const top: Group[] = [];
      for (const g of node.groups)
        if (g.afterEpisode && ids.has(g.afterEpisode)) inline.set(g.afterEpisode, [...(inline.get(g.afterEpisode) ?? []), g]);
        else top.push(g);
      const visit = (g: Group) => {
        for (const e of g.episodes) {
          displayIndex.set(e.id, k++);
          for (const child of inline.get(e.id) ?? []) visit(child);
        }
      };
      top.forEach(visit);
    }
}
export const displayOrder: FlatEpisode[] = [...flatEpisodes].sort(
  (a, b) => (displayIndex.get(a.ep.id) ?? 0) - (displayIndex.get(b.ep.id) ?? 0),
);

export const orderedIds: string[] = displayOrder.map((f) => f.ep.id);

const firstIdxOfNode = new Map<string, number>();
const firstIdxOfSaga = new Map<string, number>();
displayOrder.forEach((f, i) => {
  if (!firstIdxOfNode.has(f.node.uid)) firstIdxOfNode.set(f.node.uid, i);
  if (!firstIdxOfSaga.has(f.saga.id)) firstIdxOfSaga.set(f.saga.id, i);
});

export const allIdsOfNode = (nodeUid: string): string[] =>
  flatEpisodes.filter((f) => f.node.uid === nodeUid).map((f) => f.ep.id);
export const allIdsOfSaga = (sagaId: string): string[] =>
  flatEpisodes.filter((f) => f.saga.id === sagaId).map((f) => f.ep.id);
export const idsBeforeNode = (nodeUid: string): string[] =>
  orderedIds.slice(0, firstIdxOfNode.get(nodeUid) ?? 0);
export const idsBeforeSaga = (sagaId: string): string[] =>
  orderedIds.slice(0, firstIdxOfSaga.get(sagaId) ?? 0);

/** Split "Egghead 13 - The Emperor's Crew" into a safe label and a subtitle. */
export function splitTitle(title: string): { label: string; subtitle: string } {
  const i = title.indexOf(' - ');
  if (i > 0) return { label: title.slice(0, i), subtitle: title.slice(i + 3) };
  return { label: title, subtitle: '' };
}

export function tierForRating(rating: number | null): Tier | null {
  if (rating == null) return null;
  for (const t of tiers) if (rating >= t.min) return t;
  return tiers[tiers.length - 1];
}

const KIND_LABELS: Record<string, string> = {
  onepace: 'One Pace',
  onigashima: 'Onigashima Paced',
  'kuma-shaved': 'Kuma Cut / Shaved',
  netflix: 'Live Action',
  funpace: 'Fun Pace',
  original: 'Original Anime',
  'original-continuation': 'Original Anime',
  log: 'One Piece Log',
  movie: 'Movie',
  special: 'Special',
  filler: 'Filler',
  theatre: 'One Pace Special',
  upcoming: 'Upcoming',
  other: 'Extra',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? 'Extra';
}

/** Color accent per group kind (tailwind text/border friendly hex). */
const KIND_COLORS: Record<string, string> = {
  onepace: '#0ea5e9',
  onigashima: '#0ea5e9',
  'kuma-shaved': '#0ea5e9',
  netflix: '#e50914',
  funpace: '#a855f7',
  original: '#64748b',
  'original-continuation': '#64748b',
  log: '#f59e0b',
  movie: '#d97706',
  special: '#0d9488',
  filler: '#64748b',
  theatre: '#0d9488',
  upcoming: '#64748b',
  other: '#64748b',
};

export function kindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#64748b';
}
