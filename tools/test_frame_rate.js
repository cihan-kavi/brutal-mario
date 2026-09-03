/**
 * Physics runs in fixed steps, so on a 120Hz phone screen the game used to
 * play at double speed. The browser loop now spends real time instead of
 * frames: this feeds it 60Hz, 120Hz and a stuttering 30Hz timeline and checks
 * Mario covers the same ground per second in all three.
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

const run = new Function(`${source}\nreturn { startGame, frame, restartLevel, player, keys, TILE,
  get enemies() { return enemies; },
  set stepDebt(v) { stepDebt = v; }, set lastFrameTime(v) { lastFrameTime = v; } };`);
const RESET = { debt: 0, time: null };
const game = run();
game.startGame();

// One second of held right, delivered on differently paced screens.
function runSecond(frameMs) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.stepDebt = RESET.debt;
  game.lastFrameTime = RESET.time;
  const startX = game.player.x;
  game.keys['ArrowRight'] = true;
  for (let t = 0; t <= 1000; t += frameMs) game.frame(t);
  game.keys['ArrowRight'] = false;
  return (game.player.x - startX) / game.TILE;
}

const at60 = runSecond(1000 / 60);
const at120 = runSecond(1000 / 120);
const at30 = runSecond(1000 / 30);
console.log(`walked per second: 60Hz ${at60.toFixed(2)} tiles, 120Hz ${at120.toFixed(2)}, 30Hz ${at30.toFixed(2)}`);

assert.ok(at60 > 7, `a second of running should cover real ground, got ${at60}`);
for (const [name, walked] of [['120Hz', at120], ['30Hz', at30]]) {
  const drift = Math.abs(walked - at60) / at60;
  assert.ok(drift < 0.05, `${name} should match 60Hz within 5%, off by ${(drift * 100).toFixed(1)}%`);
}

// A long stall (tab in the background, phone locked) must not fast-forward the
// world by seconds worth of steps.
game.restartLevel();
for (const e of game.enemies) e.dead = true;
game.stepDebt = RESET.debt;
game.lastFrameTime = RESET.time;
game.frame(0);
const beforeStall = game.player.x;
game.keys['ArrowRight'] = true;
game.frame(5000);
game.keys['ArrowRight'] = false;
const stallTiles = (game.player.x - beforeStall) / game.TILE;
console.log(`after a 5s stall, the next frame advanced ${stallTiles.toFixed(2)} tiles`);
assert.ok(stallTiles > 0, 'the frame after a stall should still simulate');
assert.ok(stallTiles < 1, 'a stall should not fast-forward the world');

console.log('frame rate OK: same speed at 30, 60 and 120Hz, stalls clamped');
