import { Show } from 'solid-js';

/** "Extra" (optional, outside the main route) and "Non-canon" (not part of the story). */
export function ExtraTag() {
  return (
    <span
      class="chip shrink-0 border-amber-400/50 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
      title="Optional extra: not part of the main One Pace route"
    >
      Extra
    </span>
  );
}

export function NonCanonTag() {
  return (
    <span
      class="chip shrink-0 border-fuchsia-400/50 text-[10px] uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300"
      title="Not part of the story canon"
    >
      Non-canon
    </span>
  );
}

export function Tags(props: { extra?: boolean; nonCanon?: boolean }) {
  return (
    <>
      <Show when={props.extra}>
        <ExtraTag />
      </Show>
      <Show when={props.nonCanon}>
        <NonCanonTag />
      </Show>
    </>
  );
}
