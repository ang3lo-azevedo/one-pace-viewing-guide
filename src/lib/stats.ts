import { createMemo } from 'solid-js';
import { flatEpisodes, guide, paceNumberedIds, type FlatEpisode } from './guide';
import { isWatched } from '../store/progress';

/**
 * Rough runtime per entry (minutes), by group kind. One Pace episodes run a little longer
 * than a TV episode; movies and Live Action episodes are much longer. Placeholder entries
 * (upcoming films, "continue with the original anime" pointers) count as 0.
 */
const KIND_MINUTES: Record<string, number> = {
  onepace: 25,
  onigashima: 25,
  'kuma-shaved': 24,
  funpace: 25,
  original: 24,
  log: 24,
  filler: 24,
  special: 30,
  theatre: 20,
  movie: 110,
  netflix: 60,
  'original-continuation': 0,
  upcoming: 0,
  other: 24,
};

/** Length of one original TV anime episode (minutes), for the time-saved comparison. */
const ANIME_EP_MIN = 24;

const minutesOf = (f: FlatEpisode) => KIND_MINUTES[f.group.kind] ?? 24;

/** Anime episode numbers from an `anime` field such as "250–251, 256, 320". */
function animeNumbers(text: string | null): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const part of text.replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = +range[1];
      const b = +range[2];
      if (b > a && b - a < 60) for (let n = a; n <= b; n++) out.push(n);
    } else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

const canonEntries = flatEpisodes.filter((f) => f.ep.canon);

/** Minutes of original anime the canon route replaces vs. the One Pace minutes to watch it. */
const animeCovered = new Set<number>();
for (const f of canonEntries) for (const n of animeNumbers(f.ep.anime)) animeCovered.add(n);
const totalSavedMin = Math.max(
  0,
  animeCovered.size * ANIME_EP_MIN - canonEntries.reduce((m, f) => m + minutesOf(f), 0),
);

const hours = (min: number) => Math.round(min / 60);
const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export interface SagaProgress {
  id: string;
  watched: number;
  total: number;
  pct: number;
}

export const stats = createMemo(() => {
  let canonWatched = 0;
  let canonMinLeft = 0;
  let allWatched = 0;
  let allMinLeft = 0;
  const animeSeen = new Set<number>();
  let canonMinWatched = 0;

  for (const f of flatEpisodes) {
    const w = isWatched(f.ep.id);
    const min = minutesOf(f);
    if (w) allWatched++;
    else allMinLeft += min;
    if (f.ep.canon) {
      if (w) {
        canonWatched++;
        canonMinWatched += min;
        for (const n of animeNumbers(f.ep.anime)) animeSeen.add(n);
      } else canonMinLeft += min;
    }
  }

  const paceWatched = paceNumberedIds.filter((id) => isWatched(id)).length;

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
    perSaga[saga.id] = { id: saga.id, watched, total, pct: pct(watched, total) };
    if (total > 0 && watched === total) sagasCleared++;
  }

  const canonTotal = canonEntries.length;
  const allTotal = flatEpisodes.length;

  return {
    canonTotal,
    canonWatched,
    canonPct: pct(canonWatched, canonTotal),
    allTotal,
    allWatched,
    allPct: pct(allWatched, allTotal),
    paceTotal: paceNumberedIds.length,
    paceWatched,
    perSaga,
    sagasCleared,
    sagasTotal: guide.sagas.length,
    hoursLeftCanon: hours(canonMinLeft),
    hoursLeftAll: hours(allMinLeft),
    hoursSavedTotal: hours(totalSavedMin),
    hoursSavedSoFar: hours(Math.max(0, animeSeen.size * ANIME_EP_MIN - canonMinWatched)),
  };
});
