import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { prefs, setPrefs, setVersionPref, type Prefs } from '../store/prefs';

interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

function Choice<T>(props: { label: string; hint?: string; options: Option<T>[]; value: T; onPick: (v: T) => void }) {
  return (
    <div class="space-y-1">
      <div class="text-[11px] font-bold uppercase tracking-wide text-sea-400">{props.label}</div>
      <div class="flex flex-wrap gap-1">
        <For each={props.options}>
          {(o) => (
            <button
              class="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
              classList={{
                'border-accent-400 bg-accent-500 text-white': props.value === o.value,
                'border-sea-600 text-sea-300 hover:border-accent-400 hover:text-accent-300': props.value !== o.value,
              }}
              aria-pressed={props.value === o.value}
              title={o.title}
              onClick={() => props.onPick(o.value)}
            >
              {o.label}
            </button>
          )}
        </For>
      </div>
      <Show when={props.hint}>
        <div class="text-[11px] leading-snug text-sea-400">{props.hint}</div>
      </Show>
    </div>
  );
}

/** Header menu for how the guide is laid out: versions, Live Action placement, Final Saga, Catch up. */
export default function SettingsMenu() {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  const onDocClick = (e: MouseEvent) => {
    if (root && !root.contains(e.target as Node)) setOpen(false);
  };
  onMount(() => document.addEventListener('click', onDocClick));
  onCleanup(() => document.removeEventListener('click', onDocClick));

  return (
    <div class="relative shrink-0" ref={root}>
      <button
        class="chip border-sea-600 font-semibold text-sea-200 hover:border-accent-400 hover:text-accent-400"
        onClick={() => setOpen(!open())}
        aria-expanded={open()}
        title="Choose versions and how the guide is laid out"
      >
        Settings ▾
      </button>
      <Show when={open()}>
        <div class="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] space-y-3.5 rounded-xl border border-sea-700 bg-sea-900 p-3 text-sm text-sea-100 shadow-xl">
          <Choice<Prefs['fishmanVersion']>
            label="Fish-Man Island"
            value={prefs.fishmanVersion}
            onPick={(v) => setVersionPref('fishmanVersion', v)}
            options={[
              { value: 'log', label: 'One Piece Log', title: 'The official 21-episode remaster' },
              { value: 'onepace', label: 'One Pace', title: 'The One Pace edit (Return to Sabaody and Fish-Man Island)' },
            ]}
            hint="The other version stays listed as an optional alternative."
          />
          <Choice<Prefs['fillerVersion']>
            label="Filler (G-8, Boat Piece)"
            value={prefs.fillerVersion}
            onPick={(v) => setVersionPref('fillerVersion', v)}
            options={[
              { value: 'funpace', label: 'Fun Pace', title: 'Paced cuts of the filler' },
              { value: 'original', label: 'Original anime', title: 'The full original anime episodes' },
            ]}
            hint="To skip filler entirely, turn off Filler & Fun Pace under Filters."
          />
          <Choice<Prefs['liveActionPlacement']>
            label="Live Action"
            value={prefs.liveActionPlacement}
            onPick={(v) => setPrefs('liveActionPlacement', v)}
            options={[
              { value: 'arc', label: 'Next to each arc', title: 'Watch each episode where the guide places it (some reveal things early)' },
              { value: 'post-enies-lobby-arc', label: 'After Post-Enies Lobby', title: 'Watch it all once the earlier reveals are covered' },
              {
                value: 'thriller-bark-arc',
                label: 'After Thriller Bark',
                title: 'Safest: the second season covers Laboon, which ties into a character met in Thriller Bark',
              },
            ]}
          />
          <Choice<boolean>
            label="Final Saga"
            value={prefs.splitFinalSaga}
            onPick={(v) => setPrefs('splitFinalSaga', v)}
            options={[
              { value: false, label: 'One saga' },
              { value: true, label: 'Egghead and Elbaph separate', title: 'List Egghead and Elbaph like the other sagas' },
            ]}
          />
          <Choice<boolean>
            label="Catch up"
            value={prefs.catchUpExtras}
            onPick={(v) => setPrefs('catchUpExtras', v)}
            options={[
              { value: true, label: 'Includes extras', title: 'Also marks the films, specials, Live Action and filler before that point' },
              { value: false, label: 'Main route only' },
            ]}
          />
        </div>
      </Show>
    </div>
  );
}
