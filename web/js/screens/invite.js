// Disclosure 2: the invite-friends screen shown at the Level 2 co-op unlock —
// port of InviteFriendsView.swift.
//
// Measurement only — no invitations are ever sent and no network requests are
// made. Email addresses and phone numbers are NOT stored: only per-field
// completion flags, syntactic validity, and salted one-way hashes (for
// duplicate detection) are logged. Entered friend NAMES are retained for one
// purpose: the bot teammates are named after the invited friends so the player
// is "paired" with who they invited (the debrief discloses this). Play
// continues identically whether the player invites or skips.

import { app, SquadIdentity } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, clear } from '../dom.js';

const MAX_FRIENDS = 5;

export function inviteScreen() {
  const shownAt = Date.now();
  const entries = [makeEntry()];
  const node = screen('scroll');

  eventLog.log('contacts_prompt_shown');

  function makeEntry() {
    return { name: '', email: '', phone: '' };
  }

  function isEmpty(entry) {
    return !entry.name.trim() && !entry.email.trim() && !entry.phone.trim();
  }

  function hasAnyInput() {
    return entries.some((entry) => !isEmpty(entry));
  }

  function renderForm() {
    clear(node);
    node.scrollTop = 0;

    const stack = el('div', { class: 'stack' },
      el('h2', { text: 'Snake Squad is better with friends!' }),
      el('p', { text: 'Invite friends so we can match you into a squad and let them know when you’re playing.' }));

    const submitButton = button('Invite friends', 'primary', submit, { disabled: !hasAnyInput() });
    const refreshSubmit = () => { submitButton.disabled = !hasAnyInput(); };

    entries.forEach((entry) => {
      stack.append(el('div', { class: 'card stack tight' },
        field('Name', 'text', entry, 'name', refreshSubmit, { autocapitalize: 'words' }),
        field('Email address', 'email', entry, 'email', refreshSubmit, {
          autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
        }),
        field('Phone number', 'tel', entry, 'phone', refreshSubmit)));
    });

    if (entries.length < MAX_FRIENDS) {
      stack.append(el('button', {
        class: 'btn link',
        text: '+  Add another friend',
        style: { textAlign: 'left', fontWeight: '600' },
        on: { click: () => { entries.push(makeEntry()); renderForm(); } },
      }));
    }

    stack.append(submitButton, button('Not now', 'secondary', skip));
    node.append(stack);
  }

  function field(placeholder, type, entry, key, onInput, extra = {}) {
    const input = el('input', { type, placeholder, value: entry[key], ...extra });
    input.addEventListener('input', () => {
      entry[key] = input.value;
      onInput();
    });
    return input;
  }

  // MARK: - Measurement

  async function submit() {
    const filled = entries.filter((entry) => !isEmpty(entry));

    const fields = [];
    const validEmail = [];
    const validPhone = [];
    const hashes = [];

    for (const entry of filled) {
      const name = entry.name.trim();
      const email = entry.email.trim();
      const phone = entry.phone.trim();

      const completed = [];
      const entryHashes = [];

      if (name) { completed.push('name'); entryHashes.push(await eventLog.hash(name)); }
      if (email) { completed.push('email'); entryHashes.push(await eventLog.hash(email)); }
      if (phone) { completed.push('phone'); entryHashes.push(await eventLog.hash(phone)); }

      fields.push(completed);
      hashes.push(entryHashes);
      validEmail.push(email ? isValidEmail(email) : null);
      validPhone.push(phone ? isValidPhone(phone) : null);
    }

    eventLog.log('contacts_prompt', {
      action: 'submitted',
      n_friends: filled.length,
      fields,
      valid_email: validEmail,
      valid_phone: validPhone,
      hashes,
      dwell_s: Math.round((Date.now() - shownAt) / 1000),
    });

    // Pair the player with the friends they just invited.
    SquadIdentity.assignBots(filled.map((entry) => entry.name));
    runMatchingSequence();
  }

  function skip() {
    eventLog.log('contacts_prompt', {
      action: 'skipped',
      dwell_s: Math.round((Date.now() - shownAt) / 1000),
    });
    runMatchingSequence();
  }

  function runMatchingSequence() {
    showMatching('Finding your squad…', true);
    setTimeout(() => {
      const teammate = SquadIdentity.botNames(1)[0] || 'your squad';
      showMatching(`You’ve been matched with\n${teammate}!`, false);
      eventLog.log('squad_matched', { teammates: SquadIdentity.botNames() });
      setTimeout(() => app.advance(), 1500);
    }, 1600);
  }

  function showMatching(message, showSpinner) {
    clear(node);
    node.className = 'screen centered';
    node.append(
      showSpinner ? el('div', { class: 'spinner' }) : el('div', { class: 'tick' }),
      el('h3', {
        text: message,
        style: { fontSize: '20px', marginTop: '20px', whiteSpace: 'pre-line' },
      })
    );
  }

  renderForm();
  return node;
}

function isValidEmail(value) {
  return /^[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
