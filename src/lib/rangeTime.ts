import { countNumbers } from './format';
import { fmtHours } from './stats';
import type { InfoPart } from './format';

const MIN = 24;

/**
 * "About 1h 36m (anime 2h 00m)": the canon episodes of an arc or saga versus the original
 * anime episodes they cover, at the same ~24 min per episode estimate used in the stats.
 */
export function timeVsAnime(canonEpisodes: number, anime: string | null): InfoPart | null {
  const animeCount = countNumbers(anime);
  if (!canonEpisodes || !animeCount) return null;
  const pace = canonEpisodes * MIN;
  const full = animeCount * MIN;
  const saved = full - pace;
  return {
    label: 'Time',
    value: `~${fmtHours(pace)}` + (saved > 0 ? ` (anime ${fmtHours(full)})` : ''),
    title: saved > 0 ? `About ${fmtHours(saved)} shorter than the original anime` : undefined,
  };
}
