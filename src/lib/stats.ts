import { createMemo } from 'solid-js';
import { displayOrder, guide, type FlatEpisode } from './guide';
import { nodeKeyOf, orderedEntries, sagaKeyOf } from './layout';
import { episodeIncluded } from './filter';
import { isWatched, watchedAt } from '../store/progress';
import { prefs } from '../store/prefs';
import { trakt } from '../store/trakt';
import { measurePace, type Play } from './pace';
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

/** Real runtimes of the original anime episodes (from Trakt), for the "vs. full anime" comparison. */
const ANIME_RT = (guide.meta as { animeRuntimes?: Record<string, number> }).animeRuntimes ?? {};
/** Minutes of the original anime for a set of episode numbers (24 min where unknown). */
export const animeMinutes = (nums: Iterable<number>) => {
  let m = 0;
  for (const n of nums) m += ANIME_RT[n] ?? 24;
  return m;
};

export const minutesForKind = (kind: string) => KIND_MINUTES[kind] ?? 24;
/** Real length when published, otherwise the estimate for its kind. */
export const minutesOf = (f: FlatEpisode) => f.ep.runtime ?? minutesForKind(f.group.kind);

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
  const localPlays: Play[] = [];
  // One Pace's own numbered episodes (onepace.net watch links), including alternative ones.
  let onePaceWatched = 0;
  let onePaceTotal = 0;
  for (const f of displayOrder)
    if (/\/watch#[a-z0-9-]+-\d+$/.test(f.ep.links.onepace ?? '')) {
      onePaceTotal++;
      if (isDone(f.ep.id) || isWatched(f.ep.id)) onePaceWatched++;
    }

  // Remaining entries in watch order, for the finish estimates.
  const remaining: { f: FlatEpisode; min: number }[] = [];

  for (const f of orderedEntries()) {
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
      if (t) localPlays.push({ t, min });
    } else if (min > 0) remaining.push({ f, min });
    bump(perSaga, sagaKeyOf(f), done, min);
    bump(perNode, nodeKeyOf(f), done, min);
    bump(perGroup, f.group.uid, done, min);
  }
  for (const rec of [perSaga, perNode, perGroup])
    for (const p of Object.values(rec)) p.pct = p.minTotal ? (p.minDone / p.minTotal) * 100 : pct(p.watched, p.total);

  // --- pace and finish estimates ---
  // Auto: your Trakt history when connected (covers other devices), else what you checked here.
  const local = measurePace(localPlays, now);
  const fromTrakt = trakt.pace && trakt.pace.perDay > 0 ? trakt.pace : null;
  const auto = fromTrakt ?? local;
  const historyPace = auto.perDay;
  const paceDays = auto.days;
  const paceSource: 'trakt' | 'local' | null = fromTrakt ? 'trakt' : local.perDay > 0 ? 'local' : null;
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
      etaNode[nodeKeyOf(f)] = t;
      etaSaga[sagaKeyOf(f)] = t;
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

  const animeMinSeen = animeMinutes(animeSeen);

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
    onePaceWatched,
    onePaceTotal,
    animeEquivMin: animeMinutes(selAnime),
    savedSoFarMin: Math.max(0, animeMinSeen - canonMinWatched),
    savedTotalMin: Math.max(0, animeMinutes(animeAll) - canonMinTotal),
    // progress tables
    perSaga,
    perNode,
    perGroup,
    extras: EXTRA_KINDS.map(([k]) => ({ key: k, ...extras[k] })),
    // pace and finish estimates (null / empty without recent watching)
    pacePerDay,
    historyPace,
    paceDays,
    paceSource,
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
  if (m >= 24 * 60) return fmtSpan(m);
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}m` : ''}`;
}

/** "12 Jan" (adds the year when it is not this year). */
export function fmtDate(t: number): string {
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Long durations in days: "8d 23h" (or "Xh YYm" under a day). */
export function fmtSpan(min: number): string {
  const m = Math.round(min);
  if (m < 24 * 60 || prefs.longTimes === 'hours') return fmtHours(m);
  const d = Math.floor(m / 1440);
  const h = Math.round((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Calendar distance from now: "today", "in 5 days", "in 3 weeks", "in 7 months", "in 1 year 2 months". */
export function fmtFromNow(t: number): string {
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  if (days < 61) return `in ${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `in ${months} months`;
  const y = Math.floor(months / 12);
  const rest = months % 12;
  return `in ${y} year${y > 1 ? 's' : ''}${rest ? ` ${rest} month${rest > 1 ? 's' : ''}` : ''}`;
}

/**
 * Read a typed pace as minutes per day: "90", "90m", "1h", "1.5h", "1h30", "1:30",
 * "2 eps" (episodes of ~25 min). Returns null when it can't be read.
 */
export function parsePace(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.');
  if (!t) return null;
  let m = t.match(/^(\d+(?:\.\d+)?)\s*(?:eps?|episodes?)$/);
  if (m) return Math.round(+m[1] * 25) || null;
  m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2] || null;
  m = t.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(?:(\d+)\s*(?:m(?:in(?:utes?)?)?)?)?$/) ?? t.match(/^()(\d+)\s*m(?:in(?:utes?)?)?$/);
  if (m && (m[1] || m[2])) return Math.round((m[1] ? +m[1] * 60 : 0) + (m[2] ? +m[2] : 0)) || null;
  m = t.match(/^(\d+)$/);
  if (m) return +m[1] || null;
  return null;
}
