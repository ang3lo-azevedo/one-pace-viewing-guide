import { For, Show, createMemo, createSignal } from 'solid-js';
import { hasActiveFilters, onlyIncluded, type FilteredGroup, type FilteredNode } from '../lib/filter';
import { isWatched } from '../store/progress';
import { confirmBulk } from '../lib/confirm';
import { allIdsOfNode, idsBeforeNode, tierForRating } from '../lib/guide';
import { stats } from '../lib/stats';
import RatingBadge from './RatingBadge';
import { SERIESGRAPH_SHOW } from '../lib/format';
import GroupBlock from './GroupBlock';
import { focusTarget } from '../lib/focus';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  arc: { label: 'Arc', cls: 'border-accent-400/40 text-accent-500 dark:text-accent-300' },
  movie: { label: 'Movie', cls: 'border-strawhat-500/40 text-strawhat-500' },
  special: { label: 'Special', cls: 'border-teal-400/40 text-teal-600 dark:text-teal-300' },
  filler: { label: 'Filler', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
  upcoming: { label: 'Upcoming', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
};

export default function ArcCard(props: { node: FilteredNode }) {
  // Arcs start collapsed; open them automatically when searching/filtering so matches show.
  const [open, setOpen] = createSignal(hasActiveFilters() || focusTarget?.nodeUid === props.node.uid);

  const prog = () => stats().perNode[props.node.uid];
  const arcIds = () => onlyIncluded(allIdsOfNode(props.node.uid));
  const allArcWatched = () => arcIds().length > 0 && arcIds().every((id) => isWatched(id));

  // Sections nested inside another one (e.g. a special mid-arc) render right after their
  // anchor episode; if that episode is filtered out they fall back to the top level.
  const layout = createMemo(() => {
    const visible = new Set(props.node.groups.flatMap((g) => g.episodes.map((e) => e.id)));
    const inline = new Map<string, FilteredGroup[]>();
    const top: FilteredGroup[] = [];
    for (const g of props.node.groups) {
      if (g.afterEpisode && visible.has(g.afterEpisode)) {
        const list = inline.get(g.afterEpisode) ?? [];
        list.push(g);
        inline.set(g.afterEpisode, list);
      } else top.push(g);
    }
    return { top, inline };
  });

  const badge = () => TYPE_BADGE[props.node.type] ?? TYPE_BADGE.arc;
  const meta = () =>
    [props.node.pace, props.node.anime ? `Anime ${props.node.anime}` : null, props.node.chapters ? `Ch. ${props.node.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <div class="card scroll-mt-28 overflow-hidden" id={props.node.id}>
      <div class="flex items-start gap-2 px-3 py-3 sm:px-4">
        <div
          role="button"
          tabindex="0"
          class="mt-0.5 flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
          onClick={() => setOpen(!open())}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(!open()))}
          aria-expanded={open()}
        >
          <span class="mt-1 text-xs transition-transform" classList={{ 'rotate-90': open() }} aria-hidden="true">
            ▶
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class={`chip ${badge().cls}`}>{badge().label}</span>
              <h3 class="text-base font-extrabold leading-tight">{props.node.title}</h3>
              <RatingBadge
                rating={props.node.rating}
                color={tierForRating(props.node.rating)?.color ?? null}
                href={props.node.type === 'arc' ? SERIESGRAPH_SHOW : null}
                title={props.node.type === 'arc' ? `Average of this arc\'s One Pace episodes on SeriesGraph (${props.node.rating}). Open One Piece on SeriesGraph` : undefined}
              />
              <Show when={props.node.isAlternative}>
                <span class="chip border-sea-300 text-[10px] text-sea-500 dark:border-sea-600">Alternative</span>
              </Show>
            </div>
            <Show when={meta()}>
              <div class="mt-1 text-xs text-sea-500 dark:text-sea-400">{meta()}</div>
            </Show>
            <Show when={prog()}>
              <div class="mt-2 flex max-w-xs items-center gap-2">
                <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
                  <div class="voyage-fill h-full rounded-full transition-all duration-500" style={{ width: `${prog()!.pct}%` }} />
                </div>
                <span class="text-[11px] font-semibold tabular-nums text-sea-500 dark:text-sea-400">{Math.round(prog()!.pct)}%</span>
              </div>
            </Show>
          </div>
        </div>

        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="text-xs font-semibold tabular-nums text-sea-500 dark:text-sea-400">
            {prog()?.watched ?? 0}/{prog()?.total ?? 0}
          </span>
          <div class="flex gap-1">
            <button
              class="chip border-sea-300 text-[10px] text-sea-500 hover:border-strawhat-500 hover:text-strawhat-500 dark:border-sea-600 dark:text-sea-300"
              onClick={() => confirmBulk(arcIds(), !allArcWatched(), `in ${props.node.title}`)}
              title={allArcWatched() ? 'Unmark this arc' : 'Mark this whole arc watched'}
            >
              {allArcWatched() ? 'Clear arc' : 'Mark arc'}
            </button>
            <button
              class="chip border-sea-300 text-[10px] text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300"
              onClick={() => confirmBulk(onlyIncluded(idsBeforeNode(props.node.uid)), true, `before ${props.node.title}`)}
              title="Mark everything before this arc watched"
            >
              Catch up
            </button>
          </div>
        </div>
      </div>

      <Show when={open()}>
        <div class="space-y-2 border-t border-sea-200 p-2 dark:border-sea-800 sm:p-3">
          <For each={layout().top}>{(group) => <GroupBlock group={group} inline={layout().inline} />}</For>
        </div>
      </Show>
    </div>
  );
}
