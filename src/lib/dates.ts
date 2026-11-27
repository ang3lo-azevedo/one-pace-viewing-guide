import raw from '../data/data.json';

/**
 * Release dates (scripts/fetch_release_dates.py): One Pace releases, films and specials carry
 * their own (`released`, `firstReleased`); the original anime's air dates and the manga's
 * chapter dates are kept once in meta and looked up by number.
 */
const meta = (raw as { meta: { animeAired?: Record<string, string>; chapterDates?: Record<string, string> } }).meta;
const ANIME = meta.animeAired ?? {};
const CHAPTERS = meta.chapterDates ?? {};

/** Numbers in a list like "250–251, 256" ("206 [207 ending]" counts 206 only). */
function numbers(text: string | null | undefined): number[] {
  const out: number[] = [];
  for (const part of (text ?? '').replace(/\[[^\]]*\]/g, '').replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const r = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (r) for (let n = +r[1]; n <= +r[2] && n - +r[1] < 400; n++) out.push(n);
    else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

export type Span = [string, string];

function span(dates: (string | undefined)[]): Span | null {
  const known = dates.filter((d): d is string => !!d).sort();
  return known.length ? [known[0], known[known.length - 1]] : null;
}

/** When the original anime episodes in this list aired. */
export const airedSpan = (anime: string | null | undefined) => span(numbers(anime).map((n) => ANIME[n]));
/** When the manga chapters in this list came out. */
export const publishedSpan = (chapters: string | null | undefined) => span(numbers(chapters).map((n) => CHAPTERS[n]));
/** Earliest and latest of some dates (null if none). */
export const spanOf = (dates: (string | null | undefined)[]) => span(dates.map((d) => d ?? undefined));

const asDate = (d: string) => new Date(d + 'T12:00:00Z');
const DAY: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
const MONTH: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', timeZone: 'UTC' };

/** "Oct 20, 1999". */
export const fmtDay = (d: string) => asDate(d).toLocaleDateString(undefined, DAY);

/** "Oct 20 – Nov 17, 1999" for short spans, "Jul 1997 – Mar 1998" for long ones. */
export function fmtSpan([a, b]: Span): string {
  if (a === b) return fmtDay(a);
  const long = asDate(b).getTime() - asDate(a).getTime() > 92 * 864e5;
  const f = new Intl.DateTimeFormat(undefined, long ? MONTH : DAY) as Intl.DateTimeFormat & {
    formatRange?: (x: Date, y: Date) => string;
  };
  return f.formatRange ? f.formatRange(asDate(a), asDate(b)) : `${f.format(asDate(a))} – ${f.format(asDate(b))}`;
}
