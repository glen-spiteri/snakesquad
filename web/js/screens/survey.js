// Onboarding "Player Profile" quiz — port of SurveyView.swift.
//
// Collects stated privacy preferences masked among gaming-habit distractors.

import { app } from '../state.js';
import { eventLog } from '../log.js';
import { el, button, screen, clear } from '../dom.js';
import { surveyItems } from '../content/surveyItems.js';

export function surveyScreen() {
  const startedAt = Date.now();
  let index = 0;
  let multiSelection = new Set();

  eventLog.log('survey_started');

  const bar = el('div', { style: { width: '0%' } });
  const questionHost = el('div', {
    class: 'screen scroll',
    style: { paddingTop: '4px' },
  });

  const node = screen('',
    el('div', { class: 'stack tight', style: { padding: '32px 24px 0' } },
      el('h2', { text: 'Player Profile' }),
      el('p', { text: 'A few quick questions to set up your game' }),
      el('div', { class: 'progress', style: { marginTop: '4px' } }, bar)),
    questionHost);

  function record(item, value) {
    eventLog.log('survey_item', { id: item.id, value });
    index += 1;
    if (index >= surveyItems.length) {
      eventLog.log('survey_complete', {
        duration_s: Math.round((Date.now() - startedAt) / 1000),
      });
      app.advance();
      return;
    }
    renderQuestion();
  }

  function renderQuestion() {
    const item = surveyItems[index];
    bar.style.width = `${(index / surveyItems.length) * 100}%`;

    const card = el('div', { class: 'card stack' }, el('h3', { text: item.prompt }));
    const options = el('div', { class: 'stack tight' });
    card.append(options);

    if (item.kind === 'multiChoice') {
      multiSelection = new Set();
      for (const label of item.options) {
        const row = el('button', { class: 'option multi', 'aria-checked': 'false' },
          el('span', { class: 'check-box', style: { width: '20px', height: '20px' } }),
          el('span', { text: label }));
        row.addEventListener('click', () => {
          const selected = multiSelection.has(label);
          if (selected) multiSelection.delete(label);
          else multiSelection.add(label);
          row.setAttribute('aria-checked', String(!selected));
        });
        options.append(row);
      }
      card.append(button('Continue', 'primary', () => {
        // Preserve option order in the logged array; empty = none.
        const chosen = item.options.filter((label) => multiSelection.has(label));
        record(item, chosen);
      }));
    } else {
      item.options.forEach((label, optionIndex) => {
        options.append(el('button', {
          class: 'option',
          text: label,
          on: {
            click: () => record(item, item.kind === 'likert' ? optionIndex + 1 : label),
          },
        }));
      });
    }

    // Rebuilding the host scrolls each new question back to the top.
    clear(questionHost);
    questionHost.scrollTop = 0;
    questionHost.append(card);
  }

  renderQuestion();
  return node;
}
