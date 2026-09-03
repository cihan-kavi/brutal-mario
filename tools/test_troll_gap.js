/**
 * The last hop in "1-2: Sahte Köprü" hides an invisible block over the pit.
 * Jumping from the edge, which is what the earlier hops teach, bonks into it
 * and drops you. Taking off a step or two early clears it. This test pins
 * both halves of that down, since one bad tile either way makes the gap
 * unfair or pointless.
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
global.location = { search: '?skipintro&level=2' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, restartLevel, player, keys, TILE, T, tileAt, LEVELS,
  get enemies() { return enemies; }, get banner() { return banner; },
  get invisibleShown() { return invisibleShown; },
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

assert.strictEqual(game.LEVELS[game.levelIdx].name, '1-2: Sahte Köprü');

const FLOOR = 13;
const block = { tx: 78, ty: 10 };
assert.strictEqual(game.tileAt(block.tx, block.ty), game.T.INVISIBLE, 'the trap block should be where the level puts it');
assert.strictEqual(game.tileAt(block.tx, block.ty + 1), game.T.INVISIBLE, 'the trap needs its lower half too');
const edge = block.tx - 1;
assert.strictEqual(game.tileAt(edge, FLOOR), game.T.GROUND, 'the block should sit right past the last floor tile');

function hopFrom(takeoff) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.player.x = takeoff * game.TILE;
  game.player.y = FLOOR * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;
  game.keys['ArrowRight'] = true;
  let result = { landed: false };
  for (let f = 0; f < 90; f++) {
    game.keys['ArrowUp'] = f < 4;
    game.gameLoop();
    if (game.player.dead) {
      const revealed = game.invisibleShown.has(`${block.tx},${block.ty}`) ||
        game.invisibleShown.has(`${block.tx},${block.ty + 1}`);
      result = { dead: true, title: game.banner.title, revealed };
      break;
    }
    if (game.player.grounded && game.player.x / game.TILE > block.tx + 1) {
      result = { landed: true, col: game.player.x / game.TILE };
      break;
    }
  }
  game.keys['ArrowRight'] = false;
  game.keys['ArrowUp'] = false;
  return result;
}

// Running to the brink and jumping is the trap, anywhere along the last tile.
for (const takeoff of [edge + 0.2, edge + 0.4, edge + 0.6, edge + 0.8]) {
  const hop = hopFrom(takeoff);
  console.log(`late takeoff (col ${takeoff}): ${hop.dead ? hop.title : `crossed to col ${hop.col.toFixed(1)}`}`);
  assert.ok(hop.dead, `jumping from col ${takeoff} should not make it across`);
  assert.ok(hop.revealed, 'the block must show itself so the death is readable');
  assert.strictEqual(hop.title, 'GÖRÜNMEZ BLOK!', 'the banner should blame the block, not the pit');
}

// Taking off a tile earlier goes clean over the top of it.
for (const takeoff of [edge - 2, edge - 1.5, edge - 1, edge - 0.5]) {
  const hop = hopFrom(takeoff);
  console.log(`early takeoff (col ${takeoff}): ${hop.landed ? `crossed to col ${hop.col.toFixed(1)}` : `died with ${hop.title}`}`);
  assert.ok(hop.landed, `takeoff from col ${takeoff} should clear the gap`);
}

// The staircase that replaced the repeated hops has to be climbable, and its
// fake step has to be a lie.
function climb(fromCol, fromRow) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.player.x = fromCol * game.TILE;
  game.player.y = fromRow * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;
  game.keys['ArrowRight'] = true;
  let landing = null;
  for (let f = 0; f < 70 && !landing; f++) {
    game.keys['ArrowUp'] = f < 4;
    game.gameLoop();
    if (game.player.dead) break;
    const row = (game.player.y + game.player.h) / game.TILE;
    if (f > 4 && game.player.grounded && row < fromRow) {
      landing = { row, col: game.player.x / game.TILE };
    }
  }
  game.keys['ArrowRight'] = false;
  game.keys['ArrowUp'] = false;
  return landing;
}

for (const [fromCol, fromRow, expected] of [[58, 13, 11], [64, 11, 9]]) {
  const step = climb(fromCol, fromRow);
  console.log(`staircase: col ${fromCol} row ${fromRow} -> ${step ? `row ${step.row} col ${step.col.toFixed(1)}` : 'MISSED'}`);
  assert.ok(step && step.row === expected, `the step from row ${fromRow} should reach row ${expected}`);
}
assert.strictEqual(game.tileAt(71, 9), game.T.FAKE, 'the top step should end in fake stone');

// Walking off the top step, fake tile and all, has to drop you on the floor
// well short of the trap gap.
game.restartLevel();
for (const e of game.enemies) e.dead = true;
game.player.x = 70 * game.TILE;
game.player.y = 9 * game.TILE - game.player.h;
game.player.vx = 0;
game.player.vy = 0;
game.player.grounded = true;
game.player.invincible = 0;
game.keys['ArrowRight'] = true;
for (let f = 0; f < 60 && (!game.player.grounded || game.player.y + game.player.h < 13 * game.TILE); f++) {
  game.gameLoop();
}
game.keys['ArrowRight'] = false;
const landedCol = game.player.x / game.TILE;
console.log(`walk off top step: landed col ${landedCol.toFixed(1)}, dead ${game.player.dead}`);
assert.ok(!game.player.dead, 'stepping off the top should not kill you');
assert.ok(landedCol > 72 && landedCol < block.tx - 1, 'the drop should land short of the trap gap');

console.log('troll gap OK: edge jump trapped, early jump rewarded, staircase climbs');
