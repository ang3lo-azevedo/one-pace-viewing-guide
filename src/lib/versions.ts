/**
 * Interchangeable versions of a section. Groups (or whole nodes) in data.json carry
 * `version: "<set>:<value>"`; the value you pick is the main route and the others become
 * optional alternatives. Applied when the guide loads (see guide.ts), so changing one
 * reloads the page (keeping your place, see restore.ts).
 */
export interface VersionSet {
  key: string;
  label: string;
  options: { value: string; label: string; title?: string }[];
  default: string;
  /** The picked version is part of the canon route (otherwise it keeps its own flags). */
  canon?: boolean;
  /** Hidden together with "Filler & Fun Pace" whichever version you pick. */
  filler?: boolean;
  /** Not two versions of a section but where one is placed (applied in guide.ts). */
  placement?: boolean;
  hint?: string;
}

export const VERSION_SETS: VersionSet[] = [
  {
    key: 'fishman',
    label: 'Fish-Man Island',
    default: 'log',
    canon: true,
    options: [
      { value: 'log', label: 'One Piece Log', title: 'The official 21-episode remaster' },
      { value: 'onepace', label: 'One Pace', title: 'The One Pace edit (Return to Sabaody and Fish-Man Island)' },
    ],
  },
  {
    key: 'adventures',
    label: 'The Adventures of the Straw Hats',
    // One Pace tells the same cover stories in one episode (23 min vs 1h 36m).
    default: 'onepace',
    canon: true,
    options: [
      { value: 'original', label: 'Original anime', title: 'Episodes 453-456 in full' },
      { value: 'onepace', label: 'One Pace', title: 'One Pace\'s single-episode cut' },
    ],
  },
  {
    key: 'g8',
    label: 'G-8',
    default: 'funpace',
    filler: true,
    options: [
      { value: 'funpace', label: 'Fun Pace', title: 'Paced cut of the filler' },
      { value: 'original', label: 'Original anime', title: 'The full original anime episodes' },
    ],
  },
  {
    key: 'boatpiece',
    label: 'Brook\'s Struggle (Episode 384)',
    default: 'funpace',
    filler: true,
    options: [
      { value: 'funpace', label: 'Fun Pace', title: 'Paced cut of the filler' },
      { value: 'original', label: 'Original anime', title: 'The full original anime episode' },
    ],
  },
  {
    key: 'wano',
    label: 'Wano: Onigashima',
    default: 'onepace',
    canon: true,
    options: [
      { value: 'onepace', label: 'One Pace Raid, then Paced', title: 'Onigashima Raid 01-31, then Onigashima Paced from 29' },
      { value: 'paced', label: 'Onigashima Paced', title: 'Onigashima Raid 01-11, then Onigashima Paced from 01' },
    ],
  },
  {
    key: 'egghead',
    label: 'Egghead: the end',
    default: 'onepace',
    canon: true,
    options: [
      { value: 'onepace', label: 'One Pace, then Kuma Cut', title: 'Egghead 01-22, then Kuma Cut from 04' },
      { value: 'kuma', label: 'Kuma Cut', title: 'Egghead 01-20, then Kuma Cut from 01' },
    ],
  },
  {
    key: 'monsters',
    label: 'Monsters',
    default: 'inside',
    placement: true,
    options: [
      { value: 'inside', label: 'Inside Thriller Bark 13', title: 'Pause the episode at 06:40, watch it, skip its last minute' },
      { value: 'after', label: 'After Thriller Bark', title: 'Watch it in full after the arc' },
    ],
  },
  {
    key: 'strongworld',
    label: 'Strong World',
    default: 'thriller-bark',
    options: [
      { value: 'thriller-bark', label: 'After Thriller Bark', title: 'Episode 0, then the film' },
      { value: 'post-war', label: 'After Post-War', title: 'Episode 0, then the film' },
    ],
  },
];

export const versionSet = new Map(VERSION_SETS.map((s) => [s.key, s]));
export type Versions = Record<string, string>;

/** Picked versions from saved prefs (including the older fishmanVersion / fillerVersion). */
export function readVersions(saved: any): Versions {
  const out: Versions = Object.fromEntries(VERSION_SETS.map((s) => [s.key, s.default]));
  if (saved?.fishmanVersion) out.fishman = saved.fishmanVersion;
  if (saved?.fillerVersion) out.g8 = out.boatpiece = saved.fillerVersion;
  for (const [k, v] of Object.entries(saved?.versions ?? {}))
    if (versionSet.get(k)?.options.some((o) => o.value === v)) out[k] = v as string;
  return out;
}
