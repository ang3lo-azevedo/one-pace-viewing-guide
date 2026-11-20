import { createMemo } from 'solid-js';
import type { Episode, Group, GuideNode, Saga } from '../types';
import { extraCategory, flatById, guide } from './guide';
import { prefs } from '../store/prefs';
import { isWatched } from '../store/progress';

export interface FilteredGroup extends Omit<Group, 'episodes'> {
  episodes: Episode[];
}
export interface FilteredNode extends Omit<GuideNode, 'groups'> {
  groups: FilteredGroup[];
}
export interface FilteredSaga extends Omit<Saga, 'nodes'> {
  nodes: FilteredNode[];
}

function matchesSearch(ep: Episode, q: string): boolean {
  if (!q) return true;
  const hay = [ep.title, ep.fullTitle, ep.anime, ep.chapters, ep.pace, ep.meta]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Whether a section counts as part of the user's current selection: everything, minus
 * hidden extra types, or only the canon route when "Canon Only" is on. This drives both
 * what is listed and every completion percentage.
 */
export function groupIncluded(group: Group, node: GuideNode): boolean {
  const cat = extraCategory(group, node);
  if (cat === null) return true;
  if (prefs.canonOnly) return false;
  return !prefs.hiddenExtras.includes(cat);
}

export function episodeIncluded(ep: Episode, group: Group, node: GuideNode): boolean {
  if (prefs.canonOnly) return ep.canon;
  return groupIncluded(group, node);
}

/** Keep only ids in the current selection (bulk "mark" actions skip hidden types). */
export function onlyIncluded(ids: string[]): string[] {
  return ids.filter((id) => {
    const f = flatById.get(id);
    return !!f && episodeIncluded(f.ep, f.group, f.node);
  });
}

/** The visible tree after applying all active preferences. */
export const visibleSagas = createMemo<FilteredSaga[]>(() => {
  const q = prefs.search.trim().toLowerCase();
  const { tierMin, sagaId, hideWatched } = prefs;

  const out: FilteredSaga[] = [];
  for (const saga of guide.sagas) {
    if (sagaId && saga.id !== sagaId) continue;
    const nodes: FilteredNode[] = [];
    for (const node of saga.nodes) {
      const groups: FilteredGroup[] = [];
      for (const group of node.groups) {
        const eps = group.episodes.filter((ep) => {
          if (!episodeIncluded(ep, group, node)) return false;
          if (tierMin != null && (ep.rating == null || ep.rating < tierMin)) return false;
          if (hideWatched && isWatched(ep.id)) return false;
          if (!matchesSearch(ep, q)) return false;
          return true;
        });
        if (eps.length) groups.push({ ...group, episodes: eps });
      }
      if (groups.length) nodes.push({ ...node, groups });
    }
    if (nodes.length) out.push({ ...saga, nodes });
  }
  return out;
});

export const hasActiveFilters = createMemo(
  () =>
    prefs.canonOnly ||
    prefs.search.trim() !== '' ||
    prefs.tierMin != null ||
    prefs.sagaId != null ||
    prefs.hideWatched,
);

export const visibleEpisodeCount = createMemo(() => {
  let n = 0;
  for (const s of visibleSagas()) for (const nd of s.nodes) for (const g of nd.groups) n += g.episodes.length;
  return n;
});
