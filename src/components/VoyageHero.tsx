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

export default function VoyageHero() {
  const s = stats;
  return (
    <div class="space-y-4">
      <div class="card overflow-hidden p-4 sm:p-5">
        <div class="mb-2 flex items-end justify-between gap-3">
          <div>
            <div class="text-xs font-bold uppercase tracking-widest text-accent-400">Your One Pace Voyage</div>
            <div class="text-sm text-sea-500 dark:text-sea-400">
              Canon route · {s().canonWatched} of {s().canonTotal} episodes watched
            </div>
          </div>
          <div class="font-display text-3xl font-black tabular-nums text-accent-400 sm:text-4xl">
            {s().canonPct.toFixed(1)}%
          </div>
        </div>

        <div class="h-4 overflow-hidden rounded-full bg-sea-200 dark:bg-sea-800">
          <div
            class="voyage-fill h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.max(s().canonPct, 1.5)}%` }}
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <For
          each={[
            { label: 'Episodes Watched', value: `${s().canonWatched}`, sub: `of ${s().canonTotal} canon`, accent: '#66c0ef' },
            { label: 'Sagas Cleared', value: `${s().sagasCleared}`, sub: `of ${s().sagasTotal}`, accent: '#66c0ef' },
            { label: 'Official Pace', value: `${s().paceWatched}`, sub: `of ${s().paceTotal} (472 set)`, accent: '#8fd0f3' },
            { label: 'All Content', value: `${s().allWatched}`, sub: `of ${s().allTotal}`, accent: '#8fd0f3' },
            { label: 'Hours Watched', value: `${s().hoursWatched}h`, sub: 'approx', accent: '#ff0408' },
            { label: 'Hours Remaining', value: `${s().hoursRemaining}h`, sub: 'canon route', accent: '#90a4ae' },
          ]}
        >
          {(t) => <Tile label={t.label} value={t.value} sub={t.sub} accent={t.accent} />}
        </For>
      </div>
    </div>
  );
}
