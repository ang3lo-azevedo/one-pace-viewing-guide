import { For, Show, createMemo, createSignal } from 'solid-js';
import type { FilteredNode } from '../lib/filter';
import { isWatched, setMany } from '../store/progress';
import { allIdsOfNode, idsBeforeNode, tierForRating } from '../lib/guide';
import RatingBadge from './RatingBadge';
import GroupBlock from './GroupBlock';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  arc: { label: 'Arc', cls: 'border-accent-400/40 text-accent-500 dark:text-accent-300' },
  movie: { label: 'Movie', cls: 'border-strawhat-500/40 text-strawhat-500' },
  special: { label: 'Special', cls: 'border-teal-400/40 text-teal-600 dark:text-teal-300' },
  filler: { label: 'Filler', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
  upcoming: { label: 'Upcoming', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
};

export default function ArcCard(props: { node: FilteredNode }) {
  const [open, setOpen] = createSignal(true);

  const allEps = createMemo(() => props.node.groups.flatMap((g) => g.episodes));
  const watched = createMemo(() => allEps().filter((e) => isWatched(e.id)).length);
  const total = () => allEps().length;
  const arcIds = () => allIdsOfNode(props.node.id);
  const allArcWatched = () => arcIds().every((id) => isWatched(id));

  const badge = () => TYPE_BADGE[props.node.type] ?? TYPE_BADGE.arc;
  const meta = () =>
    [props.node.pace, props.node.anime ? `Anime ${props.node.anime}` : null, props.node.chapters ? `Ch. ${props.node.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <div class="card scroll-mt-28 overflow-hidden" id={props.node.id}>
      <div class="flex items-start gap-2 px-3 py-3 sm:px-4">
        <button class="mt-0.5 flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setOpen(!open())} aria-expanded={open()}>
          <span class="mt-1 text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
            ▶
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class={`chip ${badge().cls}`}>{badge().label}</span>
              <h3 class="text-base font-extrabold leading-tight">{props.node.title}</h3>
              <RatingBadge rating={props.node.rating} color={tierForRating(props.node.rating)?.color ?? null} />
              <Show when={props.node.isAlternative}>
                <span class="chip border-sea-300 text-[10px] text-sea-500 dark:border-sea-600">Alternative</span>
              </Show>
            </div>
            <Show when={meta()}>
              <div class="mt-1 text-xs text-sea-500 dark:text-sea-400">{meta()}</div>
            </Show>
          </div>
        </button>

        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="text-xs font-semibold tabular-nums text-sea-500 dark:text-sea-400">
            {watched()}/{total()}
          </span>
          <div class="flex gap-1">
            <button
              class="chip border-sea-300 text-[10px] text-sea-500 hover:border-strawhat-500 hover:text-strawhat-500 dark:border-sea-600 dark:text-sea-300"
              onClick={() => setMany(arcIds(), !allArcWatched())}
              title={allArcWatched() ? 'Unmark this arc' : 'Mark this whole arc watched'}
            >
              {allArcWatched() ? 'Clear arc' : 'Mark arc'}
            </button>
            <button
              class="chip border-sea-300 text-[10px] text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300"
              onClick={() => setMany(idsBeforeNode(props.node.id), true)}
              title="Mark everything before this arc watched"
            >
              Catch up
            </button>
          </div>
        </div>
      </div>

      <Show when={open()}>
        <div class="space-y-2 border-t border-sea-200 p-2 dark:border-sea-800 sm:p-3">
          <For each={props.node.groups}>{(group) => <GroupBlock group={group} />}</For>
        </div>
      </Show>
    </div>
  );
}
