// Teammate snake AI — port of BotAI.swift.
//
// Breadth-first search to the nearest unclaimed food, with a small hesitation
// chance so movement reads as human. Bots are tuned to almost never crash — a
// squad wipe caused by a bot is frustrating and would confound engagement.

import { ALL_DIRECTIONS, COLS, ROWS, inBounds, key, offset, opposite } from './models.js';

/**
 * @param {SnakeEntity} snake
 * @param {Set<number>} blocked  cells that must not be entered (packed keys)
 * @param {Set<number>} foods    food cells (packed keys)
 * @param {Set<number>} claimed  food already targeted by another bot this tick
 * @returns {{direction: string, target: number|null}}
 */
export function botStep(snake, blocked, foods, claimed) {
  const head = snake.head;
  const headKey = key(head.x, head.y);

  const preferred = [...foods].filter((f) => !claimed.has(f));
  const targets = new Set(preferred.length ? preferred : foods);

  // BFS from the head over free cells.
  const cameFrom = new Map();
  const visited = new Set([headKey]);
  const queue = [head];
  let queueIndex = 0;
  let goal = null;

  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
    const currentKey = key(current.x, current.y);

    if (currentKey !== headKey && targets.has(currentKey)) {
      goal = currentKey;
      break;
    }

    for (const direction of ALL_DIRECTIONS) {
      const neighbor = offset(current, direction);
      const neighborKey = key(neighbor.x, neighbor.y);
      if (inBounds(neighbor) && !visited.has(neighborKey) && !blocked.has(neighborKey)) {
        visited.add(neighborKey);
        cameFrom.set(neighborKey, currentKey);
        queue.push(neighbor);
      }
    }
  }

  const safeDirections = () => ALL_DIRECTIONS.filter((direction) => {
    if (direction === opposite(snake.direction)) return false;
    const next = offset(head, direction);
    return inBounds(next) && !blocked.has(key(next.x, next.y));
  });

  if (goal !== null) {
    // Walk the path back to the first step off the head.
    let step = goal;
    while (cameFrom.has(step) && cameFrom.get(step) !== headKey) {
      step = cameFrom.get(step);
    }
    const direction = ALL_DIRECTIONS.find((d) => {
      const next = offset(head, d);
      return key(next.x, next.y) === step;
    });

    if (direction && direction !== opposite(snake.direction)) {
      // Occasional hesitation: take a different safe move.
      if (Math.random() < 0.08) {
        const alternatives = safeDirections().filter((d) => d !== direction);
        if (alternatives.length) {
          return { direction: alternatives[Math.floor(Math.random() * alternatives.length)], target: goal };
        }
      }
      return { direction, target: goal };
    }
  }

  // No path to food: keep moving somewhere safe, preferring straight ahead.
  const safe = safeDirections();
  if (safe.includes(snake.direction)) return { direction: snake.direction, target: null };
  if (safe.length) return { direction: safe[Math.floor(Math.random() * safe.length)], target: null };

  // Boxed in; nothing survivable.
  return { direction: snake.direction, target: null };
}

// Re-exported so callers don't need a second import for grid dimensions.
export { COLS, ROWS };
