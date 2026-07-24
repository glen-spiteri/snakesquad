// Headless harness for the ported game engine. Shims just enough browser API
// to import the real modules, then drives the tick loop on a manual clock.

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const noop = () => {};
globalThis.window = {
  devicePixelRatio: 2,
  addEventListener: noop,
  removeEventListener: noop,
  requestAnimationFrame: noop,
  cancelAnimationFrame: noop,
};
globalThis.requestAnimationFrame = noop;
globalThis.cancelAnimationFrame = noop;

function fakeCanvas() {
  const ctx = new Proxy({}, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return () => {};
    },
    set: (target, prop, value) => { target[prop] = value; return true; },
  });
  return { clientWidth: 402, clientHeight: 760, width: 0, height: 0, getContext: () => ctx };
}

const { GameEngine, END_REASON } = await import('../js/game/engine.js');
const { levelConfig, key, COLS, ROWS } = await import('../js/game/models.js');

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

function make(level) {
  const config = levelConfig(level);
  let result = null;
  const engine = new GameEngine(config, fakeCanvas(), { onEnd: (r) => { result = r; } });
  engine.running = true;                    // start() would need rAF
  return { engine, config, get result() { return result; } };
}

// --- 1. Walking into the top wall ends the level as a collision -------------
{
  const t = make(1);
  // Player spawns at (7,4) heading up; 17 ticks reaches y=21, outside the grid.
  for (let i = 0; i < 25 && !t.engine.ended; i += 1) t.engine.tick();
  await new Promise((r) => setTimeout(r, 500));   // flashAndEnd delivers after 430ms
  check('wall crash ends the level', t.engine.ended, true);
  check('wall crash reason', t.result.reason, END_REASON.collision);
  check('wall crash detail', t.result.detail, 'Glen-less player hit the wall'.replace('Glen-less player', 'You'));
  check('wall crash is a loss', t.result.won, false);
}

// --- 2. Eating food grows the snake and scores -----------------------------
{
  const t = make(1);
  const head = t.engine.player.head;
  t.engine.food.clear();
  t.engine.food.add(key(head.x, head.y + 1));     // directly ahead
  const lengthBefore = t.engine.player.body.length;
  t.engine.tick();
  check('food eaten counter', t.engine.player.foodEaten, 1);
  check('team food counter', t.engine.teamFood, 1);
  // Matches GameScene.swift: the tail is dropped before pendingGrowth is
  // incremented, so the extra segment appears on the following tick.
  check('length unchanged on the eating tick', t.engine.player.body.length, lengthBefore);
  check('board refilled to foodOnBoard', t.engine.food.size, t.config.foodOnBoard);
  t.engine.food.clear();
  t.engine.tick();
  check('snake is one longer next tick', t.engine.player.body.length, lengthBefore + 1);
}

// --- 3. Meeting the quota wins, with the time and team bonuses -------------
{
  const t = make(2);                              // co-op: team bonus applies
  t.engine.remaining = 30;
  t.engine.teamFood = t.config.quota - 1;
  t.engine.player.foodEaten = 5;                  // the winning tick makes it 6
  const head = t.engine.player.head;
  t.engine.food.clear();
  t.engine.food.add(key(head.x, head.y + 1));
  t.engine.tick();
  check('quota met wins', t.result.won, true);
  check('quota met reason', t.result.reason, END_REASON.quotaMet);
  check('base score = food * 10', t.result.baseScore, 60);
  check('time bonus = floor(remaining) * 2', t.result.timeBonus, 60);
  check('team bonus = +50%', t.result.teamBonus, 60);
  check('total', t.result.total, 180);
}

// --- 4. Solo levels get no team bonus --------------------------------------
{
  const t = make(1);
  t.engine.remaining = 10;
  t.engine.teamFood = t.config.quota - 1;
  t.engine.player.foodEaten = 3;                  // the winning tick makes it 4
  const head = t.engine.player.head;
  t.engine.food.clear();
  t.engine.food.add(key(head.x, head.y + 1));
  t.engine.tick();
  check('solo level has no team bonus', t.result.teamBonus, 0);
  check('solo total = base + time bonus', t.result.total, 40 + 20);
}

