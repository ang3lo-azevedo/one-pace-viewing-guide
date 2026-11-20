import { createMemo } from 'solid-js';
import { flatEpisodes, guide, type FlatEpisode } from './guide';
import { episodeIncluded } from './filter';
import { isWatched } from '../store/progress';
import { BOUNTY_PER_EPISODE, BOUNTY_REVEALS, CREW, pirateRank } from './bounties';

/**
 * Rough runtime per entry (minutes), by section kind. One Pace episodes average ~24 min;
 * movies and Live Action episodes run much longer. Placeholder entries (upcoming films,
 * "continue with the original anime" pointers) count as 0.
 */
const KIND_MINUTES: Record<string, number> = {
  onepace: 24,
  onigashima: 24,
  'kuma-shaved': 24,
  funpace: 24,
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

/** One original TV anime episode (minutes), for the "vs. full anime" comparison. */
const ANIME_EP_MIN = 24;

export const minutesOf = (f: FlatEpisode) => KIND_MINUTES[f.group.kind] ?? 24;

/** Integers from fields like "250–251, 256, 320" (anime episodes or manga chapters). */
function numbers(text: string | null): number[] {
  if (!text) return [];
  const out: number[] = [];
  for (const part of text.replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = +range[1];
      const b = +range[2];
      if (b >= a && b - a < 80) for (let n = a; n <= b; n++) out.push(n);
    } else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

export function fmtHours(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

export interface Progress {
  watched: number;
  total: number;
  pct: number;
}

/** Arcs ("islands") in story order: arc nodes that have canon-route episodes. */
const islands = guide.sagas.flatMap((s) =>
  s.nodes.filter((n) => n.type === 'arc' && n.groups.some((g) => g.episodes.some((e) => e.canon))),
);

export const stats = createMemo(() => {
  // --- selection (respects Canon Only and hidden extra types) ---
  const perSaga: Record<string, Progress> = {};
  const perNode: Record<string, Progress> = {};
  const perGroup: Record<string, Progress> = {};
  const bump = (rec: Record<string, Progress>, key: string, w: boolean) => {
    const p = (rec[key] ??= { watched: 0, total: 0, pct: 0 });
    p.total++;
    if (w) p.watched++;
  };

  let selWatched = 0;
  let selTotal = 0;
  let selMinWatched = 0;
  let selMinTotal = 0;
  const selAnime = new Set<number>();

  // --- canon route ---
  let canonWatched = 0;
  let canonTotal = 0;
  let canonMinWatched = 0;
  const animeSeen = new Set<number>();
  const chaptersSeen = new Set<number>();
  const animeAll = new Set<number>();
  let canonMinTotal = 0;

  for (const f of flatEpisodes) {
    const w = isWatched(f.ep.id);
    const min = minutesOf(f);

    if (f.ep.canon) {
      canonTotal++;
      canonMinTotal += min;
      for (const n of numbers(f.ep.anime)) animeAll.add(n);
      if (w) {
        canonWatched++;
        canonMinWatched += min;
        for (const n of numbers(f.ep.anime)) animeSeen.add(n);
        for (const n of numbers(f.ep.chapters)) chaptersSeen.add(n);
      }
    }

    if (!episodeIncluded(f.ep, f.group, f.node)) continue;
    selTotal++;
    selMinTotal += min;
    if (f.ep.canon) for (const n of numbers(f.ep.anime)) selAnime.add(n);
    if (w) {
      selWatched++;
      selMinWatched += min;
    }
    bump(perSaga, f.saga.id, w);
    bump(perNode, f.node.uid, w);
    bump(perGroup, f.group.uid, w);
  }
  for (const rec of [perSaga, perNode, perGroup]) for (const p of Object.values(rec)) p.pct = pct(p.watched, p.total);

  // --- islands & sagas conquered (canon route) ---
  const done = (eps: { id: string; canon: boolean }[]) => {
    const c = eps.filter((e) => e.canon);
    return c.length > 0 && c.every((e) => isWatched(e.id));
  };
  const islandDone = islands.map((n) => done(n.groups.flatMap((g) => g.episodes)));
  const islandsConquered = islandDone.filter(Boolean).length;
  const sagasConquered = guide.sagas.filter((s) => done(s.nodes.flatMap((n) => n.groups.flatMap((g) => g.episodes)))).length;

  // An island is "passed" once it is complete or any later island has been started.
  let lastStarted = -1;
  islands.forEach((n, i) => {
    if (n.groups.some((g) => g.episodes.some((e) => e.canon && isWatched(e.id)))) lastStarted = i;
  });
  const passed = new Set<string>();
  islands.forEach((n, i) => {
    if (islandDone[i] || i < lastStarted) passed.add(n.id);
  });
  const lastPassed = [...islands].reverse().find((n) => passed.has(n.id)) ?? null;

  // --- crew bounties (spoiler-gated) ---
  const bounties: Record<string, number | null> = {};
  for (const [arc, vals] of BOUNTY_REVEALS) if (passed.has(arc)) Object.assign(bounties, vals);
  const crew = CREW.filter((c) => c.key === 'luffy' || passed.has(c.joins) || (c.joins === 'romance-dawn-arc' && lastStarted >= 0)).map(
    (c) => ({ ...c, bounty: bounties[c.key] ?? null }),
  );

  const bounty = canonWatched * BOUNTY_PER_EPISODE;
  const animeMinSeen = animeSeen.size * ANIME_EP_MIN;

  return {
    // canon route
    canonWatched,
    canonTotal,
    canonPct: pct(canonWatched, canonTotal),
    // current selection
    selWatched,
    selTotal,
    selPct: pct(selWatched, selTotal),
    minWatched: selMinWatched,
    minTotal: selMinTotal,
    minLeft: selMinTotal - selMinWatched,
    canonMinLeft: canonMinTotal - canonMinWatched,
    animeEquivMin: selAnime.size * ANIME_EP_MIN,
    savedSoFarMin: Math.max(0, animeMinSeen - canonMinWatched),
    savedTotalMin: Math.max(0, animeAll.size * ANIME_EP_MIN - canonMinTotal),
    // progress tables
    perSaga,
    perNode,
    perGroup,
    // achievements
    islandsConquered,
    islandsTotal: islands.length,
    sagasConquered,
    sagasTotal: guide.sagas.length,
    chaptersSeen: chaptersSeen.size,
    animeSeen: animeSeen.size,
    bounty,
    rank: pirateRank(bounty),
    crew,
    crewAsOf: lastPassed?.title ?? null,
  };
});
