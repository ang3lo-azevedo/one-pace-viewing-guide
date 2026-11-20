import { For, Show, createMemo } from 'solid-js';
import type { Episode, EpisodeLinks } from '../types';
import { isWatched, toggle } from '../store/progress';
import { prefs } from '../store/prefs';
import { syncToggle } from '../store/trakt';
import { splitTitle } from '../lib/guide';
import RatingBadge from './RatingBadge';
import Tooltip from './Tooltip';

const LINK_LABEL: Record<keyof EpisodeLinks, string> = {
  onepace: 'One Pace',
  stremio: 'Stremio',
  netflix: 'Netflix',
  mega: 'Mega',
  drive: 'Drive',
  nyaa: 'Nyaa',
  other: 'Watch',
};

const ORDER: (keyof EpisodeLinks)[] = ['onepace', 'stremio', 'netflix', 'drive', 'mega', 'nyaa', 'other'];

export default function EpisodeRow(props: { ep: Episode }) {
  const watched = () => isWatched(props.ep.id);
  const parts = createMemo(() => splitTitle(props.ep.title));
  const hideSub = () => prefs.spoilerSafe && parts().subtitle !== '';
  const displayed = () => (hideSub() ? parts().label : props.ep.title);
  const tipText = () => {
    const t = props.ep.fullTitle;
    return t && t !== displayed() ? t : null;
  };

  const primaryKey = createMemo<keyof EpisodeLinks | null>(() => {
    const l = props.ep.links;
    const pref = prefs.streamSource;
    const pref1 = pref === 'onepace' ? 'onepace' : 'stremio';
    const pref2 = pref === 'onepace' ? 'stremio' : 'onepace';
    const chain: (keyof EpisodeLinks)[] = [pref1, pref2, 'drive', 'mega', 'nyaa', 'netflix', 'other'];
    for (const k of chain) if (l[k]) return k;
    return null;
  });

  const secondaryKeys = createMemo(() => ORDER.filter((k) => props.ep.links[k] && k !== primaryKey()));

  const metaBits = () =>
    [props.ep.pace, props.ep.anime ? `Anime ${props.ep.anime}` : null, props.ep.chapters ? `Ch. ${props.ep.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  return (
    <li
      class="group/ep flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sea-100 dark:hover:bg-sea-800/50"
      classList={{ 'opacity-55': watched() }}
    >
      <label class="mt-0.5 flex cursor-pointer items-center">
        <input
          type="checkbox"
          class="h-5 w-5 cursor-pointer rounded border-sea-400 accent-strawhat-500 focus:ring-strawhat-500 dark:border-sea-600"
          checked={watched()}
          onChange={() => {
            toggle(props.ep.id);
            syncToggle(props.ep.id, isWatched(props.ep.id));
          }}
          aria-label={`Mark ${displayed()} watched`}
        />
      </label>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingBadge rating={props.ep.rating} color={props.ep.tierColor} />
          <Show
            when={tipText()}
            fallback={
              <span class="text-sm font-semibold leading-snug" classList={{ 'line-through': watched() }}>
                {displayed()}
              </span>
            }
          >
            <Tooltip text={tipText()}>
              <span
                class="cursor-help text-sm font-semibold leading-snug decoration-dotted underline-offset-4 hover:underline"
                classList={{ 'line-through': watched() }}
              >
                {displayed()}
              </span>
            </Tooltip>
          </Show>
        </div>

        <Show when={metaBits()}>
          <div class="mt-0.5 text-xs text-sea-500 dark:text-sea-400">{metaBits()}</div>
        </Show>

        <Show when={props.ep.description}>
          <p class="mt-1 text-xs leading-relaxed text-sea-500 dark:text-sea-400">{props.ep.description}</p>
        </Show>

        <Show when={props.ep.notes && props.ep.notes.length}>
          <ul class="mt-1 space-y-0.5">
            <For each={props.ep.notes}>
              {(note) => (
                <li class="flex gap-1.5 text-xs text-accent-600 dark:text-accent-300">
                  <span aria-hidden="true">⚑</span>
                  <span class="min-w-0">{note}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>

      <div class="flex shrink-0 flex-wrap items-center justify-end gap-1">
        <Show when={primaryKey()}>
          {(k) => (
            <a href={props.ep.links[k()]!} target="_blank" rel="noopener noreferrer" class="btn-watch">
              ▶ {LINK_LABEL[k()]}
            </a>
          )}
        </Show>
        <For each={secondaryKeys()}>
          {(k) => (
            <a
              href={props.ep.links[k]!}
              target="_blank"
              rel="noopener noreferrer"
              class="chip border-sea-300 text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300 dark:hover:text-accent-300"
            >
              {LINK_LABEL[k]}
            </a>
          )}
        </For>
      </div>
    </li>
  );
}
