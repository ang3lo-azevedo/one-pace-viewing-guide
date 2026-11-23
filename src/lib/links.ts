import type { EpisodeLinks } from '../types';
import type { StreamSource } from '../store/prefs';

export const LINK_LABEL: Record<keyof EpisodeLinks, string> = {
  onepace: 'One Pace',
  stremio: 'Stremio',
  netflix: 'Netflix',
  mega: 'Mega',
  drive: 'Drive',
  nyaa: 'Nyaa',
  other: 'Watch',
  crunchyroll: 'Crunchyroll',
  justwatch: 'Where to stream',
};

export const LINK_ORDER: (keyof EpisodeLinks)[] = ['onepace', 'stremio', 'netflix', 'crunchyroll', 'drive', 'mega', 'nyaa', 'other', 'justwatch'];

/**
 * The link the red ▶ button opens: your preferred service when the entry has it, then One Pace,
 * Stremio, the official services, downloads, and last a "where to stream" search.
 */
export function primaryLinkKey(links: EpisodeLinks, source: StreamSource): keyof EpisodeLinks | null {
  const chain: (keyof EpisodeLinks)[] = [source, 'onepace', 'stremio', 'netflix', 'crunchyroll', 'drive', 'mega', 'nyaa', 'other', 'justwatch'];
  for (const k of chain) if (links[k]) return k;
  return null;
}
