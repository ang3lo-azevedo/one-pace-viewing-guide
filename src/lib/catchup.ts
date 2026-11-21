import { flatById } from './guide';
import { onlyIncluded } from './filter';
import { idsBefore } from './layout';
import { prefs } from '../store/prefs';

/** What "Catch up" marks before these ids: your selection, minus extras unless enabled. */
export function catchUpIds(beforeIds: string[]): string[] {
  const ids = onlyIncluded(idsBefore(beforeIds));
  return prefs.catchUpExtras ? ids : ids.filter((id) => flatById.get(id)?.ep.canon);
}
