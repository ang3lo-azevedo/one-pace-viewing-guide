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
};

export const LINK_ORDER: (keyof EpisodeLinks)[] = ['onepace', 'stremio', 'netflix', 'drive', 'mega', 'nyaa', 'other'];

/** The link the red ▶ button opens: the preferred stream source first, then any other. */
export function primaryLinkKey(links: EpisodeLinks, source: StreamSource): keyof EpisodeLinks | null {
  const first = source === 'onepace' ? 'onepace' : 'stremio';
  const second = source === 'onepace' ? 'stremio' : 'onepace';
  const chain: (keyof EpisodeLinks)[] = [first, second, 'drive', 'mega', 'nyaa', 'netflix', 'other'];
  for (const k of chain) if (links[k]) return k;
  return null;
}
