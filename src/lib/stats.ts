import { createMemo } from 'solid-js';
import { displayOrder, guide, type FlatEpisode } from './guide';
import { episodeIncluded } from './filter';
import { watchedAt } from '../store/progress';
import { prefs } from '../store/prefs';
import { isAlternativeEntry, isDone } from './alternatives';
import { extraCategory, type ExtraCategory } from './guide';
import { BOUNTY_REVEALS, CREW } from './bounties';

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

export const minutesForKind = (kind: string) => KIND_MINUTES[kind] ?? 24;
export const minutesOf = (f: FlatEpisode) => minutesForKind(f.group.kind);

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
  /** Entries done / total (for the "x/y" counters). */
  watched: number;
  total: number;
  /** Minutes done / total; the percentage is by time, not by number of entries. */
  minDone: number;
  minTotal: number;
  pct: number;
}

/** Arcs ("islands") in story order: arc nodes that have canon-route episodes. */
const islands = guide.sagas.flatMap((s) =>
  s.nodes.filter((n) => n.type === 'arc' && n.groups.some((g) => g.episodes.some((e) => e.canon))),
);

const DAY = 86_400_000;
/** Pace window: minutes watched over the last 28 days (at least 3 days, so a binge day isn't a pace). */
const PACE_WINDOW = 28 * DAY;

/** Hideable extra types with their own counters. */
const EXTRA_KINDS: [ExtraCategory, string][] = [
  ['movies', 'Movies'],
  ['specials', 'Specials'],
  ['liveAction', 'Live Action'],
  ['filler', 'Filler & Fun Pace'],
  ['original', 'Original anime'],
];

