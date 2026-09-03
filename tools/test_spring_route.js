/**
 * Plays the spring puzzle in "2-2: Diken Tavan" with the real engine: the
 * spring under the gap in the ceiling has to throw Mario onto the roof, and
 * every other spring has to throw him into the hanging spikes.
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
global.location = { search: '?skipintro&level=5' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, restartLevel, player, keys, TILE, T, tileAt, LEVELS,
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

assert.strictEqual(game.LEVELS[game.levelIdx].name, '2-2: Diken Tavan');

const ROOF_ROW = 6;
const springs = [];
for (let tx = 0; tx < 100; tx++) {
  if (game.tileAt(tx, 13) === game.T.SPRING) springs.push(tx);
}
assert.ok(springs.length > 1, 'level should have several springs');

const safe = springs.filter((tx) => game.tileAt(tx, ROOF_ROW) === game.T.EMPTY);
assert.strictEqual(safe.length, 1, 'exactly one spring should sit under the gap');

function bounce(tx) {
  game.restartLevel();
  game.player.x = tx * game.TILE;
  game.player.y = 13 * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;
  game.keys['ArrowRight'] = true;
  let peak = game.player.y;
  for (let f = 0; f < 120 && !game.player.dead; f++) {
    game.gameLoop();
    peak = Math.min(peak, game.player.y);
  }
  game.keys['ArrowRight'] = false;
  return { peak, dead: game.player.dead, landedRow: Math.round((game.player.y + game.player.h) / game.TILE) };
}

const good = bounce(safe[0]);
console.log(`safe spring at col ${safe[0]}: peak row ${(good.peak / game.TILE).toFixed(1)}, landed row ${good.landedRow}, dead ${good.dead}`);
assert.ok(!good.dead, 'the spring under the gap should not be fatal');
assert.strictEqual(good.landedRow, ROOF_ROW, 'the safe spring should land Mario on the roof');

for (const tx of springs.filter((c) => c !== safe[0])) {
  const trap = bounce(tx);
  assert.ok(trap.dead, `spring at col ${tx} should fire Mario into the ceiling spikes`);
}

console.log(`spring route OK: 1 way up, ${springs.length - 1} traps`);
