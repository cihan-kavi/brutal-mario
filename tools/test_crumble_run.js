/**
 * Runs the first crumbling bridge in "2-3: Çöken Köprü" with the real engine.
 * Holding right and hopping has to carry Mario over the pit, and standing
 * still on the bridge has to drop him into it.
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
global.location = { search: '?skipintro&level=6' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, restartLevel, player, keys, TILE, T, tileAt, LEVELS,
  get enemies() { return enemies; },
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

assert.strictEqual(game.LEVELS[game.levelIdx].name, '2-3: Çöken Köprü');

const BRIDGE_ROW = 12;
let bridgeStart = null;
let bridgeEnd = null;
for (let tx = 0; tx < 100; tx++) {
  if (game.tileAt(tx, BRIDGE_ROW) === game.T.CRUMBLE) {
    if (bridgeStart === null) bridgeStart = tx;
    bridgeEnd = tx;
  } else if (bridgeStart !== null && game.tileAt(tx, BRIDGE_ROW) === game.T.EMPTY) {
    break;
  }
}
assert.ok(bridgeStart !== null, 'level should have a crumbling bridge');

function placeOnBridge(tx) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.player.x = tx * game.TILE;
  game.player.y = BRIDGE_ROW * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;
}

// Keep moving and the bridge carries you across.
placeOnBridge(bridgeStart);
game.keys['ArrowRight'] = true;
let frames = 0;
while (frames < 400 && !game.player.dead && game.player.x < (bridgeEnd + 2) * game.TILE) {
  game.keys['ArrowUp'] = frames % 24 === 0;
  game.gameLoop();
  frames++;
}
game.keys['ArrowRight'] = false;
game.keys['ArrowUp'] = false;
const crossedCol = Math.round(game.player.x / game.TILE);
console.log(`bridge cols ${bridgeStart}-${bridgeEnd}: crossed to col ${crossedCol} in ${frames} frames, dead ${game.player.dead}`);
assert.ok(!game.player.dead, 'running across the bridge should survive');
assert.ok(crossedCol > bridgeEnd, 'running should clear the whole bridge');

// Stand still and it gives way.
placeOnBridge(bridgeStart + 1);
for (let f = 0; f < 90 && !game.player.dead; f++) game.gameLoop();
assert.ok(game.player.dead, 'standing on crumbling stone should drop you into the pit');

console.log('crumble bridge OK: crossable while moving, fatal when you stop');
