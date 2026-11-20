import { For, Show, createMemo, createSignal } from 'solid-js';
import type { Episode, EpisodeLinks } from '../types';
import { isWatched, toggle } from '../store/progress';
import { prefs } from '../store/prefs';
import { isConnected, rateEpisode, trakt } from '../store/trakt';
import { splitTitle } from '../lib/guide';
import { SERIESGRAPH_SHOW, firstAnimeEpisode, inlineMd } from '../lib/format';
import { config } from '../config';
import RatingBadge from './RatingBadge';
import Tooltip from './Tooltip';

const LINK_LABEL: Record<keyof EpisodeLinks, string> = {
  onepace: 'One Pace',
  stremio: 'Stremio',
  netflix: 'Netflix',
  mega: 'Mega',
  drive: 'Drive',
  nyaa: 'Nyaa',
  other: 'Watch',
};

const ORDER: (keyof EpisodeLinks)[] = ['onepace', 'stremio', 'netflix', 'drive', 'mega', 'nyaa', 'other'];

const RATING_WORDS = ['', 'Weak Sauce', 'Terrible', 'Bad', 'Poor', 'Meh', 'Fair', 'Good', 'Great', 'Superb', 'Totally Ninja'];

/** Section kinds whose star rating is not a SeriesGraph One Piece anime rating. */
const NOT_SERIESGRAPH = new Set(['netflix', 'movie', 'upcoming', 'original-continuation']);

