import { flatEpisodes, type FlatEpisode } from './guide';
import { isWatched } from '../store/progress';

/**
 * Alternative versions are optional: they never count as remaining, and watching one
 * instead of the main version counts the main version as done.
 *
 *  - Same arc: an alternative covers a main entry when it covers all of that entry's anime
 *    episodes (G-8 original anime <-> Fun Pace, Fish-Man Island One Pace <-> One Piece Log,
 *    the standard Punk Hazard 20 <-> the tweaked one).
 *  - Other placement: an alternative arc/movie/special ("... (Alternative)") covers the
 *    entry at the same position in the arc of the same name.
 */

export const isAlternativeEntry = (f: FlatEpisode) => f.group.isAlternative || f.node.isAlternative;

function animeNums(text: string | null): number[] {
  if (!text) return [];
  const out: number[] = [];
  // Ignore bracketed notes such as "206 [207 ending]".
  for (const part of text.replace(/\[[^\]]*\]/g, '').replace(/[–—]/g, '-').split(/[,/]/)) {
    const p = part.trim();
    const r = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (r) for (let n = +r[1]; n <= +r[2] && n - +r[1] < 80; n++) out.push(n);
    else if (/^\d+$/.test(p)) out.push(+p);
  }
  return out;
}

/** Main entry id -> alternative entry ids that together replace it. */
const coveredBy = new Map<string, string[]>();
/** Alternative entry id -> main entry ids it stands in for. */
const standsInFor = new Map<string, string[]>();

function link(main: string, alts: string[]) {
  coveredBy.set(main, alts);
  for (const a of alts) standsInFor.set(a, [...(standsInFor.get(a) ?? []), main]);
}

// Same arc, by anime episode overlap.
const byNode = new Map<string, FlatEpisode[]>();
for (const f of flatEpisodes) byNode.set(f.node.uid, [...(byNode.get(f.node.uid) ?? []), f]);
for (const entries of byNode.values()) {
  const alts = entries.filter((f) => f.group.isAlternative);
  if (!alts.length) continue;
  const altAnime = alts.map((a) => ({ id: a.ep.id, nums: new Set(animeNums(a.ep.anime)) }));
  for (const main of entries) {
    if (main.group.isAlternative) continue;
    const need = animeNums(main.ep.anime);
    if (!need.length) continue;
    const users = altAnime.filter((a) => need.some((n) => a.nums.has(n)));
    const covered = new Set(users.flatMap((a) => [...a.nums]));
    if (users.length && need.every((n) => covered.has(n))) link(main.ep.id, users.map((u) => u.id));
  }
}

// Other placement, by arc title and position.
const strip = (t: string) => t.replace(/\s*\(Alternative\)\s*/i, '').trim();
for (const altNode of new Set(flatEpisodes.filter((f) => f.node.isAlternative).map((f) => f.node))) {
  const main = flatEpisodes.filter((f) => !f.node.isAlternative && strip(f.node.title) === strip(altNode.title));
  const alt = flatEpisodes.filter((f) => f.node === altNode);
  if (main.length && main.length === alt.length) main.forEach((m, i) => link(m.ep.id, [alt[i].ep.id]));
}

/** Watched, or replaced by alternative versions you watched. */
export function isDone(id: string): boolean {
  if (isWatched(id)) return true;
  const alts = coveredBy.get(id);
  return !!alts && alts.every((a) => isWatched(a));
}

/** For an alternative entry: true once the main version it stands in for is watched. */
export function notNeeded(id: string): boolean {
  const mains = standsInFor.get(id);
  return !!mains && mains.every((m) => isWatched(m));
}

/** How many main entries can be replaced by an alternative (for diagnostics). */
export const alternativeLinks = coveredBy.size;

