import { For, Show, createMemo, createSignal } from 'solid-js';
import InfoLine from './InfoLine';
import { fmtDate, fmtDuration, minutesForKind, sharePart, stats, watchedOnPart } from '../lib/stats';
import { isDone, notNeeded } from '../lib/alternatives';
import { episodeInfo } from '../lib/format';
import type { Episode } from '../types';
import { isWatched, toggle } from '../store/progress';
import { prefs } from '../store/prefs';
import { LINK_LABEL, LINK_ORDER, primaryLinkKey } from '../lib/links';
import { isConnected, rateEpisode, trakt } from '../store/trakt';
import { splitTitle } from '../lib/guide';
import { shortName, waitingOn } from '../lib/pause';
import { NonCanonTag } from './Tags';
import { inlineMd } from '../lib/format';
import RatingBadge from './RatingBadge';
import TraktBadge from './TraktBadge';
import { starHref, starTitle } from '../lib/ratingLinks';
import Tooltip from './Tooltip';

const SOURCE_NAME: Record<string, string> = {
  onepace: 'onepace.net',
  trakt: 'Trakt',
  anime: 'the original anime episodes on Trakt',
  sheet: "the project's spreadsheet",
  'sheet-average': "the project's spreadsheet (average for the arc)",
  clip: 'the scene timestamps',
};

export const RATING_WORDS = ['', 'Weak Sauce', 'Terrible', 'Bad', 'Poor', 'Meh', 'Fair', 'Good', 'Great', 'Superb', 'Totally Ninja'];

export default function EpisodeRow(props: { ep: Episode; kind?: string; showNonCanon?: boolean }) {
  const watched = () => isWatched(props.ep.id);
  const [rating, setRating] = createSignal(false);
  const canRate = () => isConnected() && !!trakt.mapped[props.ep.id];
  const myRating = () => trakt.myRatings[props.ep.id];
  /** Rated as the original anime episodes it is made of (Fun Pace, Boat Piece, uncut originals). */
  const animeEps = () => (props.ep.traktEpisode?.trakt || props.ep.traktMovie ? [] : (props.ep.traktAnime ?? []).map((a) => a[1]));
  // Episodes with a cut that depends on an extra you watch (Skypiea 25 with the G-8 filler,
  // Loguetown 01 Extended with Daddy the Father).
  const extraShown = (cat: 'filler' | 'specials') => !prefs.canonOnly && !prefs.hideNonCanon && !prefs.hiddenExtras.includes(cat);
  const variant = () => (props.ep.withExtra && extraShown(props.ep.withExtra.when) ? props.ep.withExtra : null);
  const links = () => ({ ...props.ep.links, ...(variant()?.links ?? {}) });
  const title = () => variant()?.title ?? props.ep.title;
  const parts = createMemo(() => splitTitle(title()));
  const hideSub = () => prefs.spoilerSafe && parts().subtitle !== '' && !(prefs.revealWatched && watched());
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
        title: real ? `Length from ${SOURCE_NAME[props.ep.runtimeSource ?? ''] ?? 'the source'}${props.ep.skipMinutes ? `, minus the ${props.ep.skipMinutes} min you skip here` : ''}` : 'Estimated length (no published length)',
      });
    const share = sharePart(props.ep.id);
    if (share) parts.push(share);
    const seen = watchedOnPart(props.ep.id);
    if (seen) parts.push(seen);
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
      <Show
        when={!watched() && waitingOn(props.ep.id).length}
        fallback={
      <label class="mt-0.5 flex cursor-pointer items-center">
        <input
          type="checkbox"
          class="h-5 w-5 cursor-pointer rounded border-sea-400 accent-strawhat-500 focus:ring-strawhat-500 dark:border-sea-600"
          checked={watched()}
          onChange={() => {
            toggle(props.ep.id);
            // Offer to rate right after marking a Trakt-synced episode as watched.
            if (prefs.askRate && isWatched(props.ep.id) && canRate() && !myRating()) setRating(true);
          }}
          aria-label={`Mark ${displayed()} watched`}
        />
      </label>
        }
      >
        {/* Paused mid-way for a special: you finish (and check) it after that. */}
        <span
          class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-sea-400 text-[10px] font-bold text-sea-500 dark:border-sea-500 dark:text-sea-400"
          title={`Finish this after ${waitingOn(props.ep.id).map(shortName).join(', ')}, then check it`}
          aria-label="Paused: finish after the special below"
        >
          ❚❚
        </span>
      </Show>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingBadge rating={props.ep.rating} color={props.ep.tierColor} href={starHref(props.ep, props.kind)} title={starTitle(props.ep, props.kind)} />
          <Show when={props.showNonCanon && props.ep.nonCanon}>
            <NonCanonTag />
          </Show>
          <TraktBadge ep={props.ep} />
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
              title={
                (myRating() ? `Your Trakt rating: ${myRating()} (${RATING_WORDS[Math.round(myRating()!)]}). Click to change.` : 'Rate this episode on Trakt') +
                (animeEps().length === 1
                  ? `\nRated as anime episode ${animeEps()[0]} on Trakt (shared with its other version)`
                  : animeEps().length > 1
                    ? `\nRates anime episodes ${animeEps().join(', ')} on Trakt, all with the same rating. Your rating here is your average of them.`
                    : '')
              }
            >
              {myRating() ? `♥ Your rating ${myRating()}` : '♡ Rate on Trakt'}
            </button>
            <Show when={rating()}>
              <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
                {(n) => (
                  <button
                    class="rounded-md h-6 w-6 text-[11px] font-bold tabular-nums transition-colors"
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