export default function EpisodeRow(props: { ep: Episode; kind?: string }) {
  // The star rating averages the anime episodes this entry adapts; link to the first one.
  const sgHref = () => {
    if (NOT_SERIESGRAPH.has(props.kind ?? '')) return null;
    const n = firstAnimeEpisode(props.ep.anime);
    return n ? `${SERIESGRAPH_SHOW}/episode/${n}` : null;
  };
  const traktHref = () => {
    const t = props.ep.traktEpisode;
    return t ? `https://trakt.tv/shows/${config.traktShowSlug}/seasons/${t.season}/episodes/${t.number}` : null;
  };
  const watched = () => isWatched(props.ep.id);
  const [rating, setRating] = createSignal(false);
  const canRate = () => isConnected() && !!trakt.mapped[props.ep.id];
  const myRating = () => trakt.myRatings[props.ep.id];
  const parts = createMemo(() => splitTitle(props.ep.title));
  const hideSub = () => prefs.spoilerSafe && parts().subtitle !== '';
  const displayed = () => (hideSub() ? parts().label : props.ep.title);
  const tipText = () => {
    const t = props.ep.fullTitle;
    return t && t !== displayed() ? t : null;
  };

  const primaryKey = createMemo<keyof EpisodeLinks | null>(() => {
    const l = props.ep.links;
    const pref = prefs.streamSource;
    const pref1 = pref === 'onepace' ? 'onepace' : 'stremio';
    const pref2 = pref === 'onepace' ? 'stremio' : 'onepace';
    const chain: (keyof EpisodeLinks)[] = [pref1, pref2, 'drive', 'mega', 'nyaa', 'netflix', 'other'];
    for (const k of chain) if (l[k]) return k;
    return null;
  });

  const secondaryKeys = createMemo(() => ORDER.filter((k) => props.ep.links[k] && k !== primaryKey()));

  const metaBits = () =>
    [props.ep.pace, props.ep.anime ? `Anime ${props.ep.anime}` : null, props.ep.chapters ? `Ch. ${props.ep.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <li
      class="group/ep flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sea-100 dark:hover:bg-sea-800/50"
      classList={{ 'opacity-55': watched() }}
    >
      <label class="mt-0.5 flex cursor-pointer items-center">
        <input
          type="checkbox"
          class="h-5 w-5 cursor-pointer rounded border-sea-400 accent-strawhat-500 focus:ring-strawhat-500 dark:border-sea-600"
          checked={watched()}
          onChange={() => {
            toggle(props.ep.id);
            // Offer to rate right after marking a Trakt-synced episode as watched.
            if (isWatched(props.ep.id) && canRate() && !myRating()) setRating(true);
          }}
          aria-label={`Mark ${displayed()} watched`}
        />
      </label>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingBadge
            rating={props.ep.rating}
            color={props.ep.tierColor}
            href={sgHref()}
            title={sgHref() ? `SeriesGraph rating ${props.ep.rating}, averaged over anime ${props.ep.anime}. Open on SeriesGraph` : undefined}
          />
          <Show when={props.ep.traktRating}>
            <a
              href={traktHref() ?? `https://trakt.tv/shows/${config.traktShowSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-0.5 rounded-md border border-[#ed1c24]/50 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24]/10"
              title={`Trakt rating ${props.ep.traktRating} (${props.ep.traktVotes} vote${props.ep.traktVotes === 1 ? '' : 's'}). Open on Trakt`}
            >
              Trakt {props.ep.traktRating?.toFixed(1)}
            </a>
          </Show>
          <Show
            when={tipText()}
            fallback={
              <span class="text-sm font-semibold leading-snug" classList={{ 'line-through': watched() }}>
                {displayed()}
              </span>
            }
          >
            <Tooltip text={tipText()}>
              <span
                class="cursor-help text-sm font-semibold leading-snug decoration-dotted underline-offset-4 hover:underline"
                classList={{ 'line-through': watched() }}
              >
                {displayed()}
              </span>
            </Tooltip>
          </Show>
        </div>

        <Show when={metaBits()}>
          <div class="mt-0.5 text-xs text-sea-500 dark:text-sea-400">{metaBits()}</div>
        </Show>

        <Show when={canRate() && (watched() || myRating())}>
          <div class="mt-1 flex flex-wrap items-center gap-1">
            <button
              class="inline-flex items-center gap-1 rounded-md border px-1.5 py-[3px] text-[11px] font-semibold leading-none"
              classList={{
                'border-[#ed1c24] bg-[#ed1c24] text-white': !!myRating(),
                'border-[#ed1c24]/50 text-[#ff5a5f] hover:bg-[#ed1c24]/10': !myRating(),
              }}
              onClick={() => setRating(!rating())}
              title={myRating() ? `Your Trakt rating: ${myRating()} (${RATING_WORDS[myRating()!]}). Click to change.` : 'Rate this episode on Trakt'}
            >
              {myRating() ? `♥ Your rating ${myRating()}` : '♡ Rate on Trakt'}
            </button>
            <Show when={rating()}>
              <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
                {(n) => (
                  <button
                    class="h-6 w-6 rounded text-[11px] font-bold tabular-nums transition-colors"
                    classList={{
                      'bg-[#ed1c24] text-white': myRating() === n,
                      'bg-sea-200 text-sea-700 hover:bg-[#ed1c24]/70 hover:text-white dark:bg-sea-800 dark:text-sea-200': myRating() !== n,
                    }}
                    title={RATING_WORDS[n]}
                    onClick={() => {
                      rateEpisode(props.ep.id, n);
                      setRating(false);
                    }}
                  >
                    {n}
                  </button>
                )}
              </For>
              <Show when={myRating()}>
                <button
                  class="px-1 text-[11px] text-sea-400 hover:text-sea-200"
                  onClick={() => {
                    rateEpisode(props.ep.id, null);
                    setRating(false);
                  }}
                >
                  remove
                </button>
              </Show>
              <button class="px-1 text-[11px] text-sea-400 hover:text-sea-200" onClick={() => setRating(false)}>
                ✕
              </button>
            </Show>
          </div>
        </Show>

        <Show when={props.ep.description}>
          <p class="mt-1 text-xs leading-relaxed text-sea-500 dark:text-sea-400" innerHTML={inlineMd(props.ep.description!)} />
        </Show>

        <Show when={props.ep.notes && props.ep.notes.length}>
          <ul class="mt-1 space-y-0.5">
            <For each={props.ep.notes}>
              {(note) => (
                <li class="flex gap-1.5 text-xs text-accent-600 dark:text-accent-300">
                  <span aria-hidden="true">⚑</span>
                  <span class="min-w-0" innerHTML={inlineMd(note)} />
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Show when={primaryKey()}>
          {(k) => (
            <a href={props.ep.links[k()]!} target="_blank" rel="noopener noreferrer" class="btn-watch">
              ▶ {LINK_LABEL[k()]}
            </a>
          )}
        </Show>
        <For each={secondaryKeys()}>
          {(k) => (
            <a
              href={props.ep.links[k]!}
              target="_blank"
              rel="noopener noreferrer"
              class="chip border-sea-300 text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300 dark:hover:text-accent-300"
            >
              {LINK_LABEL[k]}
            </a>
          )}
        </For>
      </div>
    </li>
  );
}
