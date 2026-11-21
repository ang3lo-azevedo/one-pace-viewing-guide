import { visibleSagas } from './filter';
import { isWatched } from '../store/progress';

/**
 * Where to jump when the site opens: the furthest-watched episode in the current list
 * (or, if watched episodes are hidden, the next one after it). Computed once at load, so
 * later filter changes don't keep reopening it.
 */
export interface FocusTarget {
  epId: string;
  sagaId: string;
  nodeUid: string;
  /** The section holding the episode plus any section it is nested in. */
  groupUids: Set<string>;
}

function compute(): FocusTarget | null {
  const order: { epId: string; sagaId: string; nodeUid: string; groupUid: string; anchorOf?: string }[] = [];
  const groupOfEp = new Map<string, string>();
  for (const s of visibleSagas())
    for (const n of s.nodes)
      for (const g of n.groups)
        for (const e of g.episodes) {
          order.push({ epId: e.id, sagaId: s.id, nodeUid: n.uid, groupUid: g.uid, anchorOf: g.afterEpisode });
          groupOfEp.set(e.id, g.uid);
        }

  let idx = -1;
  for (let i = 0; i < order.length; i++) if (isWatched(order[i].epId)) idx = i;
  if (idx < 0) return null;
  const hit = order[idx];

  // Open the episode's section and every section it is nested inside.
  const groupUids = new Set<string>([hit.groupUid]);
  let anchor = hit.anchorOf;
  while (anchor && groupOfEp.has(anchor)) {
    const uid = groupOfEp.get(anchor)!;
    if (groupUids.has(uid)) break;
    groupUids.add(uid);
    anchor = order.find((o) => o.groupUid === uid)?.anchorOf;
  }
  return { epId: hit.epId, sagaId: hit.sagaId, nodeUid: hit.nodeUid, groupUids };
}

export const focusTarget: FocusTarget | null = compute();

/** Scroll to the focus episode and highlight it briefly (call after the first render). */
export function scrollToFocus() {
  if (!focusTarget) return;
  const el = document.querySelector<HTMLElement>(`[data-ep="${CSS.escape(focusTarget.epId)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('focus-flash');
  setTimeout(() => el.classList.remove('focus-flash'), 2500);
}
