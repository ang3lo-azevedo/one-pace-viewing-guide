export interface Tier {
  min: number;
  label: string;
  color: string;
}

export interface EpisodeLinks {
  onepace: string | null;
  stremio: string | null;
  netflix: string | null;
  mega: string | null;
  drive: string | null;
  nyaa: string | null;
  other: string | null;
}

export interface Episode {
  id: string;
  title: string;
  fullTitle: string;
  rating: number | null;
  tierColor: string | null;
  pace: string | null;
  paceNumber: number | null;
  anime: string | null;
  chapters: string | null;
  meta: string | null;
  description: string | null;
  links: EpisodeLinks;
  canon: boolean;
  notes?: string[];
  /** Trakt community rating (only present when the episode has votes on Trakt). */
  traktRating?: number;
  traktVotes?: number;
  /** Where this episode lives on the Trakt One Pace show. */
  traktEpisode?: { season: number; number: number; trakt: number };
  /** Original anime episodes this community cut covers on Trakt: [season, number, trakt id]. */
  traktAnime?: [number, number, number][];
}

export type GroupKind =
  | 'onepace'
  | 'onigashima'
  | 'kuma-shaved'
  | 'netflix'
  | 'funpace'
  | 'original'
  | 'original-continuation'
  | 'log'
  | 'movie'
  | 'special'
  | 'filler'
  | 'theatre'
  | 'upcoming'
  | 'other';

export interface Group {
  id: string;
  label: string;
  kind: GroupKind;
  canonPath: boolean;
  isAlternative: boolean;
  defaultOpen: boolean;
  rating: number | null;
  notes: string[];
  episodes: Episode[];
  /** Details table from the guide: sources and an episode/chapter summary. */
  info?: { links: { label: string; url: string }[]; text: string };
  /** Shown inline right after this episode id (e.g. a special in the middle of an arc). */
  afterEpisode?: string;
  /** Unique key assigned at load ("saga.node.group" indices). */
  uid: string;
}

export type NodeType = 'arc' | 'movie' | 'special' | 'filler' | 'upcoming';

export interface GuideNode {
  id: string;
  type: NodeType;
  title: string;
  rating: number | null;
  pace: string | null;
  anime: string | null;
  chapters: string | null;
  isAlternative: boolean;
  groups: Group[];
  /** Unique key assigned at load ("saga.node" indices); ids can repeat. */
  uid: string;
}

export interface Saga {
  id: string;
  title: string;
  rating: number | null;
  pace: string | null;
  anime: string | null;
  chapters: string | null;
  nodes: GuideNode[];
}

export interface GuideMeta {
  generatedFrom?: string;
  generatedAt: string;
  tiers: Tier[];
  sagaCount: number;
  nodeCount: number;
  episodeCount: number;
  canonPathCount: number;
  paceNumberedCount: number;
}

export interface GuideData {
  meta: GuideMeta;
  sagas: Saga[];
}
