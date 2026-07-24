// Disclosure 3: the "friends nearby" location pitch — port of LocationAskView.swift.
//
// Two-stage soft-ask -> real-ask pattern.
//
// IMPORTANT — how this differs from the iOS original, and why:
// Native iOS can request *authorization* without requesting a position
// (`requestWhenInUseAuthorization`). The web platform has no such call: the only
// way to raise the genuine system permission dialog is getCurrentPosition(),
// whose success callback is handed a GeolocationPosition. So:
//
//   * `getCurrentPosition` below is the ONLY geolocation call in this codebase.
//   * Its success handler takes NO parameter — the position object is dropped on
//     the floor unread. No coordinate, timestamp, or accuracy value is read,
//     copied, logged, or stored, and `enableHighAccuracy` is left off.
//   * Only the permission *decision* is recorded.
//
// Browser permissions are also remembered per origin, unlike a fresh app
// install, so a second participant on the same installed icon might never see
// the dialog. `location_permission_prior` records the pre-existing state so
// contaminated runs are identifiable in the data rather than silently wrong.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen } from '../dom.js';

export function locationScreen() {
  const shownAt = Date.now();
  let awaitingSystemDialog = false;

  eventLog.log('location_prompt_shown');
  logPriorPermission();

  const enableButton = button('Enable notifications', 'primary', () => softAskAccepted());
  const laterButton = button('Maybe later', 'secondary', () => {
    if (awaitingSystemDialog) return;
    eventLog.log('location_softask', {
      value: 'declined',
      latency_s: Math.round((Date.now() - shownAt) / 1000),
    });
    app.advance();
  });

  function softAskAccepted() {
    if (awaitingSystemDialog) return;
    eventLog.log('location_softask', {
      value: 'accepted',
      latency_s: Math.round((Date.now() - shownAt) / 1000),
    });

    awaitingSystemDialog = true;
    enableButton.disabled = true;
    laterButton.disabled = true;

    requestAuthorization((value) => {
      eventLog.log('location_system_dialog', { value });
      app.advance();
    });
  }

  return screen('centered',
    el('div', { class: 'spacer' }),
    el('div', { class: 'glyph', text: '📍' }),
    el('h2', { text: 'Get notified when squad members are nearby!', style: { marginTop: '16px' } }),
    el('p', { text: 'Allow location so we can tell you when friends are around for a quick co-op run.' }),
    el('div', { class: 'spacer' }),
    el('div', { class: 'stack tight', style: { width: '100%', maxWidth: '340px', marginBottom: '40px' } },
      enableButton, laterButton));
}

/**
 * Raises the real system permission dialog and reports only the decision.
 * `granted` corresponds to the iOS build's `authorizedWhenInUse`.
 */
function requestAuthorization(completion) {
  if (!navigator.geolocation) {
    completion('unavailable');
    return;
  }

  let settled = false;
  const finish = (value) => {
    if (settled) return;
    settled = true;
    completion(value);
  };

  navigator.geolocation.getCurrentPosition(
    // No parameter: the position is never bound, read, or stored.
    () => finish('granted'),
    (error) => {
      if (error.code === error.PERMISSION_DENIED) finish('denied');
      else if (error.code === error.TIMEOUT) finish('timeout');
      else finish('position_unavailable');
    },
    // No high accuracy, and a cached fix is fine — we only want the decision.
    { enableHighAccuracy: false, timeout: 30000, maximumAge: Infinity }
  );
}

/** Records whether this origin had already been granted or denied location. */
function logPriorPermission() {
  if (!navigator.permissions || !navigator.permissions.query) {
    eventLog.log('location_permission_prior', { value: 'unknown' });
    return;
  }
  navigator.permissions.query({ name: 'geolocation' })
    .then((status) => eventLog.log('location_permission_prior', { value: status.state }))
    .catch(() => eventLog.log('location_permission_prior', { value: 'unknown' }));
}
