// Grid, directions and level configuration — port of GameModels.swift.
//
// Grid coordinates keep the SpriteKit convention (y increases toward the top of
// the screen) so the ported simulation logic is unchanged; the canvas renderer
// flips y at draw time.

export const COLS = 15;
export const ROWS = 21;

/** Grid points are packed into a single integer so they can live in a Set. */
export function key(x, y) {
  return y * COLS + x;
}

export const DIRECTIONS = {
  up: { dx: 0, dy: 1, opposite: 'down' },
  down: { dx: 0, dy: -1, opposite: 'up' },
  left: { dx: -1, dy: 0, opposite: 'right' },
  right: { dx: 1, dy: 0, opposite: 'left' },
};

export const ALL_DIRECTIONS = ['up', 'down', 'left', 'right'];

export function offset(point, direction) {
  const d = DIRECTIONS[direction];
  return { x: point.x + d.dx, y: point.y + d.dy };
}

export function opposite(direction) {
  return DIRECTIONS[direction].opposite;
}

export function inBounds(point) {
  return point.x >= 0 && point.x < COLS && point.y >= 0 && point.y < ROWS;
}

export class SnakeEntity {
  constructor({ name, isBot, bodyColor, accentColor, body, direction }) {
    this.name = name;
    this.isBot = isBot;
    this.bodyColor = bodyColor;
    /** Head outline / name-tag color. */
    this.accentColor = accentColor;
    /** Head first. */
    this.body = body;
    this.direction = direction;
    this.pendingGrowth = 0;
    this.foodEaten = 0;
  }

  get head() {
    return this.body[0];
  }
}

/** Two 2x2 blocks flanking the center lane. */
const twinBlocks = [
  { x: 4, y: 9 }, { x: 4, y: 10 },
  { x: 5, y: 9 }, { x: 5, y: 10 },
  { x: 9, y: 9 }, { x: 9, y: 10 },
  { x: 10, y: 9 }, { x: 10, y: 10 },
];

/**
 * Vertical wall segments forming narrow corridors, clear of the moving bar's
 * row (10) and all spawn areas.
 */
const corridors = (() => {
  const points = [];
  for (let y = 4; y <= 7; y += 1) {
    points.push({ x: 5, y }, { x: 9, y });
  }
  for (let y = 13; y <= 16; y += 1) {
    points.push({ x: 5, y }, { x: 9, y });
  }
  return points;
})();

/**
 * quota      — team-wide food target
 * timeLimit  — seconds
 * tickInterval — seconds per movement step
 * botCount   — teammate snakes (max 2, so squads never exceed 3 players)
 * foodOnBoard — food items on the board at once
 */
export function levelConfig(level) {
  switch (level) {
    case 1:
      return {
        level: 1, quota: 8, timeLimit: 60, tickInterval: 0.28,
        botCount: 0, foodOnBoard: 1, obstacles: [], hasMovingObstacle: false, coop: false,
      };
    case 2:
      return {
        level: 2, quota: 14, timeLimit: 75, tickInterval: 0.28,
        botCount: 1, foodOnBoard: 3, obstacles: [], hasMovingObstacle: false, coop: true,
      };
    case 3:
      return {
        level: 3, quota: 18, timeLimit: 75, tickInterval: 0.26,
        botCount: 1, foodOnBoard: 3, obstacles: twinBlocks, hasMovingObstacle: false, coop: true,
      };
    case 4:
      return {
        level: 4, quota: 28, timeLimit: 70, tickInterval: 0.23,
        botCount: 2, foodOnBoard: 3, obstacles: twinBlocks, hasMovingObstacle: false, coop: true,
      };
    default:
      return {
        level: 5, quota: 34, timeLimit: 70, tickInterval: 0.22,
        botCount: 2, foodOnBoard: 4, obstacles: corridors, hasMovingObstacle: true, coop: true,
      };
  }
}
