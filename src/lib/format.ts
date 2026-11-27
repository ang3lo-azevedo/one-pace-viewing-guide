export const SERIESGRAPH_SHOW = 'https://seriesgraph.com/show/37854-one-piece';

/** First anime episode number in a field like "234–235, 240" (or null). */
export function firstAnimeEpisode(text: string | null): number | null {
  // Only real episode numbers ("196", "196–197", "250-251, 256"), not "TV Special 14" or "Ep. Omakes 1–5".
  const m = text?.match(/^\s*(\d+)/);
  return m ? +m[1] : null;
}

/** Render the guide's small Markdown subset (**bold**, *italic*, `code`) as safe HTML. */
export function inlineMd(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\$\\rightarrow\$/g, '→');
}

import { airedSpan, fmtDay, fmtSpan, publishedSpan, spanOf } from './dates';

// ---- episode / chapter info ---------------------------------------------------

/** Count the numbers in a list like "250–251, 256, 320" (null if it has none). */
export function countNumbers(text: string | null): number | null {
  if (!text) return null;
  let n = 0;
  for (const part of text.replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const r = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (r) n += Math.max(0, +r[2] - +r[1] + 1);
    else if (/^\d+$/.test(p)) n += 1;
  }
  return n || null;
}

export interface InfoPart {
  label: string;
  value: string;
  title?: string;
}

/** Split "4 / Episode of East Blue" into the numeric list and the extra text. */
function splitExtra(text: string): { nums: string; extra: string } {
  const m = text.match(/^([\d,\s–-]+)(.*)$/);
  if (!m) return { nums: '', extra: text.trim() };
  return { nums: m[1].trim().replace(/[,\s]+$/, ''), extra: m[2].replace(/^[\s/,]+/, '').trim() };
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

/** "Pace 1" -> "Pace #1", "Kuma Cut Ep. 02" -> "Kuma Cut #2", "Log 7" -> "Log #7". */
export function releaseLabel(pace: string | null, meta: string | null): string | null {
  let raw = pace;
  if (!raw && meta) {
    const first = meta.split('•')[0].trim();
    if (!/^(anime|ch\b|ch\.|manga|original)/i.test(first) && /\d/.test(first)) raw = first;
  }
  if (!raw) return null;
  if (/^netflix/i.test(raw)) return raw.replace(/^netflix\s*/i, 'Live Action ');
  const m = raw.match(/^(.*?)(?:\s+Ep\.)?\s+([\d.]+)$/);
  if (!m) return raw;
  const name = m[1].replace(/^FunPace$/i, 'Fun Pace');
  return `${name} #${String(+m[2])}`;
}

/** Labelled parts for one episode: release number, anime episodes, manga chapters. */
export function episodeInfo(ep: {
  pace: string | null;
  anime: string | null;
  chapters: string | null;
  meta: string | null;
  released?: string;
  firstReleased?: string;
}): InfoPart[] {
  const parts: InfoPart[] = [];
  const rel = releaseLabel(ep.pace, ep.meta);
  if (rel) parts.push({ label: '', value: rel });

  if (ep.anime) {
    const { nums, extra } = splitExtra(ep.anime);
    const n = countNumbers(nums);
    if (nums) {
      parts.push({
        label: n && n > 1 ? 'Anime eps' : 'Anime ep',
        value: nums + (extra ? ` + ${extra}` : ''),
        title: n ? `Covers ${plural(n, 'original anime episode')}${extra ? ` plus ${extra}` : ''}` : undefined,
      });
    } else parts.push({ label: 'Anime', value: extra });
  }

  if (ep.chapters) {
    const { nums, extra } = splitExtra(ep.chapters);
    const n = countNumbers(nums);
    if (nums) {
      parts.push({
        label: n && n > 1 ? 'Chapters' : 'Chapter',
        value: nums + (extra ? ` ${extra}` : ''),
        title: n ? `Adapts ${plural(n, 'manga chapter')}` : undefined,
      });
    } else parts.push({ label: 'Manga', value: extra });
  }
  parts.push(...dateParts(ep));
  return parts;
}

/** When this came out: the release itself, the original anime broadcast, the manga chapters. */
function dateParts(ep: { anime: string | null; chapters: string | null; released?: string; firstReleased?: string }): InfoPart[] {
  const parts: InfoPart[] = [];
  if (ep.released)
    parts.push({
      label: 'Released',
      value: fmtDay(ep.released),
      title: ep.firstReleased ? `First released ${fmtDay(ep.firstReleased)}; this version ${fmtDay(ep.released)}` : 'Release date of this version',
    });
  const aired = airedSpan(ep.anime);
  if (aired) parts.push({ label: 'Aired', value: fmtSpan(aired), title: 'When the original anime episodes aired in Japan' });
  const published = publishedSpan(ep.chapters);
  if (published) parts.push({ label: 'Published', value: fmtSpan(published), title: 'When the manga chapters came out in Weekly Shonen Jump' });
  return parts;
}

type Dated = { released?: string; groups?: { kind: string; isAlternative: boolean; episodes: { released?: string }[] }[]; nodes?: Dated[]; isAlternative?: boolean };
/** First to latest One Pace release of an arc or saga's main route. */
function releasedSpan(r: Dated) {
  const nodes = r.nodes ?? [r];
  return spanOf(
    nodes
      .filter((n) => !n.isAlternative)
      .flatMap((n) => (n.groups ?? []).filter((g) => g.kind === 'onepace' && !g.isAlternative).flatMap((g) => g.episodes.map((e) => e.released))),
  );
}

/** Arc/saga summary parts, with counts. */
export function rangeInfo(r: { pace: string | null; anime: string | null; chapters: string | null }, episodes?: number): InfoPart[] {
  const parts: InfoPart[] = [];
  if (episodes) parts.push({ label: '', value: plural(episodes, 'episode') });
  else if (r.pace) parts.push({ label: '', value: r.pace });
  const a = countNumbers(r.anime ? splitExtra(r.anime).nums : null);
  if (r.anime) parts.push({ label: 'Anime', value: r.anime + (a ? ` (${a})` : ''), title: a ? `${plural(a, 'original anime episode')}` : undefined });
  const c = countNumbers(r.chapters ? splitExtra(r.chapters).nums : null);
  if (r.chapters) parts.push({ label: 'Ch.', value: r.chapters + (c ? ` (${c})` : ''), title: c ? `${plural(c, 'manga chapter')}` : undefined });
  const released = releasedSpan(r as Dated);
  if (released) parts.push({ label: 'Released', value: fmtSpan(released), title: 'First to latest One Pace release here' });
  const aired = airedSpan(r.anime);
  if (aired) parts.push({ label: 'Aired', value: fmtSpan(aired), title: 'When the original anime episodes aired in Japan' });
  const published = publishedSpan(r.chapters);
  if (published) parts.push({ label: 'Published', value: fmtSpan(published), title: 'When the manga chapters came out in Weekly Shonen Jump' });
  return parts;
}

/**
 * The section details box repeats the arc's own "Pace: … • Anime: … • Ch: …" line. Keep
 * only the parts that add something (e.g. "(Full Arc: …)", remaster or special notes).
 */
export function extraInfoText(text: string): string {
  return text
    .split('•')
    .map((s) => s.trim())
    .filter((s) => s && !/^(fun pace|pace|anime|ch):\s*(eps?\.?\s*)?[\d,\s–-]+$/i.test(s))
    .join(' • ');
}
