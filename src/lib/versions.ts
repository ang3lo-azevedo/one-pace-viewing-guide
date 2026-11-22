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
    default: 'original',
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
    label: 'Boat Piece (Episode 384)',
    default: 'funpace',
    filler: true,
    options: [
      { value: 'funpace', label: 'Fun Pace', title: 'Paced cut of the filler' },
      { value: 'original', label: 'Original anime', title: 'The full original anime episode' },
    ],
  },
  {
    key: 'strongworld',
    label: 'Strong World',
    default: 'thriller-bark',
    options: [
      { value: 'thriller-bark', label: 'After Thriller Bark', title: 'Fun Pace Episode 0, then the film' },
      { value: 'post-war', label: 'After Post-War', title: 'Pace Episode 0, then the film' },
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
