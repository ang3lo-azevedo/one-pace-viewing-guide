import { Show } from 'solid-js';

function readableText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}

export default function RatingBadge(props: {
  rating: number | null;
  color: string | null;
  size?: 'sm' | 'md';
}) {
  return (
    <Show when={props.rating != null}>
      <span
        class="inline-flex items-center gap-0.5 rounded-md font-semibold leading-none"
        classList={{
          'px-1.5 py-1 text-[11px]': props.size !== 'md',
          'px-2 py-1 text-sm': props.size === 'md',
        }}
        style={{
          'background-color': props.color ?? '#64748b',
          color: readableText(props.color ?? '#64748b'),
        }}
        title={`SeriesGraph rating ${props.rating}`}
      >
        <span aria-hidden="true">★</span>
        {props.rating?.toFixed(1)}
      </span>
    </Show>
  );
}
