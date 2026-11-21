import { For, Show, createSignal, createEffect } from 'solid-js';
import InfoLine from './InfoLine';
import { rangeInfo } from '../lib/format';
import { timeVsAnime } from '../lib/rangeTime';
import { flatEpisodes } from '../lib/guide';
import { hasActiveFilters, onlyIncluded, type FilteredSaga } from '../lib/filter';
import { tierForRating } from '../lib/guide';
import { idsOfSagaKey, sagaKeyOf } from '../lib/layout';
import { catchUpIds } from '../lib/catchup';
import { fmtDate, fmtFromNow, fmtDuration, minutesOf, stats } from '../lib/stats';
import { isWatched } from '../store/progress';
import { confirmBulk } from '../lib/confirm';
import { prefs } from '../store/prefs';
import RatingBadge from './RatingBadge';
import { SERIESGRAPH_SHOW } from '../lib/format';
import ArcCard from './ArcCard';
import { focusTarget, reveal } from '../lib/focus';

export default function SagaSection(props: { saga: FilteredSaga }) {
  // Open the saga with your last watched episode (or the first saga if you have none).
  const [open, setOpen] = createSignal(
    hasActiveFilters() || (focusTarget ? focusTarget.sagaId === props.saga.id : props.saga.number === 1),
  );
  // Open when an episode inside is revealed (page load or "Continue watching").
  createEffect(() => {
    if (reveal()?.sagaId === props.saga.id) setOpen(true);
  });

  const prog = () => stats().perSaga[props.saga.id];
  const sagaIds = () => onlyIncluded(idsOfSagaKey(props.saga.id));
  const allSagaWatched = () => sagaIds().length > 0 && sagaIds().every((id) => isWatched(id));
  const canonEntries = flatEpisodes.filter((f) => f.ep.canon && sagaKeyOf(f) === props.saga.id);
  const canonCount = canonEntries.length;
  const canonMinutes = canonEntries.reduce((m, f) => m + minutesOf(f), 0);
  const info = () => {
    const parts = rangeInfo(props.saga, canonCount || undefined);
    const t = timeVsAnime(canonMinutes, props.saga.anime);
    const eta = stats().etaSaga[props.saga.id];
    const p = stats().perSaga[props.saga.id];
    // Total of everything shown in this arc/saga (extras included), when it differs from the canon time.
    const total = p && p.minTotal > canonMinutes ? [{ label: 'Total', value: fmtDuration(p.minTotal), title: 'Everything shown here, including extras' }] : [];
    const left = p && p.minDone > 0 && p.minDone < p.minTotal ? [{ label: 'Left', value: fmtDuration(p.minTotal - p.minDone), title: 'Watch time left in your current selection' }] : [];
    return [...parts, ...(t ? [t] : []), ...total, ...left, ...(eta ? [{ label: 'Done by', value: fmtDate(eta), title: `At your current pace (${fmtFromNow(eta)})` }] : [])];
  };

  return (
    <section class="scroll-mt-24" id={props.saga.id}>
      <div class="group sticky top-[4.25rem] z-10 flex items-center gap-3 rounded-xl border border-sea-200 bg-white/90 px-3 py-3 shadow-sm backdrop-blur dark:border-sea-800 dark:bg-sea-900/90 sm:px-4">
        <div
          role="button"
          tabindex="0"
          class="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
          onClick={() => setOpen(!open())}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(!open()))}
          aria-expanded={open()}
        >
          <span class="w-3 shrink-0 text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
            ▶
          </span>
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-strawhat-500/15 text-sm font-black text-strawhat-500" aria-hidden="true">
            {props.saga.number}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-black leading-tight">{props.saga.title}</h2>
              <RatingBadge
                rating={props.saga.rating}
                color={tierForRating(props.saga.rating)?.color ?? null}
                size="md"
                href={SERIESGRAPH_SHOW}
                title={`Average of this saga\'s One Pace episodes on SeriesGraph (${props.saga.rating}). Open One Piece on SeriesGraph`}
              />
            </div>
            <InfoLine parts={info()} class="mt-0.5" />
          </div>
        </div>

        <div class="hidden w-36 shrink-0 sm:block">
          <div class="mb-1 flex justify-between text-[11px] font-semibold tabular-nums text-sea-500 dark:text-sea-400">
            <span>{Math.round(prog()?.pct ?? 0)}%</span>
            <span>
              {prog()?.watched ?? 0}/{prog()?.total ?? 0}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
            <div class="voyage-fill h-full rounded-full transition-all duration-500" style={{ width: `${prog()?.pct ?? 0}%` }} />
          </div>
        </div>

        <div class="flex shrink-0 flex-col gap-1">
          <button
            class="chip border-sea-300 text-[10px] text-sea-500 hover:border-strawhat-500 hover:text-strawhat-500 dark:border-sea-600 dark:text-sea-300"
            onClick={() => confirmBulk(sagaIds(), !allSagaWatched(), `in ${props.saga.title}`)}
            title={allSagaWatched() ? 'Unmark this saga' : 'Mark this whole saga watched'}
          >
            {allSagaWatched() ? 'Clear saga' : 'Mark saga'}
          </button>
          <button
            class="chip border-sea-300 text-[10px] text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300"
            onClick={() => confirmBulk(catchUpIds(idsOfSagaKey(props.saga.id)), true, `before ${props.saga.title}${prefs.catchUpExtras ? '' : ' (canon route only)'}`)}
            title="Mark everything before this saga watched"
          >
            Catch up
          </button>
        </div>
      </div>

      <Show when={open()}>
        <div class="mt-2 space-y-2 pl-0 sm:pl-2">
          <For each={props.saga.nodes}>{(node) => <ArcCard node={node} />}</For>
        </div>
      </Show>
    </section>
  );
}
