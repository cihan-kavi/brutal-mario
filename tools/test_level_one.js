/**
 * Plays every trap in "1-1: Taş Zemin" with the real engine. The opening
 * level is allowed to lie, but only the marked pit may actually kill: the
 * fake floor has to be escapable and the spring and cannon have to land
 * Mario somewhere solid.
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
global.location = { search: '?skipintro&level=1' };

const run = new Function(`${source}\nreturn { startGame, gameLoop, restartLevel, player, keys, TILE, T, tileAt, LEVELS,
  get enemies() { return enemies; },
  get invisibleShown() { return invisibleShown; },
  get levelIdx() { return levelIdx; }, get lives() { return lives; } };`);
const game = run();
game.startGame();

assert.strictEqual(game.LEVELS[game.levelIdx].name, '1-1: Taş Zemin');

const FLOOR = 13;
const col = () => game.player.x / game.TILE;
const feetRow = () => (game.player.y + game.player.h) / game.TILE;

function place(tileCol, tileRow) {
  game.restartLevel();
  for (const e of game.enemies) e.dead = true;
  game.player.x = tileCol * game.TILE;
  game.player.y = tileRow * game.TILE - game.player.h;
  game.player.vx = 0;
  game.player.vy = 0;
  game.player.grounded = true;
  game.player.invincible = 0;
}

// Resting on stone leaves the player ungrounded on every other frame, so a
// jump is held for a few frames here the way a real key press would be.
function play(frames, held = {}, jumpFrames = []) {
  for (const key of Object.keys(held)) game.keys[key] = held[key];
  for (let f = 0; f < frames && !game.player.dead; f++) {
    game.keys['ArrowUp'] = jumpFrames.some((j) => f >= j && f < j + 4);
    game.gameLoop();
  }
  game.keys['ArrowUp'] = false;
  for (const key of Object.keys(held)) game.keys[key] = false;
}

// The spring at the pit's edge is unavoidable, and it has to carry you over.
const spring = [...Array(100).keys()].find((c) => game.tileAt(c, FLOOR) === game.T.SPRING);
assert.strictEqual(spring, 39, 'the spring should sit on the last tile before the pit');
place(36, FLOOR);
play(120, { ArrowRight: true });
console.log(`spring: landed col ${col().toFixed(1)} row ${feetRow().toFixed(1)}, dead ${game.player.dead}`);
assert.ok(!game.player.dead, 'the spring should not be a death trap');
assert.ok(col() > 43, 'the spring should throw Mario over the pit');

// The floor that lies drops you into a ditch you can climb out of.
place(21, FLOOR);
play(30, { ArrowRight: true });
assert.ok(!game.player.dead, 'the fake floor should only drop you, not kill you');
assert.ok(feetRow() > FLOOR, 'walking onto the fake floor should drop you below it');
play(60, { ArrowRight: true }, [0, 20, 40]);
console.log(`fake floor: escaped to col ${col().toFixed(1)} row ${feetRow().toFixed(1)}`);
assert.ok(!game.player.dead && col() > 26 && feetRow() <= FLOOR, 'the ditch should be escapable');

// Empty air that answers back, then doubles as a step to a hidden coin.
place(33, FLOOR);
play(40, {}, [0]);
assert.ok(!game.player.dead, 'bonking the invisible block should be harmless');
assert.ok(game.invisibleShown.size > 0, 'bonking should reveal the invisible block');
assert.strictEqual(Math.round(feetRow()), FLOOR, 'the bonk should drop you back on the floor');

place(31, FLOOR);
game.keys['ArrowRight'] = true;
let stood = null;
for (let f = 0; f < 60 && !stood; f++) {
  game.keys['ArrowUp'] = f < 4;
  game.gameLoop();
  if (game.player.grounded && feetRow() === 11) stood = { col: col(), frame: f };
}
game.keys['ArrowRight'] = false;
game.keys['ArrowUp'] = false;
console.log(`invisible block: stood on it at col ${stood ? stood.col.toFixed(1) : '-'} after ${stood ? stood.frame : '-'} frames`);
assert.ok(stood, 'you should be able to stand on the revealed block');
assert.ok(stood.col >= 31 && stood.col <= 35, 'the footing should be the invisible block itself');

// And from up there the hidden coin block is in reach.
place(33, 11);
play(40, {}, [0]);
console.log(`hidden coin: block at row 7 is now ${game.tileAt(33, 7) === game.T.BRICK ? 'spent' : 'untouched'}`);
assert.strictEqual(game.tileAt(33, 7), game.T.BRICK, 'the hidden coin should pay out from the block');

// The pit with the skull block: the plain jump clears it, its stones do not hold.
place(56, FLOOR);
play(60, { ArrowRight: true }, [0]);
console.log(`skull pit: cleared to col ${col().toFixed(1)} row ${feetRow().toFixed(1)}, dead ${game.player.dead}`);
assert.ok(!game.player.dead && col() >= 61, 'jumping the marked pit should work');

place(59, 12);
game.player.grounded = false;
game.player.vy = 2;
play(60);
assert.ok(game.player.dead, 'the stones inside the marked pit should give way');

// The cannon above the last stretch fires you towards the flag.
const launcher = [...Array(100).keys()].find((c) => game.tileAt(c, 10) === game.T.LAUNCHER);
assert.strictEqual(launcher, 73, 'the cannon should sit on the raised platform');
place(71, 10);
play(140, { ArrowRight: true });
console.log(`cannon: flung to col ${col().toFixed(1)} row ${feetRow().toFixed(1)}, dead ${game.player.dead}`);
assert.ok(!game.player.dead, 'the cannon should never fire you into a pit');
assert.ok(col() > 85, 'the cannon should cover real ground');

console.log('level 1-1 OK: every lie survivable except the marked pit');
