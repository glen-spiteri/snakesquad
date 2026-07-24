// Post-study debrief — port of DebriefView.swift.
//
// Discloses the privacy focus, the simulated teammates, and exactly what was
// (and was not) collected. Offers on-the-spot withdrawal.

import { app, SquadIdentity } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, confirmDialog } from '../dom.js';

export function debriefScreen() {
  eventLog.log('debrief_shown');

  const point = (title, body) => el('div', { class: 'stack tight' },
    el('p', { class: 'white', text: title, style: { fontWeight: '700' } }),
    el('p', { text: body }));

  return screen('scroll',
    el('div', { class: 'stack' },
      el('h2', { text: 'About this study' }),

      el('p', { text: 'Thank you for playing Snake Squad! Now that the session is over, we can tell you the full purpose of the study.' }),
      el('p', { text: 'This research is about privacy decision-making: how the choices people make in the moment — accepting a privacy policy, sharing friends’ contact details, allowing location access — compare with the preferences they state in surveys.' }),

      point('Your teammates were computer-controlled.',
        `${teammateList()} part of the game program. No other people played with you.`),
      point('No invitations were sent.',
        'If you entered friends’ details, nothing was sent to them. Any names you typed were used only to label your computer-controlled teammates; email addresses and phone numbers were never stored. The app kept only anonymous records (for example, how many fields were filled in and whether an email looked valid).'),
      point('Your location was never collected.',
        'The app only recorded whether you allowed or declined the permission. Allowing it hands the app a position from your device, which the app discards immediately without reading or storing any part of it — no location reading was ever kept. You can revoke the permission at any time in your device settings.'),
      point('No data was shared with anyone.',
        'Despite what the in-game policy described, this app sends nothing over the internet. All records stay on this device until the researcher collects them.'),

      el('p', { text: 'If you would rather not have your responses included in the study, tap “Withdraw my data” below and everything recorded during your session will be permanently deleted from this device.' }),

      el('div', { class: 'stack tight', style: { marginTop: '8px' } },
        button('Finish', 'primary', () => {
          eventLog.log('debrief_acknowledged');
          app.advance();
        }),
        button('Withdraw my data', 'destructive', async () => {
          const ok = await confirmDialog({
            title: 'Withdraw your data?',
            message: 'All data recorded during your session will be permanently deleted from this device. This cannot be undone.',
            confirmLabel: 'Delete everything',
          });
          if (ok) app.resetForNextParticipant();
        }))));
}

function teammateList() {
  const names = SquadIdentity.botNames().map((n) => `“${n}”`);
  if (names.length === 0) return 'Your teammates were';
  if (names.length === 1) return `${names[0]} was`;
  return `${names.join(' and ')} were`;
}
