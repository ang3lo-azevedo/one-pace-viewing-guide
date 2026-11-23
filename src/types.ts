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
  /** Added at load (lib/guide.ts): Crunchyroll for the original anime, JustWatch for films and specials. */
  crunchyroll?: string | null;
  justwatch?: string | null;
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
  /** Minutes you skip at this placement (e.g. the spoilery last minute of Monsters); taken off the runtime. */
  skipMinutes?: number;
  /** "anime" when the Trakt rating is the vote-weighted rating of the anime episodes covered. */
  traktRatingFrom?: 'anime';
  /** Where this episode lives on the Trakt One Pace show. */
  /** Trakt episode; `show` is set when it is not the One Pace show (e.g. the Live Action). */
  traktEpisode?: { season: number; number: number; trakt: number; show?: string };
  /** Original anime episodes this community cut covers on Trakt: [season, number, trakt id]. */
  traktAnime?: [number, number, number][];
  /** Movies and specials: their Trakt movie. */
  traktMovie?: { slug: string; trakt: number; imdb?: string | null };
  /** Not part of the story canon (films, filler, most specials). */
  nonCanon?: boolean;
  /** Shown instead when filler is shown (e.g. the G-8 cut of Skypiea 25). */
  /**
   * A different cut to use when you watch a given kind of extra: Skypiea 25's G-8 cut with the
   * filler, Loguetown 01 Extended with the Daddy the Father special. Overrides the title,
   * adds a note and can swap links (e.g. a different torrent).
   */
  withExtra?: { when: 'filler' | 'specials'; title?: string; note?: string; links?: Partial<Episode['links']> };
  /** Real length in minutes (onepace.net, Trakt or the project's spreadsheet), if published. */
  runtime?: number;
  runtimeSource?: string;
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
  /**
   * One of two interchangeable versions, as "<choice>:<value>" (e.g. "fishman:log",
   * "g8:funpace"). The version you pick in Settings is the main one, the other becomes
   * the alternative.
   */
  version?: string;
  /** A placement preference that moves this section (e.g. "monsters"), see versions.ts. */
  setting?: string;
  /** Unique key assigned at load ("saga.node.group" indices). */
  uid: string;
}

export type NodeType = 'arc' | 'movie' | 'special' | 'filler' | 'upcoming' | 'liveaction';

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
  /** The whole node is one version of a set ("strongworld:post-war"), see Group.version. */
  version?: string;
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
