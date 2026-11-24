import type { Episode } from '../types';
import { SERIESGRAPH_SHOW, firstAnimeEpisode } from './format';
import { config } from '../config';

/** Section kinds whose star rating is not a SeriesGraph One Piece anime rating. */
const NOT_SERIESGRAPH = new Set(['netflix', 'movie', 'upcoming', 'original-continuation']);
const LIVE_ACTION_SG = 'https://seriesgraph.com/show/111110-one-piece';

/** Where the star rating comes from: SeriesGraph for anime episodes and the Live Action, IMDb for films and specials. */
export function starHref(ep: Episode, kind?: string): string | null {
  // SeriesGraph episode pages are /episode/S<season>E<episode>; it lists the whole anime as season 1.
  if (kind === 'netflix') {
    const m = ep.title.match(/S(\d+)E(\d+)/);
    return m ? `${LIVE_ACTION_SG}/episode/S${+m[1]}E${+m[2]}` : LIVE_ACTION_SG;
  }
  if (!NOT_SERIESGRAPH.has(kind ?? '')) {
    const n = firstAnimeEpisode(ep.anime);
    if (n) return `${SERIESGRAPH_SHOW}/episode/S1E${n}`;
  }
  return ep.traktMovie?.imdb ? `https://www.imdb.com/title/${ep.traktMovie.imdb}/` : null;
}

/** Tooltip for the star rating, naming its source. */
export function starTitle(ep: Episode, kind?: string): string | undefined {
  const href = starHref(ep, kind);
  if (!href) return undefined;
  if (kind === 'netflix') return `IMDb rating ${ep.rating} (Live Action). Open its rating graph on SeriesGraph`;
  if (href.includes('imdb.com'))
    return `IMDb rating ${ep.rating}${ep.imdbVotes ? ` (${ep.imdbVotes.toLocaleString()} votes)` : ''}. Open on IMDb`;
  return `IMDb rating ${ep.rating}, averaged over anime ${ep.anime}. Open its rating graph on SeriesGraph`;
}

/** The Trakt page behind the Trakt rating. */
export function traktHref(ep: Episode): string | null {
  if (ep.traktMovie) return `https://trakt.tv/movies/${ep.traktMovie.slug}`;
  const t = ep.traktEpisode;
  // Rated from the anime: open the first anime episode it covers.
  const a = ep.traktAnime?.[0];
  if (ep.traktRatingFrom === 'anime' && a) return `https://trakt.tv/shows/one-piece/seasons/${a[0]}/episodes/${a[1]}`;
  if (t) return `https://trakt.tv/shows/${t.show ?? config.traktShowSlug}/seasons/${t.season}/episodes/${t.number}`;
  return a ? `https://trakt.tv/shows/one-piece/seasons/${a[0]}/episodes/${a[1]}` : `https://trakt.tv/shows/${config.traktShowSlug}`;
}

/** Tooltip for the Trakt rating. */
export function traktTitle(ep: Episode): string {
  return ep.traktRatingFrom === 'anime'
    ? `Trakt rating ${ep.traktRating}: the original anime episodes this covers (${ep.traktVotes} votes). Open on Trakt`
    : `Trakt rating ${ep.traktRating} (${ep.traktVotes} vote${ep.traktVotes === 1 ? '' : 's'}). Open on Trakt`;
}
