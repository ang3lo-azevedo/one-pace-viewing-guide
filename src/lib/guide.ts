import raw from '../data/data.json';
import type { Episode, GuideData, Group, GuideNode, Saga, Tier } from '../types';

export const guide = raw as unknown as GuideData;
export const tiers: Tier[] = guide.meta.tiers;

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

/** Canon-path episode ids (the recommended One Pace viewing route). */
export const canonIds: string[] = flatEpisodes.filter((f) => f.ep.canon).map((f) => f.ep.id);
export const allIds: string[] = flatEpisodes.map((f) => f.ep.id);

/** Official numbered "Pace N" episodes (the 472 canon set stat). */
export const paceNumberedIds: string[] = flatEpisodes
  .filter((f) => f.group.kind === 'onepace' && f.ep.paceNumber != null)
  .map((f) => f.ep.id);

/** Episode ids in watch order (document order). */
export const orderedIds: string[] = flatEpisodes.map((f) => f.ep.id);

const firstIdxOfNode = new Map<string, number>();
const firstIdxOfSaga = new Map<string, number>();
flatEpisodes.forEach((f, i) => {
  if (!firstIdxOfNode.has(f.node.id)) firstIdxOfNode.set(f.node.id, i);
  if (!firstIdxOfSaga.has(f.saga.id)) firstIdxOfSaga.set(f.saga.id, i);
});

export const allIdsOfNode = (nodeId: string): string[] =>
  flatEpisodes.filter((f) => f.node.id === nodeId).map((f) => f.ep.id);
export const allIdsOfSaga = (sagaId: string): string[] =>
  flatEpisodes.filter((f) => f.saga.id === sagaId).map((f) => f.ep.id);
export const idsBeforeNode = (nodeId: string): string[] =>
  orderedIds.slice(0, firstIdxOfNode.get(nodeId) ?? 0);
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
  onepace: '#38bdf8',
  onigashima: '#38bdf8',
  'kuma-shaved': '#38bdf8',
  netflix: '#e50914',
  funpace: '#a855f7',
  original: '#94a3b8',
  'original-continuation': '#94a3b8',
  log: '#f59e0b',
  movie: '#f4d35e',
  special: '#2dd4bf',
  filler: '#64748b',
  theatre: '#2dd4bf',
  upcoming: '#64748b',
  other: '#64748b',
};

export function kindColor(kind: string): string {
  return KIND_COLORS[kind] ?? '#64748b';
}
