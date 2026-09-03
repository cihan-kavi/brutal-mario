/**
 * Runs the real game script under DOM stubs and asserts that dying shows a
 * fading banner naming the cause, costs a life, and restarts the level on its
 * own with no click required. Lives start at three and are allowed to run
 * past zero forever, so there is never a game over screen.
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
      target[prop] = (...args) => {
        if (prop === 'createLinearGradient') return { addColorStop: noop };
        return undefined;
      };
    }
    return target[prop];
  },
  set(target, prop, value) {
    target[prop] = value;
    return true;
  },
});

const elements = {};
function element(id) {
  if (!elements[id]) {
    elements[id] = { id, textContent: '', style: {}, onclick: null, getContext: () => ctxStub };
  }
  return elements[id];
}

let clicksOffered = 0;
global.document = {
  getElementById: element,
  addEventListener: noop,
};
Object.defineProperty(element('msg'), 'style', {
  value: new Proxy({}, {
    set(target, prop, value) {
      if (prop === 'display' && value === 'block') clicksOffered++;
      target[prop] = value;
      return true;
    },
    get: (target, prop) => target[prop],
  }),
});
global.requestAnimationFrame = noop;
global.location = { search: '?skipintro&level=1' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, killPlayer, player, LEVELS,
  get banner() { return banner; }, get pending() { return pending; },
  get lives() { return lives; } };`);
const game = run();

game.startGame();
const spawnX = game.player.x;
assert.strictEqual(clicksOffered, 0, 'skipintro should not open the modal');

// Spawn protection lasts 60 frames, so nothing can kill the player before it ends.
for (let f = 0; f < 61; f++) game.gameLoop();
assert.strictEqual(game.player.x, spawnX, 'idle player should not drift');

game.player.x += 200;
game.killPlayer('spike');
assert.ok(game.banner, 'a banner should appear on death');
assert.strictEqual(game.banner.title, 'ŞİŞ KEBAP!', 'the banner should name the way you died');
assert.ok(game.banner.text.length > 0, 'banner needs a death message');
assert.strictEqual(game.lives, 2, 'a death should cost a life');
const bannerAtDeath = game.banner.life;

for (let f = 0; f < 69; f++) game.gameLoop();
assert.ok(game.player.dead, 'still dead just before the auto restart');
assert.ok(game.banner.life < bannerAtDeath, 'banner should be fading out');

game.gameLoop();
assert.ok(!game.player.dead, 'level must restart on its own');
assert.strictEqual(game.player.x, spawnX, 'player should be back at the spawn');
assert.strictEqual(game.pending, null, 'timer should be consumed');

for (let f = 0; f < 40; f++) game.gameLoop();
assert.strictEqual(game.banner, null, 'banner should disappear by itself');
assert.strictEqual(clicksOffered, 0, 'death must never require a button press');

// Running out of lives is not a thing: the counter just goes negative.
for (let i = 0; i < 5; i++) {
  for (let f = 0; f < 70; f++) game.gameLoop();
  for (let f = 0; f < 61; f++) game.gameLoop();
  game.killPlayer('pit');
}
assert.strictEqual(game.lives, -3, 'lives should keep counting past zero');
assert.strictEqual(game.banner.title, 'AŞAĞI!', 'falling should read as falling');
assert.strictEqual(clicksOffered, 0, 'no game over screen at any point');

console.log(`death flow OK: fading banner, auto restart after 70 frames, lives at ${game.lives}`);
