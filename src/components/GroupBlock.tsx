import { For, Show, createSignal } from 'solid-js';
import { onlyIncluded, type FilteredGroup } from '../lib/filter';
import { flatEpisodes, kindColor, kindLabel } from '../lib/guide';
import { stats } from '../lib/stats';
import { isWatched, setMany } from '../store/progress';
import EpisodeRow from './EpisodeRow';
import { focusTarget } from '../lib/focus';
import { inlineMd } from '../lib/format';

export default function GroupBlock(props: { group: FilteredGroup; inline?: Map<string, FilteredGroup[]> }) {
  const [open, setOpen] = createSignal(props.group.defaultOpen || !!focusTarget?.groupUids.has(props.group.uid));

  const prog = () => stats().perGroup[props.group.uid];
  const ids = () => onlyIncluded(flatEpisodes.filter((f) => f.group.uid === props.group.uid).map((f) => f.ep.id));
  const allWatched = () => ids().length > 0 && ids().every((id) => isWatched(id));

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
          <Show when={props.group.kind === 'netflix'}>
            <span
              class="chip shrink-0 border-amber-400/50 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-300"
              title="Optional extra, not part of the One Pace canon route"
            >
              Extra
            </span>
          </Show>
          <Show when={props.group.isAlternative}>
            <span class="chip shrink-0 border-sea-300 text-[10px] text-sea-500 dark:border-sea-600">Alternative</span>
          </Show>
        </button>

        <Show when={prog()}>
          <span class="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span class="h-1.5 w-14 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
              <span class="voyage-fill block h-full rounded-full" style={{ width: `${prog()!.pct}%` }} />
            </span>
            <span class="text-[11px] tabular-nums text-sea-500 dark:text-sea-400">{Math.round(prog()!.pct)}%</span>
          </span>
        </Show>
        <span class="shrink-0 text-xs tabular-nums text-sea-500 dark:text-sea-400">
          {prog()?.watched ?? 0}/{prog()?.total ?? 0}
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
          <Show when={props.group.info && (props.group.info.links.length || props.group.info.text)}>
            <div class="mx-2 mb-1.5 mt-1 rounded-md bg-sea-100 px-2.5 py-1.5 text-xs dark:bg-sea-900/70">
              <Show when={props.group.info!.text}>
                <div class="text-sea-600 dark:text-sea-300">{props.group.info!.text}</div>
              </Show>
              <Show when={props.group.info!.links.length}>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span class="text-[10px] font-bold uppercase tracking-wide text-sea-400">Sources</span>
                  <For each={props.group.info!.links}>
                    {(l) => (
                      <a href={l.url} target="_blank" rel="noopener noreferrer" class="font-semibold text-accent-500 hover:underline dark:text-accent-300">
                        {l.label}
                      </a>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          <Show when={props.group.notes.length}>
            <ul class="mb-1 space-y-0.5 px-2 pt-1">
              <For each={props.group.notes}>
                {(note) => (
                  <li class="flex gap-1.5 text-xs text-accent-600 dark:text-accent-300">
                    <span aria-hidden="true">⚑</span>
                    <span innerHTML={inlineMd(note)} />
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <ul class="divide-y divide-sea-200/60 dark:divide-sea-800/60">
            <For each={props.group.episodes}>
              {(ep) => (
                <>
                  <EpisodeRow ep={ep} kind={props.group.kind} />
                  <For each={props.inline?.get(ep.id) ?? []}>
                    {(child) => (
                      <li class="py-2 pl-4">
                        <GroupBlock group={child} inline={props.inline} />
                      </li>
                    )}
                  </For>
                </>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  );
}
