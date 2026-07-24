// Disclosure 1: the in-game Terms & Privacy screen — port of TermsView.swift.
//
// Measures: whether the policy is opened, dwell time, scroll depth, and the
// optional third-party data-sharing consent toggle.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, presentSheet, sheetFrame } from '../dom.js';
import { privacyPolicySections } from '../content/privacyPolicy.js';

export function termsScreen() {
  let agreedToTerms = false;
  let shareWithThirdParties = false;
  let toggleFlips = 0;
  let policyOpens = 0;
  const appearedAt = Date.now();

  const policyLink = el('button', {
    class: 'btn link',
    style: { textDecoration: 'underline', fontSize: '17px', fontWeight: '600' },
    text: 'Terms of Service & Privacy Policy',
    on: { click: () => { policyOpens += 1; presentPolicy(); } },
  });

  const agreeRow = el('button', { class: 'check-row', 'aria-checked': 'false', role: 'checkbox' },
    el('span', { class: 'check-box' }),
    el('span', { class: 'label', text: 'I agree to the Terms of Service and Privacy Policy' }));

  const shareRow = el('button', { class: 'toggle-row', 'aria-checked': 'false', role: 'switch' },
    el('span', {
      class: 'label',
      text: 'Share my gameplay and device data with third-party partners and advertisers to receive personalized offers and rewards',
    }),
    el('span', { class: 'switch' }));

  const continueButton = button('Continue', 'primary', () => {
    eventLog.log('third_party_consent', {
      value: shareWithThirdParties,
      toggle_flips: toggleFlips,
    });
    eventLog.log('terms_accepted', {
      policy_open_count: policyOpens,
      screen_dwell_s: Math.round((Date.now() - appearedAt) / 1000),
    });
    app.advance();
  }, { disabled: true });

  agreeRow.addEventListener('click', () => {
    agreedToTerms = !agreedToTerms;
    agreeRow.setAttribute('aria-checked', String(agreedToTerms));
    continueButton.disabled = !agreedToTerms;
  });

  shareRow.addEventListener('click', () => {
    shareWithThirdParties = !shareWithThirdParties;
    toggleFlips += 1;
    shareRow.setAttribute('aria-checked', String(shareWithThirdParties));
  });

  return screen('centered',
    el('div', { class: 'spacer' }),
    el('h1', { text: 'Before you play' }),
    policyLink,
    el('div', { class: 'card stack loose', style: { width: '100%', maxWidth: '360px' } },
      agreeRow, shareRow),
    el('div', { style: { width: '100%', maxWidth: '340px', marginTop: '6px' } }, continueButton),
    el('div', { class: 'spacer' }));
}

/**
 * The scrollable policy document, instrumented for dwell time and maximum
 * scroll depth.
 */
function presentPolicy() {
  const openedAt = Date.now();
  let maxScrollFraction = 0;

  const body = el('div', { class: 'sheet-body' },
    el('div', { class: 'stack' },
      el('h3', { text: 'Snake Squad Privacy Policy', style: { fontSize: '20px' } }),
      el('div', { class: 'caption', text: 'Last updated: July 2026' }),
      ...privacyPolicySections.map((section) => el('div', { class: 'stack tight' },
        el('h3', { text: section.heading }),
        ...section.body.split('\n\n').map((para) => el('p', { text: para }))))));

  const measureScroll = () => {
    const scrollable = body.scrollHeight;
    if (scrollable <= 0) return;
    const fraction = Math.min(1, Math.max(0, (body.scrollTop + body.clientHeight) / scrollable));
    maxScrollFraction = Math.max(maxScrollFraction, fraction);
  };
  body.addEventListener('scroll', measureScroll, { passive: true });

  eventLog.log('policy_opened');

  presentSheet(
    (dismiss) => sheetFrame('Privacy Policy', dismiss, body),
    () => {
      eventLog.log('policy_closed', {
        dwell_s: Math.round((Date.now() - openedAt) / 100) / 10,
        max_scroll_pct: Math.round(maxScrollFraction * 100),
      });
    }
  );

  // The visible fraction on open counts even if the participant never scrolls.
  requestAnimationFrame(measureScroll);
}
