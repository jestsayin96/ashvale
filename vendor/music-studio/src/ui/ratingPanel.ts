import { RATING_VALUES } from '../io/ratings';
import { h } from './dom';
import type { Shell } from './transport';

const LABELS: Record<(typeof RATING_VALUES)[number], string> = {
  love: 'Love it',
  too_busy: 'Too busy',
  too_empty: 'Too empty',
  too_bright: 'Too bright',
  too_dark: 'Too dark',
  not_for_mood: 'Not for this mood',
};

export function mountRatingPanel(parent: HTMLElement, shell: Shell): { refresh(): void } {
  const note = h('input', { type: 'text', placeholder: 'Optional note' });
  const count = h('span', { class: 'hint', text: 'Saved ratings: 0' });
  const download = h('button', { type: 'button', text: 'Download ratings.json' });
  const row = h('div', { class: 'toolbar' });

  for (const rating of RATING_VALUES) {
    const button = h('button', { type: 'button', text: LABELS[rating] });
    button.addEventListener('click', () => {
      void window.musicStudio.rate({ rating, note: note.value || undefined }).then((result) => {
        if (!result.ok) {
          shell.status(result.error);
          return;
        }
        refresh();
      });
    });
    row.append(button);
  }

  download.addEventListener('click', () => {
    const name = window.musicStudio.downloadRatings();
    shell.status(`Downloaded ${name}`);
  });

  parent.append(h('h2', { text: 'Rating' }), row, note, download, count);

  function refresh(): void {
    const n = window.musicStudio.getRatings().length;
    count.textContent = `Saved ratings: ${n}`;
  }

  return { refresh };
}
