import { countNumbers } from './format';
import { animeMinutes, fmtHours } from './stats';
import type { InfoPart } from './format';

function numbers(text: string | null): number[] {
  const out: number[] = [];
  for (const part of (text ?? '').replace(/\[[^\]]*\]/g, '').replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const r = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (r) for (let n = +r[1]; n <= +r[2] && n - +r[1] < 200; n++) out.push(n);
    else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

/**
 * "Canon 8h 31m (anime 17h 58m)": the real length of an arc's or saga's canon episodes
 * versus the original anime episodes they cover.
 */
export function timeVsAnime(canonMinutes: number, anime: string | null): InfoPart | null {
  if (!canonMinutes || !countNumbers(anime)) return null;
  const full = animeMinutes(numbers(anime));
  const saved = full - canonMinutes;
  return {
    label: 'Canon',
    value: fmtHours(canonMinutes) + (saved > 0 ? ` (anime ${fmtHours(full)})` : ''),
    title: saved > 0 ? `${fmtHours(saved)} shorter than the original anime` : undefined,
  };
}
