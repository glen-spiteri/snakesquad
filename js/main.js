// Stage router — port of SnakeSquadApp.swift / RootView.

import { app } from './state.js';
import { clear, onTripleTap } from './dom.js';
import { gameScreen } from './game/container.js';
import { titleScreen, finishedScreen } from './screens/title.js';
import { consentScreen } from './screens/consent.js';
import { termsScreen } from './screens/terms.js';
import { nameScreen } from './screens/name.js';
import { surveyScreen } from './screens/survey.js';
import { coopIntroScreen } from './screens/coopIntro.js';
import { inviteScreen } from './screens/invite.js';
import { locationScreen } from './screens/location.js';
import { debriefScreen } from './screens/debrief.js';
import { presentResearcher } from './screens/researcher.js';

const SCREENS = {
  title: titleScreen,
  consent: consentScreen,
  terms: termsScreen,
  nameEntry: nameScreen,
  survey: surveyScreen,
  game1: () => gameScreen(1),
  coopIntro: coopIntroScreen,
  invite: inviteScreen,
  game2: () => gameScreen(2),
  locationAsk: locationScreen,
  game3: () => gameScreen(3),
  game4: () => gameScreen(4),
  game5: () => gameScreen(5),
  debrief: debriefScreen,
  finished: finishedScreen,
};

const root = document.getElementById('root');
let current = null;

function render(stage) {
  if (current && typeof current._cleanup === 'function') current._cleanup();
  clear(root);
  current = SCREENS[stage]();
  root.append(current);
}

app.onChange(render);
render(app.stage);

// Hidden researcher access from any screen: triple-tap the top-right corner
// (passcode-gated). Lets a session be exported or reset mid-flow.
onTripleTap(document.getElementById('researcher-hotspot'), presentResearcher);

// Keeps the screen awake during a level; harmless where unsupported.
if ('wakeLock' in navigator) {
  const requestWakeLock = () => navigator.wakeLock.request('screen').catch(() => {});
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestWakeLock();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
