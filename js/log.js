// Append-only participant event log — port of EventLog.swift.
//
// Everything stays on this device. The app makes no network requests of any
// kind; the only way data leaves the phone is the researcher export sheet.
// Payload values are plain JSON: string, number, boolean, null, or an array
// of those (JSONValue in the Swift original).

export const APP_VERSION = '0.2.0-web';

const KEY_EVENTS = 'snakesquad.events';
const KEY_PARTICIPANT = 'snakesquad.participant';
const KEY_DEVICE = 'snakesquad.deviceUUID';
const KEY_SALT = 'snakesquad.hashSalt';

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return URL.createObjectURL(new Blob()).slice(-36);
}

function persistedId(key) {
  let value = localStorage.getItem(key);
  if (!value) {
    value = uuid();
    localStorage.setItem(key, value);
  }
  return value;
}

class EventLog {
  constructor() {
    this.events = [];
    this.load();
  }

  get participantCode() {
    return localStorage.getItem(KEY_PARTICIPANT) || '';
  }

  set participantCode(value) {
    localStorage.setItem(KEY_PARTICIPANT, value);
  }

  get deviceUUID() {
    return persistedId(KEY_DEVICE);
  }

  /**
   * Per-install random salt, so contact-detail hashes can be matched for
   * duplicates within a participant but never reversed or linked across devices.
   */
  get salt() {
    return persistedId(KEY_SALT);
  }

  log(type, data = {}) {
    this.events.push({ t: new Date().toISOString(), type, data });
    this.save();
  }

  /** One-way salted hash of a contact field; raw text is never stored. */
  async hash(value) {
    const normalized = value.trim().toLowerCase();
    const bytes = new TextEncoder().encode(this.salt + normalized);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  payload() {
    return {
      participant: this.participantCode,
      deviceUUID: this.deviceUUID,
      appVersion: APP_VERSION,
      events: this.events,
    };
  }

  toJSON() {
    return JSON.stringify(this.payload(), null, 2);
  }

  /**
   * Wide-format CSV: one row per event, one column per payload key that occurs
   * anywhere in the log. Array values are joined with "; ".
   */
  toCSV() {
    const payloadKeys = [...new Set(this.events.flatMap((e) => Object.keys(e.data)))].sort();
    const header = ['participant', 'device_uuid', 'app_version', 'timestamp', 'event', ...payloadKeys];

    const lines = [header.map(csvEscape).join(',')];
    for (const event of this.events) {
      const row = [this.participantCode, this.deviceUUID, APP_VERSION, event.t, event.type];
      for (const key of payloadKeys) row.push(csvText(event.data[key]));
      lines.push(row.map(csvEscape).join(','));
    }
    return `${lines.join('\n')}\n`;
  }

  /** Filename stem shared by both exports, e.g. SnakeSquad-P-1042-20260723-1412. */
  exportName(ext) {
    const code = this.participantCode || 'unassigned';
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `SnakeSquad-${code}-${stamp}.${ext}`;
  }

  resetAll() {
    this.events = [];
    localStorage.removeItem(KEY_EVENTS);
    localStorage.removeItem(KEY_PARTICIPANT);
    // The salt goes too, so hashes can never be compared across participants.
    localStorage.removeItem(KEY_SALT);
  }

  save() {
    try {
      localStorage.setItem(KEY_EVENTS, JSON.stringify(this.events));
    } catch (err) {
      // Storage full or blocked: keep the in-memory log so the session can
      // still be exported, and record that persistence failed.
      console.error('[SnakeSquad] could not persist event log', err);
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY_EVENTS);
      if (raw) this.events = JSON.parse(raw);
    } catch {
      this.events = [];
    }
  }
}

function csvText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (Array.isArray(item) ? `[${item.map(csvText).join(', ')}]` : csvText(item)))
      .join('; ');
  }
  return String(value);
}

function csvEscape(field) {
  const text = String(field);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export const eventLog = new EventLog();
