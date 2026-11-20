import { For, Show, createSignal } from 'solid-js';
import { hasActiveFilters, onlyIncluded, type FilteredSaga } from '../lib/filter';
import { allIdsOfSaga, idsBeforeSaga, tierForRating } from '../lib/guide';
import { stats } from '../lib/stats';
import { isWatched, setMany } from '../store/progress';
import RatingBadge from './RatingBadge';
import { SERIESGRAPH_SHOW } from '../lib/format';
import ArcCard from './ArcCard';

export default function SagaSection(props: { saga: FilteredSaga; index: number }) {
  const [open, setOpen] = createSignal(props.index === 0 || hasActiveFilters());

  const prog = () => stats().perSaga[props.saga.id];
  const sagaIds = () => onlyIncluded(allIdsOfSaga(props.saga.id));
  const allSagaWatched = () => sagaIds().length > 0 && sagaIds().every((id) => isWatched(id));
  const meta = () =>
    [props.saga.pace, props.saga.anime ? `Anime ${props.saga.anime}` : null, props.saga.chapters ? `Ch. ${props.saga.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

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
            {props.index + 1}
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
            <Show when={meta()}>
              <div class="mt-0.5 text-xs text-sea-500 dark:text-sea-400">{meta()}</div>
            </Show>
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
            onClick={() => setMany(sagaIds(), !allSagaWatched())}
            title={allSagaWatched() ? 'Unmark this saga' : 'Mark this whole saga watched'}
          >
            {allSagaWatched() ? 'Clear saga' : 'Mark saga'}
          </button>
          <button
            class="chip border-sea-300 text-[10px] text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300"
            onClick={() => setMany(onlyIncluded(idsBeforeSaga(props.saga.id)), true)}
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
