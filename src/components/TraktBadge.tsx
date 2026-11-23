import { Show } from 'solid-js';
import { prefs } from '../store/prefs';
import { traktHref, traktTitle } from '../lib/ratingLinks';
import type { Episode } from '../types';

/** The red Trakt rating, linking to the Trakt page it comes from. */
export default function TraktBadge(props: { ep: Episode }) {
  return (
    <Show when={props.ep.traktRating && prefs.ratingsShown !== 'seriesgraph'}>
      <a
        href={traktHref(props.ep) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-0.5 rounded-md border border-[#ed1c24]/50 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24]/10"
        title={traktTitle(props.ep)}
      >
        Trakt {props.ep.traktRating?.toFixed(1)}
      </a>
    </Show>
  );
}
