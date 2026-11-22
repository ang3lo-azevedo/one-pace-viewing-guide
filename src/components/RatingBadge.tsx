import { prefs } from '../store/prefs';
import { Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';

function readableText(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1e293b' : '#ffffff';
}

/** The SeriesGraph star rating. With `href` it links to the rating's source page. */
export default function RatingBadge(props: {
  rating: number | null;
  color: string | null;
  size?: 'sm' | 'md';
  href?: string | null;
  title?: string;
}) {
  return (
    <Show when={props.rating != null && prefs.ratingsShown !== 'trakt'}>
      <Dynamic
        component={props.href ? 'a' : 'span'}
        href={props.href ?? undefined}
        target={props.href ? '_blank' : undefined}
        rel={props.href ? 'noopener noreferrer' : undefined}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        class="inline-flex items-center gap-0.5 rounded-md font-semibold leading-none"
        classList={{
          'px-1.5 py-1 text-[11px]': props.size !== 'md',
          'px-2 py-1 text-sm': props.size === 'md',
          'hover:ring-2 hover:ring-white/40 cursor-pointer': !!props.href,
        }}
        style={{
          'background-color': props.color ?? '#64748b',
          color: readableText(props.color ?? '#64748b'),
        }}
        title={props.title ?? `SeriesGraph rating ${props.rating}${props.href ? ' (open on SeriesGraph)' : ''}`}
      >
        <span aria-hidden="true">★</span>
        {props.rating?.toFixed(1)}
      </Dynamic>
    </Show>
  );
}
