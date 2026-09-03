/**
 * Dies on purpose in five different ways and checks the banner names the
 * right one. Falling is usually the last step of a trap, so the game blames
 * the fake stone, the crumbling bridge or the spring instead of the pit.
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
global.location = { search: '?skipintro' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, jumpToLevel, player, keys, TILE, T, tileAt, LEVELS,
  get enemies() { return enemies; }, get banner() { return banner; },
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

const levelOf = (name) => game.LEVELS.findIndex((lv) => lv.name.startsWith(name));

function dieAt(level, { x, y, vy = 0, grounded = false, right = false, keepEnemies = false, frames = 200 }) {
  game.jumpToLevel(levelOf(level));
  if (!keepEnemies) for (const e of game.enemies) e.dead = true;
  game.player.x = x * game.TILE;
  game.player.y = y * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = vy;
  game.player.grounded = grounded;
  game.player.invincible = 0;
  game.keys['ArrowRight'] = right;
  for (let f = 0; f < frames && !game.player.dead; f++) game.gameLoop();
  game.keys['ArrowRight'] = false;
  assert.ok(game.player.dead, `expected to die in ${level}`);
  return game.banner.title;
}

const before = game.lives;

// Landing on the fake stones inside 1-1's marked pit.
assert.strictEqual(dieAt('1-1', { x: 59, y: 12, vy: 2 }), 'SAHTE TAŞ!');

// Walking into the skull block next to them.
assert.strictEqual(dieAt('1-1', { x: 57, y: 12, grounded: true, right: true }), 'KAFATASI!');

// Standing still on a crumbling bridge in 2-3.
assert.strictEqual(dieAt('2-3', { x: 10, y: 12, grounded: true }), 'ÇÖKTÜ!');

// Taking the wrong spring in 2-2, which fires you into the ceiling.
assert.strictEqual(dieAt('2-2', { x: 14, y: 13, grounded: true }), 'UÇTUN!');

// Walking into a goomba instead of onto it.
assert.strictEqual(dieAt('1-1', { x: 18, y: 13, grounded: true, right: true, keepEnemies: true }), 'GOOMBA 1 - SEN 0');

// Dropping off the tower lands you on the bedrock spikes.
assert.strictEqual(dieAt('2-1', { x: 21, y: 13 }), 'ŞİŞ KEBAP!');

// Falling past the end of the world is just falling.
assert.strictEqual(dieAt('2-1', { x: 80, y: 4 }), 'AŞAĞI!');

assert.strictEqual(game.lives, before - 7, 'every death should cost exactly one life');

console.log(`death messages OK: 7 causes named, lives ${before} -> ${game.lives}`);
