import { For, Show, createMemo } from 'solid-js';
import type { Episode, EpisodeLinks } from '../types';
import { isWatched, toggle } from '../store/progress';
import { prefs } from '../store/prefs';
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

  // Primary link honors the stream-source preference, with graceful fallbacks.
  const primaryKey = createMemo<keyof EpisodeLinks | null>(() => {
    const l = props.ep.links;
    const pref = prefs.streamSource;
    const pref1 = pref === 'onepace' ? 'onepace' : 'stremio';
    const pref2 = pref === 'onepace' ? 'stremio' : 'onepace';
    const chain: (keyof EpisodeLinks)[] = [pref1, pref2, 'drive', 'mega', 'nyaa', 'netflix', 'other'];
    for (const k of chain) if (l[k]) return k;
    return null;
  });

  const secondaryKeys = createMemo(() =>
    ORDER.filter((k) => props.ep.links[k] && k !== primaryKey()),
  );

  const metaBits = () =>
    [props.ep.pace, props.ep.anime ? `Anime ${props.ep.anime}` : null, props.ep.chapters ? `Ch. ${props.ep.chapters}` : null]
      .filter(Boolean)
      .join('  •  ');

  const showTooltip = () => props.ep.fullTitle && props.ep.fullTitle !== props.ep.title;

  return (
    <li
      class="group/ep flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100 dark:hover:bg-sea-800/60"
      classList={{ 'opacity-55': watched() }}
    >
      <label class="mt-0.5 flex cursor-pointer items-center">
        <input
          type="checkbox"
          class="h-5 w-5 cursor-pointer rounded border-slate-400 text-strawhat-500 accent-strawhat-500 focus:ring-strawhat-500 dark:border-sea-600"
          checked={watched()}
          onChange={() => toggle(props.ep.id)}
          aria-label={`Mark ${props.ep.title} watched`}
        />
      </label>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingBadge rating={props.ep.rating} color={props.ep.tierColor} />
          <Show
            when={showTooltip()}
            fallback={
              <span
                class="text-sm font-medium leading-snug"
                classList={{ 'line-through': watched() }}
              >
                {props.ep.title}
              </span>
            }
          >
            <Tooltip text={props.ep.fullTitle}>
              <span
                class="cursor-help text-sm font-medium leading-snug decoration-dotted underline-offset-4 hover:underline"
                classList={{ 'line-through': watched() }}
              >
                {props.ep.title}
              </span>
            </Tooltip>
          </Show>
        </div>

        <Show when={metaBits()}>
          <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{metaBits()}</div>
        </Show>

        <Show when={props.ep.description}>
          <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {props.ep.description}
          </p>
        </Show>

        <Show when={props.ep.notes && props.ep.notes.length}>
          <ul class="mt-1 space-y-0.5">
            <For each={props.ep.notes}>
              {(note) => (
                <li class="flex gap-1.5 text-xs text-amber-700 dark:text-gold-400">
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
            <a
              href={props.ep.links[k()]!}
              target="_blank"
              rel="noopener noreferrer"
              class="chip border-strawhat-500/40 bg-strawhat-500/10 text-strawhat-600 hover:bg-strawhat-500/20 dark:text-strawhat-500"
            >
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
              class="chip border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-sea-600 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {LINK_LABEL[k]}
            </a>
          )}
        </For>
      </div>
    </li>
  );
}
