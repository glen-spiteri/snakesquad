// Snake simulation and canvas renderer — port of GameScene.swift.
//
// The simulation is a line-for-line port: same tick order, same
// tails-vacate-first collision set, same head-on rule, same scoring. Only the
// drawing layer changed (SpriteKit nodes -> canvas 2D), which means the grid
// keeps SpriteKit's y-up convention and `project()` flips it for the canvas.

import { SquadIdentity } from '../state.js';
import { botStep } from './bot.js';
import {
  COLS, ROWS, SnakeEntity, inBounds, key, offset, opposite,
} from './models.js';

const COLORS = {
  navy: '#273B5E',
  navyDark: '#1B2A45',
  blue: '#037DBA',
  gray: '#ACACAC',
  red: '#DC3832',
  teal: '#2CCCD3',
  magenta: '#8F1A95',
  lightCyan: '#80E0E5',
  deepPurple: '#582C83',
  lavender: '#D2A3D5',
  salmon: '#EA8884',
};

export const END_REASON = {
  quotaMet: 'quota_met',
  collision: 'collision',
  timeUp: 'time_up',
};

export class GameEngine {
  /**
   * @param {object} config      from levelConfig()
   * @param {HTMLCanvasElement} canvas
   * @param {{onHUD: Function, onEnd: Function, onCrash: Function}} callbacks
   */
  constructor(config, canvas, callbacks = {}) {
    this.config = config;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHUD = callbacks.onHUD;
    this.onEnd = callbacks.onEnd;
    this.onCrash = callbacks.onCrash;

    this.snakes = [];
    this.food = new Set();
    this.obstacles = new Set();
    this.movingBar = [];
    this.barX = 2;
    this.barStep = 1;
    this.barParity = 0;

    this.teamFood = 0;
    this.remaining = config.timeLimit;
    this.lastUpdate = null;
    this.accumulator = 0;
    this.running = false;
    this.ended = false;
    this.pendingPlayerDirection = null;
    this.lastHUD = null;
    this.frame = null;

    this.cellSize = 0;
    this.boardOrigin = { x: 0, y: 0 };

    this.spawnEntities();
    this.layoutBoard();
    this.draw();
    this.pushHUD();

    this.handleResize = () => {
      this.layoutBoard();
      this.draw();
    };
    window.addEventListener('resize', this.handleResize);
  }

  get player() {
    return this.snakes[0];
  }

  start() {
    if (this.ended) return;
    this.lastUpdate = null;
    this.running = true;
    this.loop();
  }

  /** Stops the render loop and releases listeners; safe to call twice. */
  destroy() {
    this.running = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    window.removeEventListener('resize', this.handleResize);
  }

  setPlayerDirection(direction) {
    if (!this.running || this.ended) return;
    this.pendingPlayerDirection = direction;
  }

  loop() {
    this.frame = requestAnimationFrame((now) => {
      this.update(now / 1000);
      if (this.running && !this.ended) this.loop();
    });
  }

  update(currentTime) {
    if (!this.running || this.ended || !this.snakes.length) {
      this.lastUpdate = currentTime;
      return;
    }
    // Clamped: rAF stops while the app is backgrounded, so the first frame back
    // reports a gap of many seconds. Unclamped that would drain the countdown
    // and fail the level for a participant who took a phone call — clamping
    // makes the level pause and resume instead.
    const elapsed = this.lastUpdate === null ? 0 : currentTime - this.lastUpdate;
    const dt = Math.min(elapsed, 0.1);
    this.lastUpdate = currentTime;

    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.pushHUD();
      this.endGame(false, END_REASON.timeUp, 'time ran out');
      return;
    }

