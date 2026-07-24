// Level shell: HUD, intro/end overlays, swipe input and instrumentation —
// port of GameContainerView.swift.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { SquadIdentity } from '../state.js';
import { el, button, clear } from '../dom.js';
import { GameEngine, END_REASON } from './engine.js';
import { levelConfig } from './models.js';

const ACCENTS = ['#2CCCD3', '#D2A3D5']; // teal, lavender — matches the bot snakes

export function gameScreen(level) {
  const config = levelConfig(level);
  let attempt = 1;
  let engine = null;
  let startedAt = null;

  const node = el('div', { class: 'screen' });

  // HUD ------------------------------------------------------------------
  const timeValue = el('span', { text: formatTime(config.timeLimit) });
  const timeGroup = el('span', { class: 'group' }, el('span', { class: 'caption', text: 'TIME' }), timeValue);
  const foodValue = el('span', { text: `0/${config.quota}` });
  const scoreValue = el('span', { class: 'score', text: '0 pts' });

  node.append(el('div', { class: 'hud' },
    el('span', { class: 'pill', text: `LV ${level}` }),
    timeGroup,
    el('span', { class: 'group' }, el('span', { class: 'dot' }), foodValue),
    scoreValue));

  // Board ----------------------------------------------------------------
  const canvas = el('canvas');
  const flash = el('div', { class: 'crash-flash' });
  const overlayHost = el('div');
  const board = el('div', { class: 'board-wrap' }, canvas, flash, overlayHost);
  node.append(board);

  // Wiring ---------------------------------------------------------------

  function onHUD(hud) {
    timeValue.textContent = formatTime(hud.remaining);
    timeGroup.classList.toggle('urgent', hud.remaining <= 10);
    foodValue.textContent = `${hud.teamFood}/${hud.quota}`;
    scoreValue.textContent = `${hud.score} pts`;
  }

  function onEnd(result) {
    const duration = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    eventLog.log('level_end', {
      level,
      attempt,
      outcome: result.won ? 'win' : 'fail',
      reason: result.reason,
      detail: result.detail,
      duration_s: Math.round(duration * 10) / 10,
      team_food: result.teamFood,
      player_food: result.playerFood,
      score_total: result.total,
      team_bonus: result.teamBonus,
    });
    showEndCard(result);
  }

  function onCrash() {
    flash.classList.remove('on');
    void flash.offsetWidth; // restart the animation
    flash.classList.add('on');
  }

  function buildEngine() {
    if (engine) engine.destroy();
    engine = new GameEngine(config, canvas, { onHUD, onEnd, onCrash });
    onHUD({ remaining: config.timeLimit, teamFood: 0, quota: config.quota, score: 0 });
  }

  // Overlays -------------------------------------------------------------

  function showIntroCard() {
    clear(overlayHost);
    const card = el('div', { class: 'card stack' });

    card.append(el('h1', { text: `Level ${level}` }));
    card.append(el('p', { class: 'white', text: `Collect ${config.quota} food in ${config.timeLimit} seconds` }));

    if (level === 1) {
      card.append(el('div', { class: 'stack tight', style: { textAlign: 'left' } },
        el('p', { class: 'white', text: '· Swipe to steer your snake' }),
        el('p', { class: 'white', text: '· Eat the red food to grow and score' }),
        el('p', { class: 'white', text: "· Don't hit the walls — or yourself!" })));
    }

    if (config.coop) {
      const squad = el('p', { class: 'muted' }, 'Your squad: ');
      SquadIdentity.botNames(config.botCount).forEach((name, index) => {
        if (index > 0) squad.append(' & ');
        squad.append(el('strong', { text: name, style: { color: ACCENTS[index % ACCENTS.length] } }));
      });
      card.append(squad);

      if (level === 4) {
        const newMate = SquadIdentity.botNames(2)[1];
        if (newMate) {
          card.append(el('p', {
            text: `${newMate} just joined your squad!`,
            style: { color: ACCENTS[1], fontWeight: '700' },
          }));
        }
      }

      card.append(el('p', {
        class: 'white',
        text: 'You share one food goal. If anyone crashes, the whole squad loses — clear the level together for a +50% team bonus!',
      }));
    }

    if (attempt > 1) card.append(el('p', { class: 'caption', text: `Attempt ${attempt}` }));

    card.append(button(attempt > 1 ? 'Try again' : 'Start', 'primary', startLevel));
    overlayHost.append(el('div', { class: 'overlay' }, card));
  }

  function showEndCard(result) {
    clear(overlayHost);
    const card = el('div', { class: 'card stack' });

    if (result.won) {
      card.append(el('h2', { text: `Level ${level} cleared!` }));
      const rows = el('div', { class: 'stack tight' },
        scoreRow(`Food eaten (${result.playerFood})`, result.baseScore),
        scoreRow('Time bonus', result.timeBonus));
      if (config.coop) rows.append(scoreRow('Team bonus (+50%)', result.teamBonus));
      rows.append(el('div', { class: 'rule' }), scoreRow('Total', result.total, true));
      card.append(rows);

      card.append(button('Continue', 'primary', () => {
        app.addScore(result.total);
        app.advance();
      }));
    } else {
      const title = result.reason === END_REASON.timeUp
        ? "Time's up!"
        : (config.coop ? 'Squad wiped!' : 'Crashed!');
      card.append(el('h2', { text: title, style: { color: 'var(--red)' } }));
      if (result.reason === END_REASON.collision) card.append(el('p', { text: result.detail }));
      card.append(el('p', { class: 'white', text: `Food collected: ${result.teamFood}/${config.quota}` }));
      card.append(button('Retry level', 'primary', retryLevel));
    }

    overlayHost.append(el('div', { class: 'overlay' }, card));
  }

  function scoreRow(label, value, bold = false) {
    return el('div', { class: `score-row${bold ? ' total' : ''}` },
      el('span', { text: label }), el('span', { text: String(value) }));
  }

  // Flow -----------------------------------------------------------------

  function startLevel() {
    clear(overlayHost);
    startedAt = Date.now();
    eventLog.log('level_start', { level, attempt });
    engine.start();
  }

  function retryLevel() {
    attempt += 1;
    buildEngine();
    showIntroCard();
  }

  // Input ----------------------------------------------------------------
  // Same thresholds as the SwiftUI DragGesture: 12px minimum, 20px on the
  // dominant axis, one direction change per gesture.

  let startPoint = null;
  let swipeHandled = false;

  board.addEventListener('pointerdown', (event) => {
    startPoint = { x: event.clientX, y: event.clientY };
    swipeHandled = false;
  });

  board.addEventListener('pointermove', (event) => {
    if (!startPoint || swipeHandled) return;
    const dx = event.clientX - startPoint.x;
    const dy = event.clientY - startPoint.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) <= 20) return;

    // Screen y grows downward; the grid's y grows upward.
    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    engine.setPlayerDirection(direction);
    swipeHandled = true;
  });

  const endGesture = () => { startPoint = null; swipeHandled = false; };
  board.addEventListener('pointerup', endGesture);
  board.addEventListener('pointercancel', endGesture);

  // Arrow keys: desktop QA only — participants play on a phone.
  const onKey = (event) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    const direction = map[event.key];
    if (!direction) return;
    event.preventDefault();
    engine.setPlayerDirection(direction);
  };
  window.addEventListener('keydown', onKey);

  // The canvas has no size until the router appends this node, which happens
  // immediately after we return. A timeout (not requestAnimationFrame) so the
  // level still builds if the app is backgrounded at this moment.
  setTimeout(() => {
    buildEngine();
    showIntroCard();
  }, 0);

  node._cleanup = () => {
    window.removeEventListener('keydown', onKey);
    if (engine) engine.destroy();
  };

  return node;
}

function formatTime(seconds) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
