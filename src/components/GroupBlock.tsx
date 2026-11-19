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
      class="overflow-hidden rounded-lg border bg-slate-50 dark:bg-sea-950/40"
      classList={{
        'border-dashed opacity-90': props.group.isAlternative,
        'border-slate-200 dark:border-sea-700': !props.group.isAlternative,
      }}
    >
      <div class="flex items-center gap-2 px-3 py-2">
        <button
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen(!open())}
          aria-expanded={open()}
        >
          <span
            class="text-xs transition-transform"
            classList={{ 'rotate-90': open() }}
            aria-hidden="true"
          >
            ▶
          </span>
          <span
            class="chip shrink-0 border-transparent text-[10px] uppercase tracking-wide"
            style={{ color: kindColor(props.group.kind), 'background-color': kindColor(props.group.kind) + '1a' }}
          >
            {kindLabel(props.group.kind)}
          </span>
          <span class="truncate text-sm font-semibold">{props.group.label}</span>
          <Show when={props.group.isAlternative}>
            <span class="chip shrink-0 border-slate-300 text-[10px] text-slate-500 dark:border-sea-600">
              Alternative
            </span>
          </Show>
        </button>

        <span class="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {watchedCount()}/{props.group.episodes.length}
        </span>
        <button
          class="chip shrink-0 border-slate-300 text-[11px] text-slate-500 hover:border-strawhat-500 hover:text-strawhat-600 dark:border-sea-600 dark:text-slate-400"
          onClick={() => setMany(ids(), !allWatched())}
          title={allWatched() ? 'Unmark all in this section' : 'Mark all in this section watched'}
        >
          {allWatched() ? 'Clear' : 'Mark all'}
        </button>
      </div>

      <Show when={open()}>
        <div class="border-t border-slate-200 px-1.5 pb-1.5 pt-1 dark:border-sea-700/70">
          <Show when={props.group.notes.length}>
            <ul class="mb-1 space-y-0.5 px-2 pt-1">
              <For each={props.group.notes}>
                {(note) => (
                  <li class="flex gap-1.5 text-xs text-amber-700 dark:text-gold-400">
                    <span aria-hidden="true">⚑</span>
                    <span>{note}</span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <ul class="divide-y divide-slate-200/60 dark:divide-sea-800/60">
            <For each={props.group.episodes}>{(ep) => <EpisodeRow ep={ep} />}</For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
