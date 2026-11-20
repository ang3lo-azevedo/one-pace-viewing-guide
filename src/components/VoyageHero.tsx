import { For } from 'solid-js';
import { stats } from '../lib/stats';

function Tile(props: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div class="card flex flex-col justify-center px-3 py-2.5">
      <div class="font-display text-xl font-black tabular-nums sm:text-2xl" style={{ color: props.accent }}>
        {props.value}
      </div>
      <div class="text-[11px] font-semibold uppercase tracking-wide text-sea-500 dark:text-sea-400">{props.label}</div>
      {props.sub && <div class="text-[11px] text-sea-400 dark:text-sea-500">{props.sub}</div>}
    </div>
  );
}

function Bar(props: { label: string; detail: string; pct: number; muted?: boolean }) {
  return (
    <div>
      <div class="mb-1 flex items-end justify-between gap-3">
        <div>
          <div
            class="text-xs font-bold uppercase tracking-widest"
            classList={{ 'text-accent-400': !props.muted, 'text-sea-400': props.muted }}
          >
            {props.label}
          </div>
          <div class="text-sm text-sea-500 dark:text-sea-400">{props.detail}</div>
        </div>
        <div
          class="font-display font-black tabular-nums"
          classList={{
            'text-3xl text-accent-400 sm:text-4xl': !props.muted,
            'text-2xl text-sea-300 sm:text-3xl': props.muted,
          }}
        >
          {props.pct.toFixed(1)}%
        </div>
      </div>
      <div
        class="overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800"
        classList={{ 'h-4': !props.muted, 'h-2.5': props.muted }}
      >
        <div
          class="h-full rounded-full transition-all duration-700"
          classList={{ 'voyage-fill': !props.muted, 'bg-sea-400': props.muted }}
          style={{ width: `${Math.max(props.pct, 1.5)}%` }}
        />
      </div>
    </div>
  );
}

export default function VoyageHero() {
  const s = stats;
  return (
    <div class="space-y-4">
      <div class="card space-y-4 overflow-hidden p-4 sm:p-5">
        <Bar
          label="Canon route"
          detail={`${s().canonWatched} of ${s().canonTotal} episodes watched`}
          pct={s().canonPct}
        />
        <Bar
          label="Everything, incl. non-canon"
          detail={`${s().allWatched} of ${s().allTotal} entries (movies, specials, live action, filler)`}
          pct={s().allPct}
          muted
        />
      </div>

      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <For
          each={[
            { label: 'Episodes Watched', value: `${s().canonWatched}`, sub: `of ${s().canonTotal} canon`, accent: '#66c0ef' },
            { label: 'Sagas Cleared', value: `${s().sagasCleared}`, sub: `of ${s().sagasTotal}`, accent: '#66c0ef' },
            { label: 'Official Pace', value: `${s().paceWatched}`, sub: `of ${s().paceTotal} (472 set)`, accent: '#8fd0f3' },
            { label: 'Time Left (Canon)', value: `${s().hoursLeftCanon}h`, sub: 'canon route only', accent: '#ff0408' },
            { label: 'Time Left (All)', value: `${s().hoursLeftAll}h`, sub: 'incl. non-canon', accent: '#90a4ae' },
            {
              label: 'Time Saved',
              value: `${s().hoursSavedTotal}h`,
              sub: `vs. full anime · ${s().hoursSavedSoFar}h so far`,
              accent: '#2dd4bf',
            },
          ]}
        >
          {(t) => <Tile label={t.label} value={t.value} sub={t.sub} accent={t.accent} />}
        </For>
      </div>
    </div>
  );
}
