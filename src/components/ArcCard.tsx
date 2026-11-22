import { For, Show, createMemo, createSignal, createEffect } from 'solid-js';
import InfoLine from './InfoLine';
import { rangeInfo } from '../lib/format';
import { timeVsAnime } from '../lib/rangeTime';
import { flatEpisodes } from '../lib/guide';
import { hasActiveFilters, onlyIncluded, type FilteredGroup, type FilteredNode } from '../lib/filter';
import { isWatched } from '../store/progress';
import { confirmBulk } from '../lib/confirm';
import { tierForRating } from '../lib/guide';
import { idsOfNodeKey, nodeKeyOf } from '../lib/layout';
import { catchUpIds } from '../lib/catchup';
import { prefs } from '../store/prefs';
import { fmtDate, fmtDuration, fmtFromNow, minutesOf, stats } from '../lib/stats';
import RatingBadge from './RatingBadge';
import { Tags } from './Tags';
import { extraCategory } from '../lib/guide';
import type { Group, GuideNode } from '../types';
import { SERIESGRAPH_SHOW } from '../lib/format';
import GroupBlock from './GroupBlock';
import VersionPicker, { LiveActionPicker } from './VersionPicker';
import { focusTarget, reveal } from '../lib/focus';
import { wasOpen } from '../lib/restore';

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  arc: { label: 'Arc', cls: 'border-accent-400/40 text-accent-500 dark:text-accent-300' },
  movie: { label: 'Movie', cls: 'border-strawhat-500/40 text-strawhat-500' },
  special: { label: 'Special', cls: 'border-teal-400/40 text-teal-600 dark:text-teal-300' },
  filler: { label: 'Filler', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
  upcoming: { label: 'Upcoming', cls: 'border-sea-400/40 text-sea-500 dark:text-sea-300' },
  liveaction: { label: 'Live Action', cls: 'border-red-500/40 text-red-600 dark:text-red-400' },
};

export default function ArcCard(props: { node: FilteredNode }) {
  // Arcs start collapsed; open them automatically when searching/filtering so matches show.
  const [open, setOpen] = createSignal(wasOpen(`arc:${props.node.uid}`) ?? (hasActiveFilters() || focusTarget?.nodeUid === props.node.uid));
  // Open when an episode inside is revealed (page load or "Continue watching").
  createEffect(() => {
    if (reveal()?.nodeUid === props.node.uid) setOpen(true);
  });

  const prog = () => stats().perNode[props.node.uid];
  const arcIds = () => onlyIncluded(idsOfNodeKey(props.node.uid));
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
  // Whole arcs that are extras (films, specials, Live Action, filler arcs) sit indented and tagged.
  const isExtraNode = () =>
    props.node.type !== 'arc' || props.node.groups.every((g) => extraCategory(g as Group, props.node as GuideNode) !== null);
  const isNonCanonNode = () => props.node.groups.every((g) => g.episodes.every((e) => e.nonCanon));
  // Canon episodes in this arc (independent of filters), for the summary line.
  const canonEntries = flatEpisodes.filter((f) => f.ep.canon && nodeKeyOf(f) === props.node.uid);
  const canonCount = canonEntries.length;
  const canonMinutes = canonEntries.reduce((m, f) => m + minutesOf(f), 0);
  const info = () => {
    const parts = rangeInfo(props.node, canonCount || undefined);
    const t = timeVsAnime(canonMinutes, props.node.anime);
    const eta = stats().etaNode[props.node.uid];
    const p = stats().perNode[props.node.uid];
    // Total of everything shown in this arc/saga (extras included), when it differs from the canon time.
    const total = p && p.minTotal > canonMinutes ? [{ label: 'Total', value: fmtDuration(p.minTotal), title: 'Everything shown here, including extras' }] : [];
    const left = p && p.minDone > 0 && p.minDone < p.minTotal ? [{ label: 'Left', value: fmtDuration(p.minTotal - p.minDone), title: 'Watch time left in your current selection' }] : [];
    return [...parts, ...(t ? [t] : []), ...total, ...left, ...(eta ? [{ label: 'Done by', value: fmtDate(eta), title: `At your current pace (${fmtFromNow(eta)})` }] : [])];
  };

  return (
    <div
      class="card scroll-mt-28 overflow-clip"
      classList={{ 'ml-5 sm:ml-10 border-l-4 !border-l-amber-400/60': isExtraNode() }}
      id={props.node.id}
      data-open-key={open() ? `arc:${props.node.uid}` : undefined}
      data-open-title={props.node.title}
    >
      <div class="flex flex-wrap items-start gap-x-2 gap-y-2 px-3 py-3 sm:flex-nowrap sm:px-4" classList={{ 'border-b border-sea-200 dark:border-sea-800': open() }}>
        <div
          role="button"
          tabindex="0"
          class="mt-0.5 flex min-w-0 flex-1 items-start gap-3 text-left cursor-pointer"
          data-toggle
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
              <Tags extra={isExtraNode()} nonCanon={isNonCanonNode()} />
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
            <InfoLine parts={info()} class="mt-1" />
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

        <div class="flex w-full shrink-0 items-center gap-1 pl-6 sm:w-auto sm:flex-col sm:items-end sm:pl-0">
          <span class="mr-auto text-xs font-semibold tabular-nums text-sea-500 sm:mr-0 dark:text-sea-400">
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
              onClick={() => confirmBulk(catchUpIds(idsOfNodeKey(props.node.uid)), true, `before ${props.node.title}${prefs.catchUpExtras ? '' : ' (canon route only)'}`)}
              title="Mark everything before this arc watched"
            >
              Catch up
            </button>
          </div>
        </div>
      </div>

      <Show when={open()}>
        <div class="space-y-2 p-2 sm:p-3">
          <VersionPicker node={props.node} />
          <Show when={props.node.type === 'liveaction'}>
            <LiveActionPicker />
          </Show>
          <For each={layout().top}>
            {(group) => (
              <GroupBlock
                group={group}
                inline={layout().inline}
                node={props.node}
                nodeExtra={isExtraNode()}
                nodeNonCanon={isNonCanonNode()}
                bare={layout().top.length === 1 && layout().inline.size === 0}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
