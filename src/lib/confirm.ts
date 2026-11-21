import { isWatched, setMany } from '../store/progress';
import { isConnected } from '../store/trakt';

/**
 * Bulk mark/clear with a confirmation that says exactly how many episodes change.
 * Does nothing (and asks nothing) when no episode would change.
 */
export function confirmBulk(ids: string[], watched: boolean, what: string) {
  const changing = ids.filter((id) => isWatched(id) !== watched);
  if (!changing.length) return;
  const n = changing.length;
  const verb = watched ? 'Mark' : 'Unmark';
  const eps = `${n} episode${n === 1 ? '' : 's'}`;
  const trakt = isConnected() ? `\n\nThis also ${watched ? 'adds them to' : 'removes them from'} your Trakt history.` : '';
  if (confirm(`${verb} ${eps} ${what} as ${watched ? 'watched' : 'unwatched'}?${trakt}`)) setMany(changing, watched);
}
