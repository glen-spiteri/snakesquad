// Research (IRB) consent — port of ConsentView.swift.
//
// Deliberately separate from the in-game Terms & Privacy screen, which is an
// experimental stimulus.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, paragraphs } from '../dom.js';

export function consentScreen() {
  const field = el('input', {
    type: 'text',
    class: 'on-navy',
    placeholder: 'e.g. P-1042',
    autocapitalize: 'characters',
    autocorrect: 'off',
    spellcheck: 'false',
  });

  const submit = button('I agree to participate', 'primary', () => {
    const code = field.value.trim();
    eventLog.participantCode = code;
    // Not keyed "participant": that is already a fixed CSV column, and a
    // duplicate header confuses R/pandas on import.
    eventLog.log('consent_given', { participant_code: code });
    app.advance();
  }, { disabled: true });

  field.addEventListener('input', () => {
    submit.disabled = field.value.trim().length === 0;
  });

  return screen('scroll',
    el('div', { class: 'stack' },
      el('h2', { text: 'Research Study Consent' }),
      ...paragraphs([
        'You are invited to take part in a research study about how people interact with and make choices in mobile games. Taking part involves playing a short cooperative game and answering a brief questionnaire, which takes about 20 minutes.',
        'The app records how you use it — your survey answers, gameplay, and the choices you make on the app’s screens. All data is stored only on this device and is collected by the research team at the end of your session. No data is sent over the internet.',
        'Your participation is voluntary. You may stop at any time, and you may ask for your data to be deleted at any point without penalty. At the end of the session you will receive a full explanation of the study.',
        'If you have questions, please ask the researcher now or contact the research team afterwards.',
      ]),
      el('div', { class: 'stack tight' },
        el('div', { class: 'caption', text: 'Participant code (entered by researcher)' }),
        field),
      submit));
}
