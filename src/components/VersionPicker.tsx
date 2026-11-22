import { For, Show } from 'solid-js';
import { guide } from '../lib/guide';
import { prefs, setPrefs, setVersion, type Prefs } from '../store/prefs';
import { versionSet } from '../lib/versions';

interface Option<T> {
  value: T;
  label: string;
  title?: string;
}

/** A small inline version of a Settings choice, shown where it applies. */
export function InlineChoice<T>(props: { label: string; options: Option<T>[]; value: T; onPick: (v: T) => void; hint?: string }) {
  return (
    <div class="flex flex-wrap items-center gap-1.5 rounded-md bg-sea-100 px-2.5 py-1.5 text-xs dark:bg-sea-900/70">
      <span class="text-[10px] font-bold uppercase tracking-wide text-sea-400">{props.label}</span>
      <For each={props.options}>
        {(o) => (
          <button
            class="rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-colors"
            classList={{
              'border-accent-500 bg-accent-500 text-white': props.value === o.value,
              'border-sea-300 text-sea-500 hover:border-accent-400 hover:text-accent-500 dark:border-sea-600 dark:text-sea-300': props.value !== o.value,
            }}
            aria-pressed={props.value === o.value}
            title={o.title}
            onClick={(e) => {
              e.stopPropagation();
              props.onPick(o.value);
            }}
          >
            {o.label}
          </button>
        )}
      </For>
      <Show when={props.hint}>
        <span class="text-[11px] text-sea-400">{props.hint}</span>
      </Show>
    </div>
  );
}

const versionsByUid = new Map<string, string[]>();
for (const s of guide.sagas)
  for (const n of s.nodes) {
    const keys = new Set([n.version, ...n.groups.map((g) => g.version)].filter(Boolean).map((v) => v!.split(':')[0]));
    if (keys.size) versionsByUid.set(n.uid, [...keys]);
  }

/** Version choices for the section they affect (Fish-Man Island, G-8, Strong World...). */
export default function VersionPicker(props: { node: { uid: string } }) {
  return (
    <For each={versionsByUid.get(props.node.uid) ?? []}>
      {(key) => {
        const set = versionSet.get(key)!;
        return (
          <InlineChoice<string>
            label={key === 'strongworld' ? 'Watch it' : 'Watching'}
            value={prefs.versions[key]}
            onPick={(v) => setVersion(key, v)}
            options={set.options}
            hint="Also in Settings. The other version stays as an alternative."
          />
        );
      }}
    </For>
  );
}

/** Live Action placement, shown on the Live Action sections. */
export function LiveActionPicker() {
  return (
    <InlineChoice<Prefs['liveActionPlacement']>
      label="Live Action"
      value={prefs.liveActionPlacement}
      onPick={(v) => setPrefs('liveActionPlacement', v)}
      options={[
        { value: 'arc', label: 'Next to each arc' },
        { value: 'post-enies-lobby-arc', label: 'After Post-Enies Lobby' },
        { value: 'thriller-bark-arc', label: 'After Thriller Bark', title: 'Safest' },
      ]}
    />
  );
}

/** Final Saga layout, shown on the Final Saga. */
export function FinalSagaPicker() {
  return (
    <InlineChoice<boolean>
      label="Show as"
      value={prefs.splitFinalSaga}
      onPick={(v) => setPrefs('splitFinalSaga', v)}
      options={[
        { value: false, label: 'One saga' },
        { value: true, label: 'Egghead and Elbaph separate' },
      ]}
    />
  );
}
