import { For, Show, createMemo, createSignal } from 'solid-js';
import InfoLine from './InfoLine';
import { fmtDate, fmtDuration, minutesForKind, stats } from '../lib/stats';
import { isDone, notNeeded } from '../lib/alternatives';
import { episodeInfo } from '../lib/format';
import type { Episode } from '../types';
import { isWatched, toggle } from '../store/progress';
import { prefs } from '../store/prefs';
import { LINK_LABEL, LINK_ORDER, primaryLinkKey } from '../lib/links';
import { isConnected, rateEpisode, trakt } from '../store/trakt';
import { splitTitle } from '../lib/guide';
import { NonCanonTag } from './Tags';
import { SERIESGRAPH_SHOW, firstAnimeEpisode, inlineMd } from '../lib/format';
import { config } from '../config';
import RatingBadge from './RatingBadge';
import Tooltip from './Tooltip';

const SOURCE_NAME: Record<string, string> = {
  onepace: 'onepace.net',
  trakt: 'Trakt',
  anime: 'the original anime episodes on Trakt',
  sheet: "the project's spreadsheet",
  'sheet-average': "the project's spreadsheet (average for the arc)",
};

export const RATING_WORDS = ['', 'Weak Sauce', 'Terrible', 'Bad', 'Poor', 'Meh', 'Fair', 'Good', 'Great', 'Superb', 'Totally Ninja'];

/** Section kinds whose star rating is not a SeriesGraph One Piece anime rating. */
const NOT_SERIESGRAPH = new Set(['netflix', 'movie', 'upcoming', 'original-continuation']);

/** Live Action episodes numbered across seasons, as SeriesGraph does (S2E1 is episode 9). */
const LIVE_ACTION_SG = 'https://seriesgraph.com/show/111110-one-piece';

