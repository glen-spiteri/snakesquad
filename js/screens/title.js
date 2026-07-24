// Title and finish screens — port of TitleView.swift / FinishedView.

import { app } from '../state.js';
import { APP_VERSION } from '../log.js';
import { el, button, screen, onTripleTap } from '../dom.js';
import { presentResearcher } from './researcher.js';

function motif() {
  const row = el('div', { class: 'motif' });
  for (let i = 0; i < 5; i += 1) {
    row.append(el('i', { style: { opacity: i === 4 ? '1' : String(0.45 + i * 0.12) } }));
  }
  row.append(el('i', { class: 'food' }));
  return row;
}

/**
 * Version label shown on the title and finish screens. Triple-tapping it opens
 * the passcode-gated researcher screen (export / reset).
 */
export function versionFooter() {
  const label = el('div', {
    class: 'version',
    text: `Snake Squad v${APP_VERSION} · research build`,
  });
  onTripleTap(label, presentResearcher);
  return label;
}

export function titleScreen() {
  return screen('centered',
    el('div', { class: 'spacer' }),
    motif(),
    el('div', { class: 'wordmark' }, 'SNAKE', el('br'), el('span', { class: 'squad', text: 'SQUAD' })),
    el('p', { style: { marginTop: '8px' } }, 'A cooperative snake game'),
    el('div', { class: 'spacer' }),
    el('div', { style: { width: '100%', maxWidth: '340px' } },
      button('Play', 'primary', () => app.advance())),
    versionFooter());
}

export function finishedScreen() {
  return screen('centered',
    el('div', { class: 'spacer' }),
    el('div', { class: 'glyph', text: '🏆' }),
    el('h1', { text: 'Thanks for playing!', style: { marginTop: '16px' } }),
    app.totalScore > 0 ? el('p', { text: `Final score: ${app.totalScore}` }) : null,
    el('div', { class: 'spacer' }),
    versionFooter());
}
