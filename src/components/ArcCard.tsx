import { For, Show, createMemo, createSignal } from 'solid-js';
import type { FilteredNode } from '../lib/filter';
import { isWatched } from '../store/progress';
import { tierForRating } from '../lib/guide';
import RatingBadge from './RatingBadge';
import GroupBlock from './GroupBlock';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  arc: { label: 'Arc', cls: 'border-sky-400/40 text-sky-600 dark:text-sky-300' },
  movie: { label: 'Movie', cls: 'border-gold-400/50 text-amber-600 dark:text-gold-400' },
  special: { label: 'Special', cls: 'border-teal-400/40 text-teal-600 dark:text-teal-300' },
  filler: { label: 'Filler', cls: 'border-slate-400/40 text-slate-500 dark:text-slate-400' },
  upcoming: { label: 'Upcoming', cls: 'border-slate-400/40 text-slate-500 dark:text-slate-400' },
};

export default function ArcCard(props: { node: FilteredNode }) {
  const [open, setOpen] = createSignal(true);

  const allEps = createMemo(() => props.node.groups.flatMap((g) => g.episodes));
  const watched = createMemo(() => allEps().filter((e) => isWatched(e.id)).length);
  const total = () => allEps().length;

  const badge = () => TYPE_BADGE[props.node.type] ?? TYPE_BADGE.arc;
  const meta = () =>
    [props.node.pace, props.node.anime ? `Anime ${props.node.anime}` : null, props.node.chapters ? `Ch. ${props.node.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <div class="card scroll-mt-28 overflow-hidden" id={props.node.id}>
      <button
        class="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-sea-800/40 sm:px-4"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
      >
        <span class="mt-1 text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
          ▶
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class={`chip ${badge().cls}`}>{badge().label}</span>
            <h3 class="text-base font-bold leading-tight">{props.node.title}</h3>
            <RatingBadge rating={props.node.rating} color={tierForRating(props.node.rating)?.color ?? null} />
            <Show when={props.node.isAlternative}>
              <span class="chip border-slate-300 text-[10px] text-slate-500 dark:border-sea-600">Alternative</span>
            </Show>
          </div>
          <Show when={meta()}>
            <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta()}</div>
          </Show>
        </div>
        <div class="shrink-0 text-right">
          <div class="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {watched()}/{total()}
          </div>
        </div>
      </button>

      <Show when={open()}>
        <div class="space-y-2 border-t border-slate-200 p-2 dark:border-sea-700 sm:p-3">
          <For each={props.node.groups}>{(group) => <GroupBlock group={group} />}</For>
        </div>
      </Show>
    </div>
  );
}
