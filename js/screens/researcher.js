// Passcode-gated researcher screen — port of ResearcherView.swift.
//
// Export the event log as CSV (or raw JSON) through the system share sheet, or
// wipe the device for the next participant. Reached by triple-tapping the
// top-right corner of any screen, or the version footer on the title screen.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, presentSheet, sheetFrame, clear, confirmDialog } from '../dom.js';

/** Change before running sessions. */
const PASSCODE = '2468';

/** Only one panel at a time, however many taps land. */
let panelOpen = false;

export function presentResearcher() {
  if (panelOpen) return;
  panelOpen = true;

  presentSheet(
    (dismiss) => {
      const body = el('div', { class: 'sheet-body' });
      renderGate(body, dismiss);
      return sheetFrame('Researcher', dismiss, body, 'Close');
    },
    () => { panelOpen = false; }
  );
}

function renderGate(host, dismiss) {
  const field = el('input', {
    type: 'password',
    class: 'on-navy',
    placeholder: 'Passcode',
    inputmode: 'numeric',
  });
  const error = el('div', { class: 'error', text: '', style: { display: 'none' } });

  const unlock = () => {
    if (field.value === PASSCODE) {
      renderPanel(host, dismiss);
    } else {
      error.textContent = 'Incorrect passcode';
      error.style.display = 'block';
      field.value = '';
    }
  };

  field.addEventListener('keydown', (event) => { if (event.key === 'Enter') unlock(); });

  clear(host);
  host.append(el('div', { class: 'stack' }, field, error, button('Unlock', 'primary', unlock)));
  requestAnimationFrame(() => field.focus());
}

function renderPanel(host, dismiss) {
  const status = el('div', { class: 'caption', text: '' });

  const infoRow = (label, value) => el('div', { class: 'score-row' },
    el('span', { text: label }),
    el('span', { class: 'white', text: value }));

  const exportButton = button('Export CSV', 'primary', async () => {
    status.textContent = await deliver(eventLog.exportName('csv'), eventLog.toCSV(), 'text/csv');
  });

  const jsonButton = button('Export raw JSON (backup)', 'link', async () => {
    status.textContent = await deliver(eventLog.exportName('json'), eventLog.toJSON(), 'application/json');
  });

  const copyButton = button('Copy CSV to clipboard', 'link', async () => {
    try {
      await navigator.clipboard.writeText(eventLog.toCSV());
      status.textContent = 'CSV copied to the clipboard.';
    } catch {
      status.textContent = 'Clipboard blocked — use Export CSV instead.';
    }
  });

  const resetButton = button('Reset for next participant', 'destructive', async () => {
    const ok = await confirmDialog({
      title: 'Reset device?',
      message: 'This deletes the event log and all progress. Export first if you need the data.',
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    app.resetForNextParticipant();
    dismiss();
  });

  clear(host);
  host.append(el('div', { class: 'stack' },
    infoRow('Participant', eventLog.participantCode || '—'),
    infoRow('Events logged', String(eventLog.events.length)),
    infoRow('Current stage', app.stage),
    exportButton,
    jsonButton,
    copyButton,
    status,
    resetButton));
}

/**
 * Hands the file to the system share sheet (AirDrop / Files / Mail on iOS),
 * falling back to a plain download where Web Share can't take files.
 */
async function deliver(filename, text, mime) {
  const file = new File([text], filename, { type: mime });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return `Shared ${filename}.`;
    } catch (err) {
      if (err && err.name === 'AbortError') return 'Share cancelled.';
      // Anything else: fall through to the download path.
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = el('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return `Downloaded ${filename}.`;
}
