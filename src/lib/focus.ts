import { waitingOn } from './pause';
import { createMemo, createRoot, createSignal } from 'solid-js';
import { visibleSagas } from './filter';
import { isWatched } from '../store/progress';
import { isDone } from './alternatives';
import { orderKey } from './layout';
import type { Episode } from '../types';

/**
 * Revealing an episode: open its saga, arc and section(s), then scroll to it and flash it.
 * Used on page load (your furthest-watched episode) and by "Continue watching".
 */
export interface FocusTarget {
  epId: string;
  sagaId: string;
  nodeUid: string;
  /** The section holding the episode plus any section it is nested in. */
  groupUids: Set<string>;
}

interface Row {
  ep: Episode;
  kind: string;
  nodeTitle: string;
  sagaId: string;
  nodeUid: string;
  groupUid: string;
  anchorOf?: string;
  alt: boolean;
}

/** Every listed episode in watch order (respects the current filters). */
function rows(): Row[] {
  const out: Row[] = [];
  for (const s of visibleSagas())
    for (const n of s.nodes)
      for (const g of n.groups)
        for (const e of g.episodes)
          out.push({ ep: e, kind: g.kind, nodeTitle: n.title, sagaId: s.id, nodeUid: n.uid, groupUid: g.uid, anchorOf: g.afterEpisode, alt: g.isAlternative || n.isAlternative });
  // On-screen order (nested sections right after the episode they follow).
  const key = orderKey();
  return out.sort((a, b) => (key.get(a.ep.id) ?? 0) - (key.get(b.ep.id) ?? 0));
}

function targetFor(epId: string, list: Row[] = rows()): FocusTarget | null {
  const hit = list.find((r) => r.ep.id === epId);
  if (!hit) return null;
  const groupOfEp = new Map(list.map((r) => [r.ep.id, r.groupUid]));
  const groupUids = new Set<string>([hit.groupUid]);
  let anchor = hit.anchorOf;
  while (anchor && groupOfEp.has(anchor)) {
    const uid = groupOfEp.get(anchor)!;
    if (groupUids.has(uid)) break;
    groupUids.add(uid);
    anchor = list.find((r) => r.groupUid === uid)?.anchorOf;
  }
  return { epId: hit.ep.id, sagaId: hit.sagaId, nodeUid: hit.nodeUid, groupUids };
}

function lastWatchedIndex(list: Row[]): number {
  let idx = -1;
  for (let i = 0; i < list.length; i++) if (isWatched(list[i].ep.id)) idx = i;
  return idx;
}

const initial = (() => {
  const list = rows();
  const i = lastWatchedIndex(list);
  return i < 0 ? null : targetFor(list[i].ep.id, list);
})();

/** The episode opened on page load (furthest watched), or null without progress. */
export const focusTarget: FocusTarget | null = initial;

const [revealSignal, setReveal] = createSignal<FocusTarget | null>(initial);
/** Sagas, arcs and sections open themselves when this points inside them. */
export const reveal = revealSignal;

function scrollTo(epId: string) {
  const el = document.querySelector<HTMLElement>(`[data-ep="${CSS.escape(epId)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.remove('focus-flash');
  void el.offsetWidth; // restart the animation
  el.classList.add('focus-flash');
  setTimeout(() => el.classList.remove('focus-flash'), 2500);
}

/** Open everything around an episode and scroll to it. */
export function revealEpisode(epId: string) {
  const t = targetFor(epId);
  if (!t) return;
  setReveal(t);
  setTimeout(() => scrollTo(epId), 80);
}

/** Scroll to the page-load target (call once after the first render). */
export function scrollToFocus() {
  if (focusTarget) scrollTo(focusTarget.epId);
}

/** The next unwatched episode after your furthest-watched one (first episode if none). */
export const nextUp = createRoot(() =>
  createMemo<Row | null>(() => {
    const list = rows();
    const start = lastWatchedIndex(list) + 1;
    const todo = (r: Row) => !r.alt && !isDone(r.ep.id);
    // Just finished a special watched mid-episode (Monsters inside Thriller Bark 13): go back
    // and finish that episode before moving on.
    const last = list[start - 1];
    if (last?.anchorOf) {
      const anchor = list.find((r) => r.ep.id === last.anchorOf);
      if (anchor && todo(anchor) && !waitingOn(anchor.ep.id).length) return anchor;
    }
    for (let i = start; i < list.length; i++) if (todo(list[i])) return list[i];
    for (let i = 0; i < start; i++) if (todo(list[i])) return list[i];
    return null;
  }),
);
