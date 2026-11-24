import { For, Show, createSignal, createEffect } from 'solid-js';
import { onlyIncluded, type FilteredGroup } from '../lib/filter';
import { extraCategory, flatEpisodes, kindColor, kindLabel } from '../lib/guide';
import { fmtDuration, parentsOf, sharePartOf, stats } from '../lib/stats';
import { isWatched } from '../store/progress';
import { confirmBulk } from '../lib/confirm';
import EpisodeRow from './EpisodeRow';
import { Tags } from './Tags';
import { LiveActionPicker } from './VersionPicker';
import type { FilteredNode } from '../lib/filter';
import type { Group, GuideNode } from '../types';
import { notNeeded } from '../lib/alternatives';
import { focusTarget, reveal } from '../lib/focus';
import { wasOpen } from '../lib/restore';
import { extraInfoText, inlineMd } from '../lib/format';

export default function GroupBlock(props: {
  group: FilteredGroup;
  inline?: Map<string, FilteredGroup[]>;
  node?: FilteredNode;
  /** The arc itself is already tagged as an extra / non-canon. */
  nodeExtra?: boolean;
  nodeNonCanon?: boolean;
  /** The only section of its arc: show the entries directly, without a second header. */
  bare?: boolean;
}) {
  // Extra sections inside a main-route arc (e.g. Live Action, a special) are tagged and indented.
  const isExtra = () => !props.nodeExtra && !!props.node && !props.group.isAlternative && extraCategory(props.group as Group, props.node as GuideNode) !== null;
  const allNonCanon = () => props.group.episodes.length > 0 && props.group.episodes.every((e) => e.nonCanon);
  const [open, setOpen] = createSignal(
    !!props.bare || (wasOpen(`group:${props.group.uid}`) ?? (props.group.defaultOpen || !!focusTarget?.groupUids.has(props.group.uid))),
  );
  // Open when an episode inside is revealed (page load or "Continue watching").
  createEffect(() => {
    if (!!reveal()?.groupUids.has(props.group.uid)) setOpen(true);
  });

  const prog = () => stats().perGroup[props.group.uid];
  const share = () => {
    const p = prog();
    if (!p) return null;
    const up = parentsOf(props.group.episodes[0]?.id);
    const arc = up ? stats().perNode[up.nodeKey] : undefined;
    return sharePartOf(p.minTotal, arc && up ? { min: arc.minTotal, name: up.nodeTitle } : undefined);
  };
  const ids = () => onlyIncluded(flatEpisodes.filter((f) => f.group.uid === props.group.uid).map((f) => f.ep.id));
  const allWatched = () => ids().length > 0 && ids().every((id) => isWatched(id));

  return (
    <div
      data-open-key={open() && !props.bare ? `group:${props.group.uid}` : undefined}
      data-open-title={props.group.label}
      classList={{
        'overflow-clip rounded-lg border group-bg': !props.bare,
        'ml-4 sm:ml-8 border-l-4 !border-l-amber-400/60': !props.bare && isExtra(),
        'border-dashed opacity-90': !props.bare && props.group.isAlternative,
        'border-sea-200 dark:border-sea-800': !props.bare && !props.group.isAlternative,
      }}
    >
      <Show when={!props.bare}>
      <div class="flex items-center gap-2 px-3 py-2">
        <button class="flex min-w-0 flex-1 items-center gap-2 text-left" data-toggle onClick={() => setOpen(!open())} aria-expanded={open()}>
          <span class="text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
            ▶
          </span>
          <span
            class="chip border-transparent shrink-0 text-[10px] uppercase tracking-wide"
            style={{ color: kindColor(props.group.kind), 'background-color': kindColor(props.group.kind) + '1f' }}
          >
            {kindLabel(props.group.kind)}
          </span>
          <span class="truncate text-sm font-bold">{props.group.label}</span>
          <Tags extra={isExtra()} nonCanon={!props.nodeNonCanon && allNonCanon()} />
          <Show when={props.group.isAlternative}>
            <span class="chip shrink-0 border-sea-300 text-[10px] text-sea-500 dark:border-sea-600">Alternative</span>
          </Show>
          <Show when={props.group.isAlternative && props.group.episodes.length > 0 && props.group.episodes.every((e) => notNeeded(e.id))}>
            <span class="chip shrink-0 border-teal-500/50 text-[10px] text-teal-700 dark:text-teal-300" title="You watched the main version, so this alternative is optional">
              ✓ Not needed
            </span>
          </Show>
        </button>

        <Show when={prog()}>
          <span class="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span class="h-1.5 w-14 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
              <span class="voyage-fill block h-full rounded-full" style={{ width: `${prog()!.pct}%` }} />
            </span>
            <span class="text-[11px] tabular-nums text-sea-500 dark:text-sea-400">{Math.round(prog()!.pct)}%</span>
            <span class="text-[11px] tabular-nums text-sea-400 dark:text-sea-500" title="Watch time left / total">
              · {prog()!.minDone >= prog()!.minTotal ? fmtDuration(prog()!.minTotal) : `${fmtDuration(prog()!.minTotal - prog()!.minDone)} left of ${fmtDuration(prog()!.minTotal)}`}
            </span>
            <Show when={share()}>
              {(sh) => (
                <span class="text-[11px] tabular-nums text-sea-400 dark:text-sea-500" title={sh().title}>
                  · {sh().value}
                </span>
              )}
            </Show>
          </span>
        </Show>
        <span class="shrink-0 text-xs tabular-nums text-sea-500 dark:text-sea-400">
          {prog()?.watched ?? 0}/{prog()?.total ?? 0}
        </span>
        <button
          class="chip shrink-0 border-sea-300 text-[11px] text-sea-500 hover:border-strawhat-500 hover:text-strawhat-500 dark:border-sea-600 dark:text-sea-300"
          onClick={() => confirmBulk(ids(), !allWatched(), `in "${props.group.label}"`)}
          title={allWatched() ? 'Unmark all in this section' : 'Mark all in this section watched'}
        >
          {allWatched() ? 'Clear' : 'Mark all'}
        </button>
      </div>
      </Show>

      <Show when={open()}>
        <div classList={{ 'border-t border-sea-200 px-1.5 pb-1.5 pt-1 dark:border-sea-800/70': !props.bare }}>
          <Show when={props.group.kind === 'netflix' && props.node?.type !== 'liveaction'}>
            <div class="mx-2 mb-1.5 mt-1">
              <LiveActionPicker />
            </div>
          </Show>
          <Show when={props.group.info && (props.group.info.links.length || extraInfoText(props.group.info.text))}>
            <div class="mx-2 mb-1.5 mt-1 rounded-md bg-sea-100 px-2.5 py-1.5 text-xs dark:bg-sea-900/70">
              <Show when={extraInfoText(props.group.info!.text)}>
                <div class="mb-1 text-sea-600 dark:text-sea-300">{extraInfoText(props.group.info!.text)}</div>
              </Show>
              <Show when={props.group.info!.links.length}>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  <EpisodeRow ep={ep} kind={props.group.kind} showNonCanon={!props.nodeNonCanon && !allNonCanon()} />
                  <For each={props.inline?.get(ep.id) ?? []}>
                    {(child) => (
                      <li class="py-2 pl-4">
                        <GroupBlock group={child} inline={props.inline} node={props.node} nodeExtra={props.nodeExtra} nodeNonCanon={props.nodeNonCanon} />
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