// --- 5. Running out of time fails the level --------------------------------
{
  const t = make(1);
  t.engine.remaining = 0.05;
  t.engine.lastUpdate = 0;
  t.engine.update(1);                             // dt clamps to 0.1
  check('time up ends the level', t.engine.ended, true);
  check('time up reason', t.result.reason, END_REASON.timeUp);
  check('time up is a loss', t.result.won, false);
}

// --- 6. The dt clamp protects a backgrounded level -------------------------
{
  const t = make(1);
  t.engine.lastUpdate = 0;
  t.engine.update(120);                           // 2 minutes of "backgrounded"
  check('backgrounded level does not time out', t.engine.ended, false);
  check('clamped countdown loses only 0.1s', Math.round(t.engine.remaining * 10) / 10, 59.9);
}

// --- 7. Bots survive long co-op runs without wiping the squad ---------------
// The player is put under the same AI so the run tests collision avoidance
// rather than an unsteered snake driving into a wall.
{
  for (const level of [2, 3, 4, 5]) {
    const config = levelConfig(level);
    const maxTicks = Math.floor(config.timeLimit / config.tickInterval);
    const outcomes = { won: 0, timeUp: 0, botWipe: 0, playerWipe: 0 };
    const trials = 30;

    for (let trial = 0; trial < trials; trial += 1) {
      const t = make(level);
      if (level === 5 && trial === 0) {
        check('level 5 has two bots', t.engine.snakes.filter((s) => s.isBot).length, 2);
      }
      const botNames = t.engine.snakes.filter((s) => s.isBot).map((s) => s.name);
      t.engine.snakes.forEach((s) => { s.isBot = true; });

      let ticks = 0;
      while (!t.engine.ended && ticks < maxTicks) { t.engine.tick(); ticks += 1; }
      if (!t.engine.ended) { outcomes.timeUp += 1; continue; }
      await new Promise((r) => setTimeout(r, 450));  // flashAndEnd delivers after 430ms
      const detail = t.result?.detail ?? '';
      if (t.result?.won) outcomes.won += 1;
      else if (botNames.some((n) => detail.startsWith(n))) outcomes.botWipe += 1;
      else outcomes.playerWipe += 1;
    }

    const pct = (n) => `${Math.round((n / trials) * 100)}%`;
    console.log(`      L${level}: won ${pct(outcomes.won)}, time-up ${pct(outcomes.timeUp)}, `
      + `bot-caused wipe ${pct(outcomes.botWipe)}, player-caused wipe ${pct(outcomes.playerWipe)}`);
    // SPEC §5.3 wants bots to "rarely crash". L2/L3 clear that easily; L4/L5
    // sit high enough to be worth a tuning decision (see the note to Glen).
    // This bound just catches a regression, it is not the design target.
    check(`L${level}: bot-caused wipes stay under 40%`,
      outcomes.botWipe / trials < 0.40, true);
  }
}

// --- 8. Food never spawns on an obstacle, a snake, or the moving bar --------
{
  const t = make(5);
  const bodies = new Set(t.engine.snakes.flatMap((s) => s.body.map((p) => key(p.x, p.y))));
  const bar = new Set(t.engine.movingBar.map((p) => key(p.x, p.y)));
  for (let i = 0; i < 200; i += 1) t.engine.spawnFood();
  const clashes = [...t.engine.food].filter((f) => bodies.has(f) || t.engine.obstacles.has(f) || bar.has(f));
  check('food never spawns on an occupied cell', clashes, []);
  const outOfRange = [...t.engine.food].filter((f) => f < 0 || f >= COLS * ROWS);
  check('food always on the grid', outOfRange, []);
}

console.log(failures === 0 ? '\nAll engine checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
