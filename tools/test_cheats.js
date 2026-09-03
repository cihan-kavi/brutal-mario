/**
 * Checks the cheat panel: level jumping stays in range, god mode survives a
 * lethal hit, and fly mode roams through solid stone without dying.
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

const run = new Function(`${source}\nreturn { startGame, gameLoop, jumpToLevel, toggleGod, toggleFly,
  killPlayer, player, keys, TILE, LEVELS, tileAt, T,
  get levelIdx() { return levelIdx; }, get lives() { return lives; },
  get godMode() { return godMode; }, get flyMode() { return flyMode; } };`);
const game = run();
game.startGame();

// The picker lists every level and jumping clamps to the real range.
assert.strictEqual(
  elements.lvSelect.innerHTML.match(/<option/g).length,
  game.LEVELS.length,
  'level picker should list every level',
);

game.jumpToLevel(4);
assert.strictEqual(game.levelIdx, 4);
assert.strictEqual(elements.level.textContent, 5, 'HUD should follow the jump');

game.jumpToLevel(99);
assert.strictEqual(game.levelIdx, game.LEVELS.length - 1, 'jump past the end clamps');
game.jumpToLevel(-5);
assert.strictEqual(game.levelIdx, 0, 'jump before the start clamps');

// God mode: a lethal hit is ignored.
for (let f = 0; f < 61; f++) game.gameLoop();
game.toggleGod();
assert.ok(game.godMode);
game.killPlayer('test');
assert.ok(!game.player.dead, 'god mode should survive a kill');
assert.strictEqual(game.lives, 3, 'god mode should not cost a life');
game.toggleGod();
assert.ok(!game.godMode, 'god mode toggles back off');

// Fly mode: pass straight through the wall in "2-2: Diken Tavan".
game.jumpToLevel(4);
assert.strictEqual(game.LEVELS[game.levelIdx].name, '2-2: Diken Tavan');
let pillar = null;
for (let tx = 0; tx < 100 && !pillar; tx++) {
  for (let ty = 0; ty < 14; ty++) {
    if (game.tileAt(tx, ty) === game.T.PIPE) { pillar = { tx, ty }; break; }
  }
}
assert.ok(pillar, 'level should have a wall');

game.toggleFly();
assert.ok(game.flyMode);
game.player.x = (pillar.tx - 1) * game.TILE;
game.player.y = pillar.ty * game.TILE + 20;
const beforeX = game.player.x;

game.keys['ArrowRight'] = true;
for (let f = 0; f < 40; f++) game.gameLoop();
game.keys['ArrowRight'] = false;

assert.ok(
  game.player.x > (pillar.tx + 1) * game.TILE,
  `fly mode should pass through the pillar (x ${beforeX} -> ${game.player.x})`,
);
assert.strictEqual(game.lives, 3, 'flying should never be fatal');

game.keys['ArrowUp'] = true;
const beforeY = game.player.y;
for (let f = 0; f < 10; f++) game.gameLoop();
game.keys['ArrowUp'] = false;
assert.ok(game.player.y < beforeY, 'fly mode should climb with the up arrow');

// Turning fly mode off hands control back to gravity.
game.toggleFly();
game.player.x = 92 * game.TILE;
game.player.y = 6 * game.TILE;
game.player.vy = 0;
const fallStart = game.player.y;
for (let f = 0; f < 5; f++) game.gameLoop();
assert.ok(game.player.y > fallStart, 'gravity should resume once fly mode is off');

console.log('cheats OK: level picker clamps, god mode blocks death, fly mode passes through stone');
