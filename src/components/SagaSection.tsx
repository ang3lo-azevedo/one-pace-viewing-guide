import { For, Show, createSignal } from 'solid-js';
import type { FilteredSaga } from '../lib/filter';
import { tierForRating } from '../lib/guide';
import { stats } from '../lib/stats';
import { hasActiveFilters } from '../lib/filter';
import RatingBadge from './RatingBadge';
import ArcCard from './ArcCard';

export default function SagaSection(props: { saga: FilteredSaga; index: number }) {
  // Expand by default when filters/search are active so matches are visible.
  const [open, setOpen] = createSignal(props.index === 0 || hasActiveFilters());

  const prog = () => stats().perSaga[props.saga.id];
  const meta = () =>
    [props.saga.pace, props.saga.anime ? `Anime ${props.saga.anime}` : null, props.saga.chapters ? `Ch. ${props.saga.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <section class="scroll-mt-24" id={props.saga.id}>
      <button
        class="group sticky top-[4.25rem] z-10 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-3 py-3 text-left shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-sea-700 dark:bg-sea-900/90 dark:hover:bg-sea-800/90 sm:px-4"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-strawhat-500/15 text-sm font-black text-strawhat-600 dark:text-strawhat-500"
          aria-hidden="true"
        >
          {props.index + 1}
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-black leading-tight">{props.saga.title}</h2>
            <RatingBadge rating={props.saga.rating} color={tierForRating(props.saga.rating)?.color ?? null} size="md" />
          </div>
          <Show when={meta()}>
            <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{meta()}</div>
          </Show>
        </div>

        <div class="hidden w-40 shrink-0 sm:block">
          <div class="mb-1 flex justify-between text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            <span>{Math.round(prog()?.pct ?? 0)}%</span>
            <span>
              {prog()?.watched ?? 0}/{prog()?.total ?? 0}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-sea-800">
            <div
              class="h-full rounded-full bg-gradient-to-r from-strawhat-500 to-gold-400 transition-all duration-500"
              style={{ width: `${prog()?.pct ?? 0}%` }}
            />
          </div>
        </div>
        <span class="shrink-0 text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
          ▶
        </span>
      </button>

      <Show when={open()}>
        <div class="mt-2 space-y-2 pl-0 sm:pl-2">
          <For each={props.saga.nodes}>{(node) => <ArcCard node={node} />}</For>
        </div>
      </Show>
    </section>
  );
}
