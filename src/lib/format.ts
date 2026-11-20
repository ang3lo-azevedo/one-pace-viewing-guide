export const SERIESGRAPH_SHOW = 'https://seriesgraph.com/show/37854-one-piece';

/** First anime episode number in a field like "234–235, 240" (or null). */
export function firstAnimeEpisode(text: string | null): number | null {
  const m = text?.match(/\d+/);
  return m ? +m[0] : null;
}

/** Render the guide's small Markdown subset (**bold**, *italic*, `code`) as safe HTML. */
export function inlineMd(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return esc
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\$\\rightarrow\$/g, '→');
}
