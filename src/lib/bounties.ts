/**
 * Straw Hat bounty history, keyed by the arc (node id) after which each value is known.
 * Spoiler-gated: a member only appears once you have passed the arc they join in, and a
 * bounty only updates once you have passed the arc where the new posters are revealed.
 */

export interface CrewMember {
  key: string;
  name: string;
  emoji: string;
  /** Arc after which they are part of the crew. */
  joins: string;
}

export const CREW: CrewMember[] = [
  { key: 'luffy', name: 'Luffy', emoji: '👒', joins: 'romance-dawn-arc' },
  { key: 'zoro', name: 'Zoro', emoji: '⚔️', joins: 'romance-dawn-arc' },
  { key: 'nami', name: 'Nami', emoji: '🍊', joins: 'orange-town-arc' },
  { key: 'usopp', name: 'Usopp', emoji: '🎯', joins: 'syrup-village-arc' },
  { key: 'sanji', name: 'Sanji', emoji: '🍳', joins: 'baratie-arc' },
  { key: 'chopper', name: 'Chopper', emoji: '🦌', joins: 'drum-island-arc' },
  { key: 'robin', name: 'Robin', emoji: '🌸', joins: 'alabasta-arc' },
  { key: 'franky', name: 'Franky', emoji: '🤖', joins: 'post-enies-lobby-arc' },
  { key: 'brook', name: 'Brook', emoji: '🎻', joins: 'thriller-bark-arc' },
  { key: 'jinbe', name: 'Jinbe', emoji: '🐟', joins: 'whole-cake-island-arc' },
];

/** [arc after which the posters are known, { member: bounty }] in story order. */
export const BOUNTY_REVEALS: [string, Record<string, number>][] = [
  ['arlong-park-arc', { luffy: 30_000_000 }],
  ['alabasta-arc', { luffy: 100_000_000, zoro: 60_000_000, robin: 79_000_000 }],
  [
    'post-enies-lobby-arc',
    {
      luffy: 300_000_000,
      zoro: 120_000_000,
      nami: 16_000_000,
      usopp: 30_000_000,
      sanji: 77_000_000,
      chopper: 50,
      robin: 80_000_000,
      franky: 44_000_000,
    },
  ],
  ['thriller-bark-arc', { brook: 33_000_000 }],
  ['return-to-sabaody-arc', { luffy: 400_000_000 }],
  [
    'dressrosa-arc',
    {
      luffy: 500_000_000,
      zoro: 320_000_000,
      nami: 66_000_000,
      usopp: 200_000_000,
      sanji: 177_000_000,
      chopper: 100,
      robin: 130_000_000,
      franky: 94_000_000,
      brook: 83_000_000,
    },
  ],
  ['reverie-arc', { luffy: 1_500_000_000, sanji: 330_000_000 }],
  [
    'wano-country-arc',
    {
      luffy: 3_000_000_000,
      zoro: 1_111_000_000,
      nami: 366_000_000,
      usopp: 500_000_000,
      sanji: 1_032_000_000,
      chopper: 1_000,
      robin: 930_000_000,
      franky: 394_000_000,
      brook: 383_000_000,
      jinbe: 1_100_000_000,
    },
  ],
];

/** Your own "bounty": ฿3,000,000 per canon episode watched. */
export const BOUNTY_PER_EPISODE = 3_000_000;

const RANKS: [number, string][] = [
  [1_500_000_000, 'Pirate King Contender'],
  [1_000_000_000, 'Legendary Pirate'],
  [600_000_000, 'Infamous Pirate'],
  [300_000_000, 'Notorious Pirate'],
  [100_000_000, 'Wanted Pirate'],
  [30_000_000, 'Rookie Pirate'],
  [1, 'Deckhand'],
  [0, 'Cabin Boy'],
];

export function pirateRank(bounty: number): string {
  for (const [min, name] of RANKS) if (bounty >= min) return name;
  return 'Cabin Boy';
}

/** The next rank above this bounty, or null at the top. */
export function nextRank(bounty: number): { name: string; at: number } | null {
  const above = RANKS.filter(([min]) => min > bounty);
  if (!above.length) return null;
  const [at, name] = above[above.length - 1];
  return { name, at };
}

export function formatBerry(n: number): string {
  return '฿' + n.toLocaleString('en-US');
}
