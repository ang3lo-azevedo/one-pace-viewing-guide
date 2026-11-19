import { For, Show, createMemo, createSignal } from 'solid-js';
import type { FilteredGroup } from '../lib/filter';
import { kindColor, kindLabel } from '../lib/guide';
import { isWatched, setMany } from '../store/progress';
import EpisodeRow from './EpisodeRow';

export default function GroupBlock(props: { group: FilteredGroup }) {
  const [open, setOpen] = createSignal(props.group.defaultOpen);

  const ids = () => props.group.episodes.map((e) => e.id);
  const watchedCount = createMemo(() => props.group.episodes.filter((e) => isWatched(e.id)).length);
  const allWatched = () => watchedCount() === props.group.episodes.length && props.group.episodes.length > 0;

  return (
    <div
      class="overflow-hidden rounded-lg border bg-sea-50 dark:bg-sea-950/50"
      classList={{
        'border-dashed opacity-90': props.group.isAlternative,
        'border-sea-200 dark:border-sea-800': !props.group.isAlternative,
      }}
    >
      <div class="flex items-center gap-2 px-3 py-2">
        <button class="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(!open())} aria-expanded={open()}>
          <span class="text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
            ▶
          </span>
          <span
            class="chip shrink-0 border-transparent text-[10px] uppercase tracking-wide"
            style={{ color: kindColor(props.group.kind), 'background-color': kindColor(props.group.kind) + '1f' }}
          >
            {kindLabel(props.group.kind)}
          </span>
          <span class="truncate text-sm font-bold">{props.group.label}</span>
          <Show when={props.group.isAlternative}>
            <span class="chip shrink-0 border-sea-300 text-[10px] text-sea-500 dark:border-sea-600">Alternative</span>
          </Show>
        </button>

        <span class="shrink-0 text-xs tabular-nums text-sea-500 dark:text-sea-400">
          {watchedCount()}/{props.group.episodes.length}
        </span>
        <button
          class="chip shrink-0 border-sea-300 text-[11px] text-sea-500 hover:border-strawhat-500 hover:text-strawhat-500 dark:border-sea-600 dark:text-sea-300"
          onClick={() => setMany(ids(), !allWatched())}
          title={allWatched() ? 'Unmark all in this section' : 'Mark all in this section watched'}
        >
          {allWatched() ? 'Clear' : 'Mark all'}
        </button>
      </div>

      <Show when={open()}>
        <div class="border-t border-sea-200 px-1.5 pb-1.5 pt-1 dark:border-sea-800/70">
          <Show when={props.group.notes.length}>
            <ul class="mb-1 space-y-0.5 px-2 pt-1">
              <For each={props.group.notes}>
                {(note) => (
                  <li class="flex gap-1.5 text-xs text-accent-600 dark:text-accent-300">
                    <span aria-hidden="true">⚑</span>
                    <span>{note}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <ul class="divide-y divide-sea-200/60 dark:divide-sea-800/60">
            <For each={props.group.episodes}>{(ep) => <EpisodeRow ep={ep} />}</For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
