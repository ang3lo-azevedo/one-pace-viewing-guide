import { For, Show, createSignal } from 'solid-js';
import { prefs } from '../store/prefs';
import { isConnected, rateEpisode, rateSeason, trakt } from '../store/trakt';
import { config } from '../config';
import { RATING_WORDS } from './EpisodeRow';
import { traktHref, traktTitle } from '../lib/ratingLinks';
import type { Episode } from '../types';

/**
 * Trakt rating of an arc, saga, film or special, and (when connected) your own rating of it:
 * an arc rates its season of the One Pace show on Trakt, a film or special rates its entry.
 * Where there is nothing to rate (sagas, sections of several entries) it shows the average of
 * your ratings of the episodes in it.
 */
export default function SectionTrakt(props: {
  rating?: number;
  season?: { number: number; trakt: number | null };
  what: string;
  /** Episodes in this arc: your average rating of them is the suggested arc rating. */
  episodeIds?: string[];
  /** A film, special or filler made of one entry: rating it rates that entry. */
  entry?: Episode;
}) {
  const [picking, setPicking] = createSignal(false);
  const key = () => (props.season?.trakt ? `season:${props.season.trakt}` : null);
  const rateable = () => isConnected() && (!!key() || (!!entryId() && !!trakt.mapped[entryId()!]));
  const mine = () => (key() ? trakt.myRatings[key()!] : entryId() ? trakt.myRatings[entryId()!] : undefined);
  const rate = (n: number | null) => (key() ? rateSeason(props.season!.trakt!, n) : rateEpisode(entryId()!, n));
  const entryId = () => props.entry?.id;
  const href = () =>
    (props.entry && traktHref(props.entry)) ||
    (props.season ? `https://trakt.tv/shows/${config.traktShowSlug}/seasons/${props.season.number}` : `https://trakt.tv/shows/${config.traktShowSlug}`);
  const stop = (e: MouseEvent) => e.stopPropagation();
  // Your own ratings of the arc's episodes, averaged: the default when you rate the arc.
  const suggestion = () => {
    const mine = (props.episodeIds ?? []).map((id) => trakt.myRatings[id]).filter((r): r is number => !!r);
    if (!mine.length) return null;
    const avg = mine.reduce((a, b) => a + b, 0) / mine.length;
    return { value: Math.min(10, Math.max(1, Math.round(avg))), avg, count: mine.length };
  };
  return (
    <Show when={prefs.ratingsShown !== 'seriesgraph'}>
      <Show when={props.rating}>
        <a
          href={href()}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          class="inline-flex items-center rounded-md border border-[#ed1c24]/50 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24]/10"
          title={props.entry?.traktRating ? traktTitle(props.entry) : `Trakt rating ${props.rating}: the average of this ${props.what}'s episodes on Trakt, by length. Open on Trakt`}
        >
          Trakt {props.rating?.toFixed(1)}
        </a>
      </Show>
      <Show when={(!rateable() || !mine()) && suggestion()}>
        {(sg) => (
          <span
            class="inline-flex items-center rounded-md border border-[#ed1c24] bg-[#ed1c24]/15 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] dark:text-[#ff5a5f]"
            title={`Your average rating of the ${sg().count} episode${sg().count === 1 ? '' : 's'} you rated in this ${props.what}`}
            onClick={stop}
          >
            ♥ {sg().count === 1 ? sg().avg : sg().avg.toFixed(1)}
            <span class="ml-1 font-normal opacity-80">your avg</span>
          </span>
        )}
      </Show>
      <Show when={rateable()}>
        <span class="inline-flex flex-wrap items-center gap-1" onClick={stop}>
          <button
            class="inline-flex items-center rounded-md border px-1.5 py-[3px] text-[11px] font-semibold leading-none transition-colors"
            classList={{
              'border-[#ed1c24] bg-[#ed1c24] text-white': !!mine(),
              'border-[#ed1c24]/50 text-[#ff5a5f] hover:bg-[#ed1c24]/10': !mine(),
            }}
            onClick={() => setPicking(!picking())}
            title={mine() ? `Your Trakt rating of this ${props.what}: ${mine()} (${RATING_WORDS[Math.round(mine()!)]}). Click to change.` : `Rate this ${props.what} on Trakt`}
          >
            {mine() ? `♥ ${mine()}` : `♡ Rate ${props.what}`}
          </button>
          <Show when={picking()}>
            <Show when={!mine() && suggestion()}>
              {(sg) => (
                <button
                  class="rounded-md border border-[#ed1c24] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24] hover:text-white"
                  title={`The average of your ${sg().count} episode rating${sg().count === 1 ? '' : 's'} in this ${props.what}: ${sg().avg.toFixed(1)}`}
                  onClick={() => {
                    void rate(sg().value);
                    setPicking(false);
                  }}
                >
                  Use {sg().value} (your average {sg().avg.toFixed(1)})
                </button>
              )}
            </Show>
            <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
              {(n) => (
                <button
                  class="h-6 w-6 rounded text-[11px] font-bold tabular-nums transition-colors"
                  classList={{
                    'bg-[#ed1c24] text-white': mine() === n,
                    'bg-sea-200 text-sea-700 hover:bg-[#ed1c24]/70 hover:text-white dark:bg-sea-800 dark:text-sea-200': mine() !== n,
                    'ring-2 ring-[#ed1c24]': !mine() && suggestion()?.value === n,
                  }}
                  title={RATING_WORDS[n]}
                  onClick={() => {
                    void rate(n);
                    setPicking(false);
                  }}
                >
                  {n}
                </button>
              )}
            </For>
            <Show when={mine()}>
              <button
                class="px-1 text-[11px] text-sea-400 hover:text-sea-700 dark:hover:text-sea-100"
                onClick={() => {
                  void rate(null);
                  setPicking(false);
                }}
              >
                remove
              </button>
            </Show>
          </Show>
        </span>
      </Show>
    </Show>
  );
}
