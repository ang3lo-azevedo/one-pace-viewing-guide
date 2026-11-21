import raw from '../data/data.json';
import type { Episode, GuideData, Group, GuideNode, Saga, Tier } from '../types';

export const guide = raw as unknown as GuideData;
export const tiers: Tier[] = guide.meta.tiers;

// Stable unique keys (node ids can repeat, e.g. two "One Pace Special" entries).
guide.sagas.forEach((saga, si) =>
  saga.nodes.forEach((node, ni) => {
    node.uid = `${si}.${ni}`;
    node.groups.forEach((group, gi) => (group.uid = `${si}.${ni}.${gi}`));
  }),
);

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
  if (group.episodes.length && group.episodes.every((e) => e.canon)) return null;
  if (group.isAlternative || node.isAlternative) return 'alternatives';
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
