import { For, Show } from 'solid-js';
import type { InfoPart } from '../lib/format';

/** A row of labelled facts: "Pace #12 · ANIME EPS 207–209 · CHAPTERS 304–306". */
export default function InfoLine(props: { parts: InfoPart[]; class?: string }) {
  return (
    <Show when={props.parts.length}>
      <div class={`flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-xs text-sea-500 dark:text-sea-400 ${props.class ?? ''}`}>
        <For each={props.parts}>
          {(p, i) => (
            <span class="inline-flex items-baseline gap-1" title={p.title}>
              <Show when={i() > 0}>
                <span class="text-sea-300 dark:text-sea-600" aria-hidden="true">
                  ·
                </span>
              </Show>
              <Show when={p.label}>
                <span class="text-[10px] font-semibold uppercase tracking-wide text-sea-400 dark:text-sea-500">{p.label}</span>
              </Show>
              <span class="tabular-nums text-sea-600 dark:text-sea-300" classList={{ 'font-semibold': !p.label }}>
                {p.value}
              </span>
            </span>
          )}
        </For>
      </div>
    </Show>
  );
}
