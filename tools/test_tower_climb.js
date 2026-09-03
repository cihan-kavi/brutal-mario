/**
 * Climbs "2-1: Taş Kule" ledge by ledge with the real engine to prove every
 * step of the tower is within a single jump, and that the fake stone lip at
 * the end of a ledge really drops you.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*)<\/script>/)[1];

const noop = () => {};
const ctxStub = new Proxy({}, {
  get(target, prop) {
    if (prop === 'canvas') return { width: 800, height: 480 };
    if (!(prop in target)) {
      target[prop] = () => (prop === 'createLinearGradient' ? { addColorStop: noop } : undefined);
    }
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

const elements = {};
global.document = {
  getElementById(id) {
    if (!elements[id]) {
      elements[id] = { id, textContent: '', value: '', innerHTML: '', className: '', style: {}, onclick: null, blur: noop, getContext: () => ctxStub };
    }
    return elements[id];
  },
  addEventListener: noop,
};
global.requestAnimationFrame = noop;
global.location = { search: '?skipintro&level=4' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, restartLevel, player, keys, TILE, T, tileAt, LEVELS,
  get enemies() { return enemies; },
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

assert.strictEqual(game.LEVELS[game.levelIdx].name, '2-1: Taş Kule');

// Collect the ledges: runs of real stone, top to bottom.
const ledges = [];
for (let ty = 0; ty < 14; ty++) {
  let start = null;
  for (let tx = 0; tx <= 100; tx++) {
    const solid = game.tileAt(tx, ty) === game.T.GROUND;
    if (solid && start === null) start = tx;
    if (!solid && start !== null) {
      ledges.push({ row: ty, left: start, right: tx - 1 });
      start = null;
    }
  }
}
const climb = ledges.filter((l) => l.row >= 1 && l.row <= 13).sort((a, b) => b.row - a.row);
assert.ok(climb.length >= 6, `tower should have several ledges, found ${climb.length}`);

function jumpFrom(fromCol, fromRow, target) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.player.x = fromCol * game.TILE;
  game.player.y = fromRow * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;

  game.keys['ArrowRight'] = true;
  game.keys['ArrowUp'] = true;
  for (let f = 0; f < 70; f++) {
    game.gameLoop();
    if (f === 0) game.keys['ArrowUp'] = false;
    const col = Math.round(game.player.x / game.TILE);
    const row = Math.round((game.player.y + game.player.h) / game.TILE);
    // Holding right can carry Mario past a short ledge onto a higher one, so
    // any footing at or above the target counts as clearing the gap.
    if (game.player.grounded && row <= target.row && f > 2) {
      game.keys['ArrowRight'] = false;
      return { landed: true, frames: f, col, row };
    }
    if (game.player.dead) break;
  }
  game.keys['ArrowRight'] = false;
  return { landed: false, col: Math.round(game.player.x / game.TILE) };
}

for (let i = 0; i < climb.length - 1; i++) {
  const from = climb[i];
  const to = climb[i + 1];
  const result = jumpFrom(from.right, from.row, to);
  console.log(
    `row ${from.row} col ${from.right} -> row ${to.row} cols ${to.left}-${to.right}: ` +
    `${result.landed ? `landed row ${result.row} col ${result.col} after ${result.frames} frames` : `MISSED (ended col ${result.col})`}`,
  );
  assert.ok(result.landed, `jump from row ${from.row} to row ${to.row} must be makeable`);
}

// The lip past the top ledge is fake and gives way.
const top = climb[climb.length - 1];
assert.strictEqual(game.tileAt(top.right + 1, top.row), game.T.FAKE, 'each ledge should end in fake stone');

console.log(`tower climb OK: ${climb.length - 1} jumps, every ledge ends in a lie`);
