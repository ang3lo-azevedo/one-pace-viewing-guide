import { createMemo } from 'solid-js';
import { canonIds, flatEpisodes, guide, paceNumberedIds } from './guide';
import { isWatched } from '../store/progress';

/** Average One Pace episode runtime (minutes) for rough time estimates. */
const AVG_MIN = 23;

function countWatched(ids: string[]): number {
  let n = 0;
  for (const id of ids) if (isWatched(id)) n++;
  return n;
}

export interface SagaProgress {
  id: string;
  watched: number;
  total: number;
  pct: number;
}

export const stats = createMemo(() => {
  const canonTotal = canonIds.length;
  const canonWatched = countWatched(canonIds);
  const paceTotal = paceNumberedIds.length;
  const paceWatched = countWatched(paceNumberedIds);
  const allTotal = flatEpisodes.length;
  const allWatched = countWatched(flatEpisodes.map((f) => f.ep.id));

  // Per-saga canon-path progress.
  const perSaga: Record<string, SagaProgress> = {};
  let sagasCleared = 0;
  for (const saga of guide.sagas) {
    let total = 0;
    let watched = 0;
    for (const node of saga.nodes)
      for (const group of node.groups)
        for (const ep of group.episodes)
          if (ep.canon) {
            total++;
            if (isWatched(ep.id)) watched++;
          }
    const pct = total ? (watched / total) * 100 : 0;
    perSaga[saga.id] = { id: saga.id, watched, total, pct };
    if (total > 0 && watched === total) sagasCleared++;
  }

  const canonPct = canonTotal ? (canonWatched / canonTotal) * 100 : 0;
  const remainingCanon = canonTotal - canonWatched;

  return {
    canonTotal,
    canonWatched,
    canonPct,
    remainingCanon,
    paceTotal,
    paceWatched,
    allTotal,
    allWatched,
    perSaga,
    sagasCleared,
    sagasTotal: guide.sagas.length,
    hoursWatched: Math.round((canonWatched * AVG_MIN) / 60),
    hoursRemaining: Math.round((remainingCanon * AVG_MIN) / 60),
  };
});
