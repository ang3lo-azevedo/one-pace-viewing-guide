import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

/** Spoiler-safe hover/focus tooltip showing the full episode title. */
export default function Tooltip(props: { text: string | null; children: JSX.Element }) {
  return (
    <span class="tt-wrap relative inline-block" tabindex={props.text ? 0 : undefined}>
      {props.children}
      <Show when={props.text}>
        <span role="tooltip" class="tt-pop">
          {props.text}
        </span>
      </Show>
    </span>
  );
}