export default function EpisodeRow(props: { ep: Episode; kind?: string; showNonCanon?: boolean }) {
  // The star rating averages the anime episodes this entry adapts; link to the first one.
  const sgHref = () => {
    // SeriesGraph episode pages are /episode/S<season>E<episode>; it lists the whole anime as season 1.
    if (props.kind === 'netflix') {
      const m = props.ep.title.match(/S(\d+)E(\d+)/);
      return m ? `${LIVE_ACTION_SG}/episode/S${+m[1]}E${+m[2]}` : LIVE_ACTION_SG;
    }
    if (NOT_SERIESGRAPH.has(props.kind ?? '')) return null;
    const n = firstAnimeEpisode(props.ep.anime);
    return n ? `${SERIESGRAPH_SHOW}/episode/S1E${n}` : null;
  };
  // Films and specials: their IMDb page.
  const imdbHref = () => (props.ep.traktMovie?.imdb ? `https://www.imdb.com/title/${props.ep.traktMovie.imdb}/` : null);
  const traktHref = () => {
    if (props.ep.traktMovie) return `https://trakt.tv/movies/${props.ep.traktMovie.slug}`;
    const t = props.ep.traktEpisode;
    // Rated from the anime: open the first anime episode it covers.
    const a = props.ep.traktAnime?.[0];
    if (props.ep.traktRatingFrom === 'anime' && a) return `https://trakt.tv/shows/one-piece/seasons/${a[0]}/episodes/${a[1]}`;
    if (t) return `https://trakt.tv/shows/${t.show ?? config.traktShowSlug}/seasons/${t.season}/episodes/${t.number}`;
    return a ? `https://trakt.tv/shows/one-piece/seasons/${a[0]}/episodes/${a[1]}` : null;
  };
  const watched = () => isWatched(props.ep.id);
  const [rating, setRating] = createSignal(false);
  const canRate = () => isConnected() && !!trakt.mapped[props.ep.id];
  const myRating = () => trakt.myRatings[props.ep.id];
  // Episodes with a cut that depends on an extra you watch (Skypiea 25 with the G-8 filler,
  // Loguetown 01 Extended with Daddy the Father).
  const extraShown = (cat: 'filler' | 'specials') => !prefs.canonOnly && !prefs.hideNonCanon && !prefs.hiddenExtras.includes(cat);
  const variant = () => (props.ep.withExtra && extraShown(props.ep.withExtra.when) ? props.ep.withExtra : null);
  const links = () => ({ ...props.ep.links, ...(variant()?.links ?? {}) });
  const title = () => variant()?.title ?? props.ep.title;
  const parts = createMemo(() => splitTitle(title()));
  const hideSub = () => prefs.spoilerSafe && parts().subtitle !== '';
  const displayed = () => (hideSub() ? parts().label : title());
  const tipText = () => {
    const t = props.ep.fullTitle;
    return t && t !== displayed() ? t : null;
  };

  const primaryKey = createMemo(() => primaryLinkKey(links(), prefs.streamSource));

  const secondaryKeys = createMemo(() => LINK_ORDER.filter((k) => links()[k] && k !== primaryKey()));

  const info = createMemo(() => {
    const parts = episodeInfo(props.ep);
    const real = props.ep.runtime;
    const min = real ?? minutesForKind(props.kind ?? 'onepace');
    if (min > 0)
      parts.push({
        label: 'Length',
        value: real ? fmtDuration(min) : `~${fmtDuration(min)}`,
        title: real ? `Length from ${SOURCE_NAME[props.ep.runtimeSource ?? ''] ?? 'the source'}` : 'Estimated length (no published length)',
      });
    const eta = stats().eta[props.ep.id];
    return eta && !watched() ? [...parts, { label: 'ETA', value: fmtDate(eta), title: 'When you should get here at your current pace' }] : parts;
  });
  // Covered by watching the alternative version instead, or an alternative you no longer need.
  const viaAlternative = () => !watched() && isDone(props.ep.id);
  const skippable = () => !watched() && notNeeded(props.ep.id);

  return (
    <li
      data-ep={props.ep.id}
      class="group/ep flex scroll-mt-40 flex-wrap items-start gap-x-3 gap-y-1.5 rounded-lg px-2 py-2 sm:flex-nowrap transition-colors hover:bg-sea-100 dark:hover:bg-sea-800/50"
      classList={{ 'opacity-55': watched() || viaAlternative() || skippable() }}
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
            href={sgHref() ?? imdbHref()}
            title={
              props.kind === 'netflix'
                ? `SeriesGraph rating ${props.ep.rating} (Live Action). Open on SeriesGraph`
                : sgHref()
                  ? `SeriesGraph rating ${props.ep.rating}, averaged over anime ${props.ep.anime}. Open on SeriesGraph`
                  : imdbHref()
                    ? `Rating ${props.ep.rating}. Open on IMDb`
                    : undefined
            }
          />
          <Show when={props.showNonCanon && props.ep.nonCanon}>
            <NonCanonTag />
          </Show>
          <Show when={props.ep.traktRating}>
            <a
              href={traktHref() ?? `https://trakt.tv/shows/${config.traktShowSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-0.5 rounded-md border border-[#ed1c24]/50 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-[#ed1c24] hover:bg-[#ed1c24]/10"
              title={
                props.ep.traktRatingFrom === 'anime'
                  ? `Trakt rating ${props.ep.traktRating}: the original anime episodes this covers (${props.ep.traktVotes} votes). Open on Trakt`
                  : `Trakt rating ${props.ep.traktRating} (${props.ep.traktVotes} vote${props.ep.traktVotes === 1 ? '' : 's'}). Open on Trakt`
              }
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

        <InfoLine parts={info()} class="mt-0.5" />
        <Show when={viaAlternative()}>
          <div class="mt-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">✓ Done: you watched the alternative version</div>
        </Show>
        <Show when={skippable()}>
          <div class="mt-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">Not needed: you watched the main version</div>
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

        <Show when={variant()?.note}>
          <div class="mt-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{variant()!.note}</div>
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

      <div class="flex w-full shrink-0 flex-wrap items-center gap-1 pl-8 sm:w-auto sm:justify-end sm:pl-0">
        <Show when={primaryKey()}>
          {(k) => (
            <a href={links()[k()]!} target="_blank" rel="noopener noreferrer" class="btn-watch">
              ▶ {LINK_LABEL[k()]}
            </a>
          )}
        </Show>
        <For each={secondaryKeys()}>
          {(k) => (
            <a
              href={links()[k]!}
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