export const stats = createMemo(() => {
  const perSaga: Record<string, Progress> = {};
  const perNode: Record<string, Progress> = {};
  const perGroup: Record<string, Progress> = {};
  const bump = (rec: Record<string, Progress>, key: string, done: boolean, min: number) => {
    const p = (rec[key] ??= { watched: 0, total: 0, minDone: 0, minTotal: 0, pct: 0 });
    p.total++;
    p.minTotal += min;
    if (done) {
      p.watched++;
      p.minDone += min;
    }
  };

  let selWatched = 0;
  let selTotal = 0;
  let selMinWatched = 0;
  let selMinTotal = 0;
  const selAnime = new Set<number>();

  let canonWatched = 0;
  let canonTotal = 0;
  let canonMinWatched = 0;
  let canonMinTotal = 0;
  const animeSeen = new Set<number>();
  const chaptersSeen = new Set<number>();
  const animeAll = new Set<number>();

  const extras: Record<string, { label: string; watched: number; total: number; minLeft: number }> = {};
  for (const [k, label] of EXTRA_KINDS) extras[k] = { label, watched: 0, total: 0, minLeft: 0 };

  // Pace: minutes of entries marked in the last 28 days.
  const now = Date.now();
  let paceMin = 0;
  let paceFrom = now;

  // Remaining entries in watch order, for the finish estimates.
  const remaining: { f: FlatEpisode; min: number }[] = [];

  for (const f of displayOrder) {
    // Alternative versions are optional: never counted as remaining.
    if (isAlternativeEntry(f)) continue;
    const done = isDone(f.ep.id);
    const min = minutesOf(f);

    if (f.ep.canon) {
      canonTotal++;
      canonMinTotal += min;
      for (const n of numbers(f.ep.anime)) animeAll.add(n);
      if (done) {
        canonWatched++;
        canonMinWatched += min;
        for (const n of numbers(f.ep.anime)) animeSeen.add(n);
        for (const n of numbers(f.ep.chapters)) chaptersSeen.add(n);
      }
    }

    const cat = extraCategory(f.group, f.node);
    if (cat && extras[cat]) {
      extras[cat].total++;
      if (done) extras[cat].watched++;
      else extras[cat].minLeft += min;
    }

    if (!episodeIncluded(f.ep, f.group, f.node)) continue;
    selTotal++;
    selMinTotal += min;
    if (f.ep.canon) for (const n of numbers(f.ep.anime)) selAnime.add(n);
    if (done) {
      selWatched++;
      selMinWatched += min;
      const t = watchedAt(f.ep.id);
      if (t && now - t <= PACE_WINDOW) {
        paceMin += min;
        paceFrom = Math.min(paceFrom, t);
      }
    } else if (min > 0) remaining.push({ f, min });
    bump(perSaga, f.saga.id, done, min);
    bump(perNode, f.node.uid, done, min);
    bump(perGroup, f.group.uid, done, min);
  }
  for (const rec of [perSaga, perNode, perGroup])
    for (const p of Object.values(rec)) p.pct = p.minTotal ? (p.minDone / p.minTotal) * 100 : pct(p.watched, p.total);

  // --- pace and finish estimates ---
  const paceDays = Math.max(3, (now - paceFrom) / DAY);
  const historyPace = paceMin > 0 ? paceMin / paceDays : 0; // minutes per day
  // A pace you picked wins; otherwise your recent history.
  const pacePerDay = prefs.paceMinutes ?? historyPace;
  const eta: Record<string, number> = {};
  const etaNode: Record<string, number> = {};
  const etaSaga: Record<string, number> = {};
  let canonEta: number | null = null;
  if (pacePerDay > 0) {
    let cum = 0;
    for (const { f, min } of remaining) {
      cum += min;
      const t = now + (cum / pacePerDay) * DAY;
      eta[f.ep.id] = t;
      etaNode[f.node.uid] = t;
      etaSaga[f.saga.id] = t;
      if (f.ep.canon) canonEta = t;
    }
  }

  // --- islands & sagas conquered (canon route) ---
  const done = (eps: { id: string; canon: boolean }[]) => {
    const c = eps.filter((e) => e.canon);
    return c.length > 0 && c.every((e) => isDone(e.id));
  };
  const islandDone = islands.map((n) => done(n.groups.flatMap((g) => g.episodes)));
  const islandsConquered = islandDone.filter(Boolean).length;
  const sagasConquered = guide.sagas.filter((s) => done(s.nodes.flatMap((n) => n.groups.flatMap((g) => g.episodes)))).length;

  // An island is "passed" once it is complete or any later island has been started.
  let lastStarted = -1;
  islands.forEach((n, i) => {
    if (n.groups.some((g) => g.episodes.some((e) => e.canon && isDone(e.id)))) lastStarted = i;
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

  const animeMinSeen = animeSeen.size * ANIME_EP_MIN;

  return {
    // canon route (percentages by time)
    canonWatched,
    canonTotal,
    canonPct: pct(canonMinWatched, canonMinTotal),
    // current selection
    selWatched,
    selTotal,
    selPct: pct(selMinWatched, selMinTotal),
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
    extras: EXTRA_KINDS.map(([k]) => ({ key: k, ...extras[k] })),
    // pace and finish estimates (null / empty without recent watching)
    pacePerDay,
    historyPace,
    paceDays,
    eta,
    etaNode,
    etaSaga,
    finishSelection: remaining.length && pacePerDay ? eta[remaining[remaining.length - 1].f.ep.id] : null,
    finishCanon: canonEta,
    finishCanonOnly: pacePerDay ? now + ((canonMinTotal - canonMinWatched) / pacePerDay) * DAY : null,
    // achievements
    islandsConquered,
    islandsTotal: islands.length,
    sagasConquered,
    sagasTotal: guide.sagas.length,
    chaptersSeen: chaptersSeen.size,
    animeSeen: animeSeen.size,
    crew,
    crewAsOf: lastPassed?.title ?? null,
  };
});

/** "24m", "1h 50m". */
export function fmtDuration(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}m` : ''}`;
}

/** "12 Jan" (adds the year when it is not this year). */
export function fmtDate(t: number): string {
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}
