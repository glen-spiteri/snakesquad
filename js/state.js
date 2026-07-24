// Participant flow state — port of AppState.swift.

import { eventLog } from './log.js';

/** Linear participant flow. The stage is persisted so an interrupted session resumes. */
export const STAGES = [
  'title',
  'consent',
  'terms',
  'nameEntry',
  'survey',
  'game1',
  'coopIntro',
  'invite',
  'game2',
  'locationAsk',
  'game3',
  'game4',
  'game5',
  'debrief',
  'finished',
];

const KEY_STAGE = 'snakesquad.stage';
const KEY_SCORE = 'snakesquad.totalScore';

class AppState {
  constructor() {
    const raw = Number(localStorage.getItem(KEY_STAGE));
    this.stageIndex = Number.isInteger(raw) && raw >= 0 && raw < STAGES.length ? raw : 0;
    this.totalScore = Number(localStorage.getItem(KEY_SCORE)) || 0;
    this.listeners = [];
    eventLog.log('app_launch', { stage: this.stage });
  }

  get stage() {
    return STAGES[this.stageIndex];
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  setStage(index) {
    this.stageIndex = Math.min(Math.max(index, 0), STAGES.length - 1);
    localStorage.setItem(KEY_STAGE, String(this.stageIndex));
    this.listeners.forEach((fn) => fn(this.stage));
  }

  advance() {
    this.setStage(this.stageIndex + 1);
    eventLog.log('stage_advance', { stage: this.stage });
  }

  addScore(points) {
    this.totalScore += points;
    localStorage.setItem(KEY_SCORE, String(this.totalScore));
  }

  /**
   * Wipes all participant data (event log, participant code, progress).
   * Used by the researcher screen and by the debrief withdraw option.
   */
  resetForNextParticipant() {
    eventLog.resetAll();
    SquadIdentity.reset();
    this.totalScore = 0;
    localStorage.removeItem(KEY_SCORE);
    this.setStage(0);
  }
}

/**
 * The player's entered name and their assigned teammate names. Teammates are
 * drawn once per participant (excluding the player's own name) and persisted,
 * so the squad stays the same people across levels and relaunches.
 */
const KEY_NAME = 'snakesquad.playerName';
const KEY_BOTS = 'snakesquad.botNames';

export const SquadIdentity = {
  namePool: ['George', 'Yi', 'Nancy', 'Vendela', 'Niall', 'Donovan', 'Zsofia'],

  get playerName() {
    return localStorage.getItem(KEY_NAME) || '';
  },

  set playerName(value) {
    localStorage.setItem(KEY_NAME, value);
  },

  /** Both assigned teammate names (first joins at level 2, second at level 4). */
  botNames(count) {
    let chosen;
    try {
      const stored = JSON.parse(localStorage.getItem(KEY_BOTS) || 'null');
      if (Array.isArray(stored) && stored.length === 2) chosen = stored;
    } catch { /* fall through to a fresh draw */ }

    if (!chosen) {
      const player = this.playerName.trim();
      const candidates = this.namePool.filter((n) => !sameName(n, player));
      chosen = shuffled(candidates).slice(0, 2);
      localStorage.setItem(KEY_BOTS, JSON.stringify(chosen));
    }
    return count === undefined ? chosen : chosen.slice(0, Math.max(0, count));
  },

  /**
   * Pairs the player with the friends they invited: teammate names are taken
   * from the invite form (in entry order), topping up from the random pool if
   * fewer than two named friends were entered.
   */
  assignBots(friendNames) {
    const player = this.playerName.trim();
    const chosen = [];

    for (const raw of friendNames) {
      const name = (raw || '').trim();
      if (!name || chosen.length >= 2) continue;
      if (sameName(name, player)) continue;
      if (chosen.some((c) => sameName(c, name))) continue;
      chosen.push(name);
    }

    const pool = shuffled(this.namePool.filter(
      (c) => !sameName(c, player) && !chosen.some((n) => sameName(n, c))
    ));
    chosen.push(...pool.slice(0, 2 - chosen.length));

    localStorage.setItem(KEY_BOTS, JSON.stringify(chosen));
  },

  reset() {
    localStorage.removeItem(KEY_NAME);
    localStorage.removeItem(KEY_BOTS);
  },
};

function sameName(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const app = new AppState();
