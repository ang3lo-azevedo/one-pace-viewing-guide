const DAY = 86_400_000;
export const PACE_WINDOW_DAYS = 28;

export interface Play {
  /** When it was watched (ms epoch). */
  t: number;
  /** Its length in minutes. */
  min: number;
}

export interface Pace {
  /** Minutes watched per day (0 when there is no usable history). */
  perDay: number;
  /** Days the pace is measured over. */
  days: number;
  /** Plays counted. */
  plays: number;
}

/**
 * Watching pace over the last 28 days. Many plays stamped with the same minute are a bulk
 * mark (catching up, a Trakt import), not watching, so those are left out. The pace is
 * measured over at least 3 days, so one long day isn't taken as your daily pace.
 */
export function measurePace(all: Play[], now = Date.now()): Pace {
  const recent = all.filter((p) => p.t > 1 && now - p.t <= PACE_WINDOW_DAYS * DAY && p.min > 0);
  const perMinute = new Map<number, number>();
  for (const p of recent) {
    const k = Math.floor(p.t / 60_000);
    perMinute.set(k, (perMinute.get(k) ?? 0) + 1);
  }
  const real = recent.filter((p) => (perMinute.get(Math.floor(p.t / 60_000)) ?? 0) <= 3);
  if (!real.length) return { perDay: 0, days: 0, plays: 0 };
  const from = Math.min(...real.map((p) => p.t));
  const days = Math.max(3, (now - from) / DAY);
  const minutes = real.reduce((m, p) => m + p.min, 0);
  return { perDay: minutes / days, days, plays: real.length };
}
