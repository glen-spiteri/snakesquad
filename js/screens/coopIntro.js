// The Level 2 co-op unlock message, delivered before the invite screen —
// port of CoopIntroView.swift.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, paragraphs } from '../dom.js';

export function coopIntroScreen() {
  eventLog.log('coop_intro_shown');

  return screen('centered',
    el('div', { class: 'spacer' }),
    el('div', { class: 'glyph', text: '👥' }),
    el('h1', { text: 'Level 2 unlocked: Squads!', style: { marginTop: '16px' } }),
    el('div', { class: 'stack tight', style: { marginTop: '8px' } },
      ...paragraphs([
        'Team up to earn bonus points! Your squad shares one food goal — collect it together before time runs out.',
        'But be careful: if anyone crashes into a wall or another snake, the whole squad loses.',
        'Clear a level with your squad and everyone earns a +50% team bonus.',
      ])),
    el('div', { class: 'spacer' }),
    el('div', { style: { width: '100%', maxWidth: '340px', marginBottom: '40px' } },
      button('Find my squad', 'primary', () => {
        eventLog.log('coop_intro_continue');
        app.advance();
      })));
}
