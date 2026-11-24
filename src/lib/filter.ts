import { createMemo } from 'solid-js';
import type { Episode, Group, GuideNode, Saga } from '../types';
import { extraCategory, flatById, guide } from './guide';
import { LIVE_ACTION_UID, isFinalSaga, liveActionTarget, sectionArc, sectionId } from './layout';
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
  /** Position shown in the list (1-based; a split Final Saga adds sections). */
  number: number;
  /** The original saga id (differs for Final Saga sections). */
  parentId: string;
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
  if (prefs.hideNonCanon && ep.nonCanon) return false;
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

/** The visible tree after applying all active preferences and layout options. */
export const visibleSagas = createMemo<FilteredSaga[]>(() => {
  const q = prefs.search.trim().toLowerCase();
  const { tierMin, sagaId, hideWatched } = prefs;
  const target = liveActionTarget();
  const liveAction: FilteredGroup[] = [];

  const keep = (ep: Episode, group: Group, node: GuideNode) =>
    episodeIncluded(ep, group, node) &&
    (tierMin == null || (ep.rating != null && ep.rating >= tierMin)) &&
    !(hideWatched && isWatched(ep.id)) &&
    matchesSearch(ep, q);

  const sagas: { saga: Saga; nodes: FilteredNode[] }[] = [];
  for (const saga of guide.sagas) {
    const nodes: FilteredNode[] = [];
    for (const node of saga.nodes) {
      const groups: FilteredGroup[] = [];
      for (const group of node.groups) {
        const eps = group.episodes.filter((ep) => keep(ep, group, node));
        if (!eps.length) continue;
        // Live Action moved to one place: collect it instead of showing it in this arc.
        if (target && group.kind === 'netflix') liveAction.push({ ...group, episodes: eps, afterEpisode: undefined });
        else groups.push({ ...group, episodes: eps });
      }
      if (groups.length) nodes.push({ ...node, groups });
    }
    sagas.push({ saga, nodes });
  }

  if (target && liveAction.length) {
    const host = sagas.find((x) => x.saga.id === target.saga.id)!;
    const at = host.nodes.findIndex((n) => n.uid === target.node.uid);
    const node: FilteredNode = {
      id: 'live-action',
      uid: LIVE_ACTION_UID,
      type: 'liveaction',
      title: 'ONE PIECE Live Action (Netflix)',
      rating: null,
      pace: null,
      anime: null,
      chapters: null,
      isAlternative: false,
      groups: liveAction,
    };
    host.nodes.splice(at >= 0 ? at + 1 : host.nodes.length, 0, node);
  }

  const out: FilteredSaga[] = [];
  let number = 0;
  for (const { saga, nodes } of sagas) {
    if (prefs.splitFinalSaga && isFinalSaga(saga.id)) {
      // One section per arc, each listed like a saga.
      const sections = new Map<string, FilteredSaga>();
      for (const n of nodes) {
        const arc = sectionArc(n.uid);
        if (!arc) continue;
        const id = sectionId(arc);
        if (!sections.has(id))
          sections.set(id, {
            ...saga,
            id,
            title: arc.title.replace(/ Arc$/, ''),
            rating: arc.rating,
            traktRating: arc.traktRating,
            pace: arc.pace,
            anime: arc.anime,
            chapters: arc.chapters,
            nodes: [],
            number: 0,
            parentId: saga.id,
          });
        sections.get(id)!.nodes.push(n);
      }
      for (const sec of sections.values()) {
        number++;
        if (sagaId && sagaId !== saga.id) continue;
        if (sec.nodes.length) out.push({ ...sec, number });
      }
      continue;
    }
    number++;
    if (sagaId && saga.id !== sagaId) continue;
    if (nodes.length) out.push({ ...saga, nodes, number, parentId: saga.id });
  }
  return out;
});

export const hasActiveFilters = createMemo(
  () =>
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
