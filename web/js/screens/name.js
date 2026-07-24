// Player name entry — port of NameEntryView.swift.
//
// The name appears above the player's snake and is excluded from the random
// teammate-name assignment.

import { app, SquadIdentity } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen } from '../dom.js';

export function nameScreen() {
  const field = el('input', {
    type: 'text',
    class: 'on-navy',
    placeholder: 'Your name',
    autocapitalize: 'words',
    autocorrect: 'off',
    spellcheck: 'false',
    style: { textAlign: 'center', fontSize: '19px', padding: '14px' },
  });

  const submit = button('Continue', 'primary', () => {
    const trimmed = field.value.trim();
    SquadIdentity.playerName = trimmed;
    eventLog.log('player_name_set', { value: trimmed });
    app.advance();
  }, { disabled: true });

  field.addEventListener('input', () => {
    submit.disabled = field.value.trim().length === 0;
  });

  return screen('centered',
    el('div', { class: 'spacer' }),
    el('div', { class: 'glyph', text: '👤' }),
    el('h2', { text: 'What should we call you?', style: { marginTop: '16px' } }),
    el('p', { text: 'This is how your squad will see you in the game.' }),
    el('div', { class: 'stack', style: { width: '100%', maxWidth: '320px', marginTop: '20px' } },
      field,
      submit),
    el('div', { class: 'spacer' }),
    el('div', { class: 'spacer' }));
}
