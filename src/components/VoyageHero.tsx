import { For } from 'solid-js';
import { stats } from '../lib/stats';

function Tile(props: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div class="card flex flex-col justify-center px-3 py-2.5">
      <div class="text-xl font-black tabular-nums sm:text-2xl" style={{ color: props.accent }}>
        {props.value}
      </div>
      <div class="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {props.label}
      </div>
      {props.sub && <div class="text-[11px] text-slate-400 dark:text-slate-500">{props.sub}</div>}
    </div>
  );
}

export default function VoyageHero() {
  const s = stats;
  return (
    <div class="space-y-4">
      {/* Voyage progress */}
      <div class="card overflow-hidden p-4 sm:p-5">
        <div class="mb-2 flex items-end justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-widest text-strawhat-500">
              Voyage to Laugh Tale
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400">
              One Pace canon route · {s().canonWatched} of {s().canonTotal} episodes
            </div>
          </div>
          <div class="text-3xl font-black tabular-nums text-strawhat-500 sm:text-4xl">
            {s().canonPct.toFixed(1)}%
          </div>
        </div>

        <div class="relative">
          <div class="h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-sea-800">
            <div
              class="voyage-fill h-full rounded-full bg-gradient-to-r from-sea-600 via-strawhat-500 to-gold-400 transition-all duration-700"
              style={{ width: `${Math.max(s().canonPct, 1.5)}%` }}
            />
          </div>
          <div class="mt-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            <span>⚓ Foosha Village</span>
            <span>Laugh Tale 🏴‍☠️</span>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <For
          each={[
            { label: 'Episodes Watched', value: `${s().canonWatched}`, sub: `of ${s().canonTotal} canon`, accent: '#e4572e' },
            { label: 'Sagas Cleared', value: `${s().sagasCleared}`, sub: `of ${s().sagasTotal}`, accent: '#38bdf8' },
            { label: 'Official Pace', value: `${s().paceWatched}`, sub: `of ${s().paceTotal} (472 set)`, accent: '#f4d35e' },
            { label: 'All Content', value: `${s().allWatched}`, sub: `of ${s().allTotal}`, accent: '#2dd4bf' },
            { label: 'Hours Watched', value: `${s().hoursWatched}h`, sub: 'approx', accent: '#a855f7' },
            { label: 'Hours Remaining', value: `${s().hoursRemaining}h`, sub: 'canon route', accent: '#94a3b8' },
          ]}
        >
          {(t) => <Tile label={t.label} value={t.value} sub={t.sub} accent={t.accent} />}
        </For>
      </div>
    </div>
  );
}
