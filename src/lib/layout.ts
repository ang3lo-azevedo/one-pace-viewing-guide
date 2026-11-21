import { createMemo, createRoot } from 'solid-js';
import { displayIndex, displayOrder, flatEpisodes, guide, type FlatEpisode } from './guide';
import { prefs } from '../store/prefs';
import type { GuideNode, Saga } from '../types';

/**
 * Where each entry sits given the layout preferences:
 *  - Live Action placement: next to each arc (as in the guide) or all together after
 *    Post-Enies Lobby / Thriller Bark (it shows characters and reveals earlier than the anime).
 *  - Final Saga split: Egghead and Elbaph as their own sections instead of one saga.
 */

export const LIVE_ACTION_UID = 'live-action';

const nodeById = new Map<string, { node: GuideNode; saga: Saga }>();
for (const saga of guide.sagas) for (const node of saga.nodes) if (!nodeById.has(node.id)) nodeById.set(node.id, { node, saga });

const finalSaga = guide.sagas[guide.sagas.length - 1];

/** Final Saga sections: each arc starts one; specials before it and extras after it join it. */
const finalSection = new Map<string, GuideNode>(); // node uid -> the arc heading its section
{
  const nodes = finalSaga.nodes;
  let current: GuideNode | null = null;
  const pending: GuideNode[] = [];
  for (const n of nodes) {
    if (n.type === 'arc') {
      current = n;
      for (const p of pending.splice(0)) finalSection.set(p.uid, n);
      finalSection.set(n.uid, n);
    } else if (current) finalSection.set(n.uid, current);
    else pending.push(n);
  }
  for (const p of pending) finalSection.set(p.uid, nodes.find((x) => x.type === 'arc') ?? p);
}

export const sectionId = (arc: GuideNode) => `${finalSaga.id}:${arc.id}`;
export const sectionArc = (nodeUid: string) => finalSection.get(nodeUid) ?? null;
export const isFinalSaga = (sagaId: string) => sagaId === finalSaga.id;

/** The arc the Live Action episodes follow, or null when they stay next to each arc. */
export function liveActionTarget(): { node: GuideNode; saga: Saga } | null {
  return prefs.liveActionPlacement === 'arc' ? null : (nodeById.get(prefs.liveActionPlacement) ?? null);
}

export const isMovedLiveAction = (f: FlatEpisode) => f.group.kind === 'netflix' && liveActionTarget() !== null;

/** The saga (or Final Saga section) an entry is shown under. */
export function sagaKeyOf(f: FlatEpisode): string {
  const target = isMovedLiveAction(f) ? liveActionTarget()! : null;
  const saga = target ? target.saga : f.saga;
  const node = target ? target.node : f.node;
  if (prefs.splitFinalSaga && isFinalSaga(saga.id)) {
    const arc = finalSection.get(node.uid);
    if (arc) return sectionId(arc);
  }
  return saga.id;
}

/** The arc an entry is shown under. */
export function nodeKeyOf(f: FlatEpisode): string {
  return isMovedLiveAction(f) ? LIVE_ACTION_UID : f.node.uid;
}

/** Watch order as currently laid out (moved Live Action comes right after its target arc). */
export const orderKey = createRoot(() =>
  createMemo(() => {
    const key = new Map<string, number>();
    for (const f of displayOrder) key.set(f.ep.id, displayIndex.get(f.ep.id) ?? 0);
    const target = liveActionTarget();
    if (target) {
      const inTarget = flatEpisodes.filter((f) => f.node.uid === target.node.uid);
      const after = Math.max(...inTarget.map((f) => key.get(f.ep.id) ?? 0));
      flatEpisodes
        .filter((f) => f.group.kind === 'netflix')
        .forEach((f, i) => key.set(f.ep.id, after + (i + 1) / 1000));
    }
    return key;
  }),
);

/** Entries in the current watch order. */
export const orderedEntries = createRoot(() =>
  createMemo(() => {
    const key = orderKey();
    return [...displayOrder].sort((a, b) => (key.get(a.ep.id) ?? 0) - (key.get(b.ep.id) ?? 0));
  }),
);

/** All entry ids shown under a saga/section or an arc. */
export const idsOfSagaKey = (k: string) => flatEpisodes.filter((f) => sagaKeyOf(f) === k).map((f) => f.ep.id);
export const idsOfNodeKey = (k: string) => flatEpisodes.filter((f) => nodeKeyOf(f) === k).map((f) => f.ep.id);

/** Ids that come before the first of `ids` in the current watch order. */
export function idsBefore(ids: string[]): string[] {
  const key = orderKey();
  const first = Math.min(...ids.map((id) => key.get(id) ?? Infinity));
  return orderedEntries()
    .filter((f) => (key.get(f.ep.id) ?? 0) < first)
    .map((f) => f.ep.id);
}
