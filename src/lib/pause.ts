import { flatEpisodes, splitTitle, type FlatEpisode } from './guide';
import { episodeIncluded } from './filter';
import { isWatched } from '../store/progress';

/**
 * Episodes you pause mid-way to watch something else, then finish (Thriller Bark 13: pause at
 * 06:40 for the Monsters special). They are marked by a "Pause at ..." note and have sections
 * shown right after them; you only finish them once those are watched.
 */
const PAUSE = /^Pause at/i;
const inlineAfter = new Map<string, FlatEpisode[]>();
for (const f of flatEpisodes) {
  if (!f.ep.notes?.some((n) => PAUSE.test(n))) continue;
  const after = flatEpisodes.filter((x) => x.node === f.node && x.group.afterEpisode === f.ep.id);
  if (after.length) inlineAfter.set(f.ep.id, after);
}

/** What you still need to watch before finishing this episode (empty for most episodes). */
export function waitingOn(epId: string): FlatEpisode[] {
  const after = inlineAfter.get(epId);
  if (!after) return [];
  return after.filter((f) => episodeIncluded(f.ep, f.group, f.node) && !isWatched(f.ep.id));
}

/** The "Pause at ..." note of an episode, if it has one. */
export function pauseNote(f: FlatEpisode): string | null {
  return inlineAfter.has(f.ep.id) ? (f.ep.notes?.find((n) => PAUSE.test(n)) ?? null) : null;
}

/** Short name for a waiting entry ("Monsters: 103 Mercies..." -> its label). */
export const shortName = (f: FlatEpisode) => splitTitle(f.ep.title).label.split(":")[0].trim();