    this.accumulator += dt;
    if (this.accumulator >= this.config.tickInterval) {
      this.accumulator = 0;
      this.tick();
    }
    this.pushHUD();
  }

  // MARK: - Simulation

  tick() {
    if (this.ended) return;

    if (this.pendingPlayerDirection
        && this.pendingPlayerDirection !== opposite(this.player.direction)) {
      this.player.direction = this.pendingPlayerDirection;
    }
    this.pendingPlayerDirection = null;

    if (this.config.hasMovingObstacle) this.advanceBar();

    this.chooseBotDirections();

    const newHeads = this.snakes.map((s) => offset(s.head, s.direction));

    // Cells occupied after tails vacate this tick.
    const occupied = new Set();
    for (const snake of this.snakes) {
      for (const segment of snake.body) occupied.add(key(segment.x, segment.y));
    }
    for (const snake of this.snakes) {
      if (snake.pendingGrowth === 0 && snake.body.length) {
        const tail = snake.body[snake.body.length - 1];
        occupied.delete(key(tail.x, tail.y));
      }
    }

    const barKeys = new Set(this.movingBar.map((p) => key(p.x, p.y)));

    for (let index = 0; index < newHeads.length; index += 1) {
      const head = newHeads[index];
      const snake = this.snakes[index];
      const headKey = key(head.x, head.y);
      let crash = null;

      if (!inBounds(head)) crash = 'hit the wall';
      else if (this.obstacles.has(headKey) || barKeys.has(headKey)) crash = 'hit an obstacle';
      else if (occupied.has(headKey)) crash = 'hit a snake';
      else if (newHeads.filter((h) => h.x === head.x && h.y === head.y).length > 1) crash = 'collided head-on';

      if (crash) {
        this.flashAndEnd(`${snake.name} ${crash}`);
        return;
      }
    }

    for (let index = 0; index < this.snakes.length; index += 1) {
      const snake = this.snakes[index];
      const head = newHeads[index];
      snake.body.unshift(head);
      if (snake.pendingGrowth > 0) snake.pendingGrowth -= 1;
      else snake.body.pop();

      const headKey = key(head.x, head.y);
      if (this.food.has(headKey)) {
        this.food.delete(headKey);
        snake.pendingGrowth += 1;
        snake.foodEaten += 1;
        this.teamFood += 1;
        this.spawnFood();
      }
    }

    this.draw();

    if (this.teamFood >= this.config.quota) {
      this.endGame(true, END_REASON.quotaMet, 'quota met');
    }
  }

  chooseBotDirections() {
    const allBodies = new Set();
    for (const snake of this.snakes) {
      for (const segment of snake.body) allBodies.add(key(segment.x, segment.y));
    }

    const claimed = new Set();
    for (const snake of this.snakes) {
      if (!snake.isBot) continue;

      const blocked = new Set([...this.obstacles, ...allBodies]);
      for (const point of this.movingBar) blocked.add(key(point.x, point.y));
      // Avoid cells other snakes are about to enter.
      for (const other of this.snakes) {
        if (other === snake) continue;
        const next = offset(other.head, other.direction);
        blocked.add(key(next.x, next.y));
      }

      const move = botStep(snake, blocked, this.food, claimed);
      snake.direction = move.direction;
      if (move.target !== null) claimed.add(move.target);
    }
  }

  advanceBar() {
    this.barParity += 1;
    if (this.barParity % 2 !== 0) return;
    this.barX += this.barStep;
    if (this.barX <= 1 || this.barX + 2 >= COLS - 1) this.barStep = -this.barStep;
    this.movingBar = [
      { x: this.barX, y: 10 },
      { x: this.barX + 1, y: 10 },
      { x: this.barX + 2, y: 10 },
    ];
  }

  spawnEntities() {
    this.obstacles = new Set(this.config.obstacles.map((p) => key(p.x, p.y)));
    this.obstaclePoints = this.config.obstacles;

    const playerName = SquadIdentity.playerName || 'You';
    this.snakes = [new SnakeEntity({
      name: playerName,
      isBot: false,
      bodyColor: COLORS.blue,
      accentColor: '#FFFFFF',
      body: [{ x: 7, y: 4 }, { x: 7, y: 3 }, { x: 7, y: 2 }],
      direction: 'up',
    })];

    const botSpecs = [
      { x: 2, body: COLORS.teal, accent: COLORS.lightCyan },
      { x: 12, body: COLORS.magenta, accent: COLORS.lavender },
    ];
    const botNames = SquadIdentity.botNames();
    const botCount = Math.min(this.config.botCount, botSpecs.length, botNames.length);
    for (let index = 0; index < botCount; index += 1) {
      const spec = botSpecs[index];
      this.snakes.push(new SnakeEntity({
        name: botNames[index],
        isBot: true,
        bodyColor: spec.body,
        accentColor: spec.accent,
        body: [{ x: spec.x, y: 17 }, { x: spec.x, y: 18 }, { x: spec.x, y: 19 }],
        direction: 'down',
      }));
    }

    if (this.config.hasMovingObstacle) {
      this.movingBar = [
        { x: this.barX, y: 10 },
        { x: this.barX + 1, y: 10 },
        { x: this.barX + 2, y: 10 },
      ];
    }

    for (let i = 0; i < this.config.foodOnBoard; i += 1) this.spawnFood();
  }

  spawnFood() {
    const occupied = new Set();
    for (const snake of this.snakes) {
      for (const segment of snake.body) occupied.add(key(segment.x, segment.y));
    }
    const barKeys = new Set(this.movingBar.map((p) => key(p.x, p.y)));

    for (let attempt = 0; attempt < 300; attempt += 1) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * ROWS);
      const candidate = key(x, y);
      if (!occupied.has(candidate) && !this.obstacles.has(candidate)
          && !this.food.has(candidate) && !barKeys.has(candidate)) {
        this.food.add(candidate);
        return;
      }
    }
  }

  // MARK: - Ending

  flashAndEnd(detail) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    const result = this.makeResult(false, END_REASON.collision, detail);
    if (this.onCrash) this.onCrash();
    // Matches the SpriteKit flash: 0.12s in, 0.30s out, then deliver.
    setTimeout(() => this.deliver(result), 430);
  }

  endGame(won, reason, detail) {
    if (this.ended) return;
    this.ended = true;
    this.running = false;
    this.deliver(this.makeResult(won, reason, detail));
  }

  makeResult(won, reason, detail) {
    const baseScore = this.player.foodEaten * 10;
    const timeBonus = won ? Math.floor(this.remaining) * 2 : 0;
    const teamBonus = (won && this.config.coop) ? Math.floor((baseScore + timeBonus) / 2) : 0;
    return {
      won,
      reason,
      detail,
      playerFood: this.player.foodEaten,
      teamFood: this.teamFood,
      baseScore,
      timeBonus,
      teamBonus,
      total: baseScore + timeBonus + teamBonus,
    };
  }

  deliver(result) {
    if (this.onEnd) this.onEnd(result);
  }

  pushHUD() {
    const hud = {
      remaining: Math.ceil(this.remaining),
      teamFood: this.teamFood,
      quota: this.config.quota,
      score: this.snakes.length ? this.player.foodEaten * 10 : 0,
    };
    const last = this.lastHUD;
    if (last && last.remaining === hud.remaining && last.teamFood === hud.teamFood
        && last.quota === hud.quota && last.score === hud.score) return;
    this.lastHUD = hud;
    if (this.onHUD) this.onHUD(hud);
  }

  // MARK: - Drawing

  layoutBoard() {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.viewWidth = width;
    this.viewHeight = height;
    this.cellSize = Math.floor(Math.min(width / COLS, height / ROWS));
    this.boardOrigin = {
      x: (width - this.cellSize * COLS) / 2,
      y: (height - this.cellSize * ROWS) / 2,
    };
  }

  /** Grid point -> canvas center point (y flipped: grid y is up, canvas y is down). */
  project(point) {
    return {
      x: this.boardOrigin.x + (point.x + 0.5) * this.cellSize,
      y: this.boardOrigin.y + (ROWS - point.y - 0.5) * this.cellSize,
    };
  }

  cell(point, color, scale = 0.9) {
    const side = this.cellSize * scale;
    const { x, y } = this.project(point);
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x - side / 2, y - side / 2, side, side, side * 0.28);
    ctx.fill();
    return { x, y, side };
  }

  draw() {
    const ctx = this.ctx;
    if (!this.cellSize) this.layoutBoard();
    if (!this.cellSize) return;

    const boardWidth = this.cellSize * COLS;
    const boardHeight = this.cellSize * ROWS;

    ctx.fillStyle = COLORS.navyDark;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    ctx.fillStyle = COLORS.navy;
    ctx.fillRect(this.boardOrigin.x, this.boardOrigin.y, boardWidth, boardHeight);

    ctx.strokeStyle = COLORS.gray;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.boardOrigin.x + 1, this.boardOrigin.y + 1, boardWidth - 2, boardHeight - 2);

    for (const point of this.obstaclePoints) this.cell(point, COLORS.deepPurple, 0.95);
    for (const point of this.movingBar) this.cell(point, COLORS.salmon, 0.95);

    for (const foodKey of this.food) {
      const point = { x: foodKey % COLS, y: Math.floor(foodKey / COLS) };
      const { x, y } = this.project(point);
      ctx.fillStyle = COLORS.red;
      ctx.beginPath();
      ctx.arc(x, y, this.cellSize * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = `bold ${Math.max(10, Math.round(this.cellSize * 0.52))}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    for (const snake of this.snakes) {
      snake.body.forEach((segment, index) => {
        const drawn = this.cell(segment, snake.bodyColor);
        if (index === 0) {
          ctx.strokeStyle = snake.accentColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(
            drawn.x - drawn.side / 2, drawn.y - drawn.side / 2,
            drawn.side, drawn.side, drawn.side * 0.28
          );
          ctx.stroke();
        }
      });

      const head = this.project(snake.head);
      ctx.fillStyle = snake.accentColor;
      ctx.fillText(snake.name, head.x, head.y - this.cellSize * 0.7);
    }
  }
}
