/**
 * Rides one of the castle's moving stone platforms and asserts the player
 * stays glued to it: no horizontal drift, no lost footing, and the feet track
 * the platform surface instead of jittering around it.
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
      elements[id] = { id, textContent: '', style: {}, onclick: null, getContext: () => ctxStub };
    }
    return elements[id];
  },
  addEventListener: noop,
};
global.requestAnimationFrame = noop;
global.location = { search: '?skipintro&level=7' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, player, TILE, T, keys,
  tileAt, getMovingOffset, LEVELS,
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

// Find the first moving platform and stand on it.
let platform = null;
for (let ty = 0; ty < 14 && !platform; ty++) {
  for (let tx = 0; tx < 100; tx++) {
    if (game.tileAt(tx, ty) === game.T.MOVING) { platform = { tx, ty }; break; }
  }
}
assert.ok(platform, 'level should contain a moving platform');

const platformTop = () =>
  platform.ty * game.TILE + Math.sin(game.getMovingOffset(platform.tx, platform.ty)) * 40;

game.player.x = platform.tx * game.TILE;
game.player.y = platformTop() - game.player.h;
game.player.vy = 0;
game.player.invincible = 0;

// Let the player actually land on the platform before measuring the ride.
for (let f = 0; f < 10; f++) game.gameLoop();
assert.ok(game.player.grounded, 'player should have landed on the platform');

const startX = game.player.x;
let ungroundedFrames = 0;
let worstFootGap = 0;
let maxDrift = 0;
const surface = [];

for (let f = 0; f < 240; f++) {
  game.gameLoop();
  if (!game.player.grounded) ungroundedFrames++;
  worstFootGap = Math.max(worstFootGap, Math.abs(game.player.y + game.player.h - platformTop()));
  maxDrift = Math.max(maxDrift, Math.abs(game.player.x - startX));
  surface.push(Math.round(platformTop()));
}

const rode = Math.max(...surface) - Math.min(...surface);
console.log(`platform at col ${platform.tx} row ${platform.ty}, travel ${rode}px`);
console.log(`ungrounded frames ${ungroundedFrames}/240, worst foot gap ${worstFootGap.toFixed(2)}px, drift ${maxDrift.toFixed(2)}px`);

assert.strictEqual(game.lives, 3, 'standing on a platform should not kill the player');
assert.ok(rode > 60, 'platform should actually move up and down');
assert.ok(maxDrift < 1, `player drifted sideways by ${maxDrift.toFixed(2)}px`);
assert.ok(worstFootGap <= 2, `feet detached from the surface by ${worstFootGap.toFixed(2)}px`);
assert.strictEqual(ungroundedFrames, 0, `lost footing on ${ungroundedFrames} frames`);

// Jumping must detach the player, then the platform should catch him again.
game.keys['Space'] = true;
game.gameLoop();
game.keys['Space'] = false;
assert.ok(game.player.vy < 0, 'jump should lift the player off the platform');
assert.strictEqual(game.player.riding, null, 'jumping should release the platform');

let landed = false;
for (let f = 0; f < 120 && !landed; f++) {
  game.gameLoop();
  landed = game.player.grounded;
}
assert.ok(landed, 'player should land again after jumping');
assert.strictEqual(game.lives, 3, 'jumping straight up should not be fatal');

console.log('moving platform OK: rides without jitter or drift, jump detaches and re-lands');
