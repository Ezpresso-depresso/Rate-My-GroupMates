import test from 'node:test';
import assert from 'node:assert/strict';
import { BrawlGame, emptyInput, standings } from '../src/features/afterparty/engine.ts';

const members = n => Array.from({ length: n }, (_, i) => ({ id: `member-${i}`, name: `Member ${i}`, color: '#aabbcc', award: 'Team player' }));
const advance = (game, seconds, input = emptyInput()) => { for (let n = 0; n < Math.round(seconds * 60); n++) game.update(1 / 60, input); };
function random(seed = 123) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function duel() {
  const game = new BrawlGame(members(2), 'member-0', 90, () => 0.99);
  game.phase = 'brawl';
  Object.assign(game.fighters[0], { x: 0, z: 0, angle: 0 });
  Object.assign(game.fighters[1], { x: 0, z: 1.25, stun: 10 });
  return game;
}

test('roster uses every member and the selected player, without mutating source data', () => {
  for (const count of [2, 3, 4, 6, 12, 24]) {
    const data = members(count), original = JSON.stringify(data);
    const game = new BrawlGame(data, `member-${count - 1}`);
    assert.equal(game.fighters.length, count); assert.equal(game.playerId, `member-${count - 1}`);
    assert.equal(new Set(game.fighters.map(f => `${f.x},${f.z}`)).size, count);
    game.fighters[0].hp = 0; assert.equal(JSON.stringify(data), original);
  }
  assert.throws(() => new BrawlGame(members(1), 'member-0'));
  assert.throws(() => new BrawlGame(members(4), 'missing'));
});

test('ceremony and countdown lock combat; pause freezes all simulation state', () => {
  const game = new BrawlGame(members(3), 'member-0');
  const positions = game.fighters.map(f => [f.x, f.z, f.hp]);
  advance(game, 2, { ...emptyInput(), x: 1, jab: true });
  assert.deepEqual(game.fighters.map(f => [f.x, f.z, f.hp]), positions);
  game.skipCeremony(); advance(game, 3.1);
  assert.equal(game.phase, 'brawl');
  game.paused = true; const before = JSON.stringify(game);
  advance(game, 10, { ...emptyInput(), x: 1, jab: true });
  assert.equal(JSON.stringify(game), before);
});

test('movement normalizes diagonals, stays inside the arena, and jump returns to ground', () => {
  const straight = duel(), diagonal = duel();
  for (const game of [straight, diagonal]) Object.assign(game.fighters[1], { x: -5, z: -5, stun: 100 });
  advance(straight, 0.5, { ...emptyInput(), x: 1 });
  advance(diagonal, 0.5, { ...emptyInput(), x: 1, z: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.fighters[0].x, diagonal.fighters[0].z) - straight.fighters[0].x) < 0.01);
  advance(straight, 15, { ...emptyInput(), x: 1 });
  assert.ok(straight.fighters[0].x <= straight.radius - 0.55);
  advance(diagonal, 0.1, { ...emptyInput(), jump: true }); assert.ok(diagonal.fighters[0].y > 0);
  advance(diagonal, 1); assert.equal(diagonal.fighters[0].y, 0);
});

test('jab has windup, hits only once, respects facing, range, height and invulnerability', () => {
  const game = duel(); game.update(1 / 60, { ...emptyInput(), jab: true });
  assert.equal(game.fighters[1].hp, 100);
  advance(game, 0.22); assert.equal(game.fighters[1].hp, 84);
  advance(game, 0.15); assert.equal(game.fighters[1].hp, 84);
  for (const changes of [{ z: -1.25 }, { z: 4 }, { invincible: 2 }, { y: 3, vy: 4 }]) {
    const blocked = duel(); Object.assign(blocked.fighters[1], changes);
    blocked.update(1 / 60, { ...emptyInput(), jab: true }); advance(blocked, 0.22);
    assert.equal(blocked.fighters[1].hp, 100, JSON.stringify(changes));
  }
});

test('heavy attack spends stamina and applies stronger damage and knockback', () => {
  const game = duel(); game.update(1 / 60, { ...emptyInput(), heavy: true });
  assert.equal(game.fighters[0].stamina, 72);
  advance(game, 0.42); assert.equal(game.fighters[1].hp, 70); assert.ok(game.fighters[1].vz > 5);
  const tired = duel(); tired.fighters[0].stamina = 0;
  tired.update(1 / 60, { ...emptyInput(), heavy: true }); assert.equal(tired.fighters[0].attack, null);
});

test('KO counts once and respawn restores health with protection', () => {
  const game = duel(); game.fighters[1].hp = 10;
  game.update(1 / 60, { ...emptyInput(), jab: true }); advance(game, 0.25);
  assert.equal(game.fighters[0].kos, 1); assert.equal(game.fighters[1].deaths, 1); assert.ok(game.fighters[1].down > 0);
  advance(game, 2.7);
  assert.equal(game.fighters[1].hp, 100); assert.ok(game.fighters[1].invincible > 0);
  assert.equal(game.fighters[0].kos, 1);
});

test('dash costs stamina, briefly protects the player and cannot be spammed', () => {
  const game = duel();
  game.update(1 / 60, { ...emptyInput(), x: 1, dash: true, jab: true });
  const player = game.fighters[0];
  assert.equal(player.stamina, 75); assert.ok(player.invincible > 0); assert.equal(player.attack, null);
  advance(game, 0.3, { ...emptyInput(), x: 1, dash: true });
  assert.ok(player.stamina > 75); assert.equal(player.invincible, 0); assert.ok(player.dashCooldown > 0);
});

test('coincident fighters and bumper centers are separated without invalid coordinates', () => {
  const game = duel(), bumper = game.bumpers[0];
  for (const f of game.fighters) Object.assign(f, { x: bumper.x, z: bumper.z, stun: 100 });
  advance(game, 0.3);
  for (const f of game.fighters) assert.ok(Math.hypot(f.x - bumper.x, f.z - bumper.z) >= bumper.radius + 0.45);
  assert.ok(Math.hypot(game.fighters[0].x - game.fighters[1].x, game.fighters[0].z - game.fighters[1].z) > 0.85);
});

test('bots fight each other and finite matches finish for multiple group sizes', () => {
  for (const count of [2, 4, 6, 12, 24]) {
    const game = new BrawlGame(members(count), 'member-0', 60, random()); game.phase = 'brawl';
    advance(game, 60.1);
    assert.equal(game.phase, 'results'); assert.equal(game.remaining, 0);
    assert.ok(game.fighters.slice(1).some(f => f.damage > 0));
    if (count >= 4) assert.ok(game.feed.some(f => !f.text.includes('Member 0')));
    assert.ok(game.fighters.every(f => [f.x, f.z, f.y, f.hp, f.stamina].every(Number.isFinite)));
    assert.equal(game.fighters.reduce((n, f) => n + f.kos, 0), game.fighters.reduce((n, f) => n + f.deaths, 0));
    const final = JSON.stringify(game.snapshot()); advance(game, 10, { ...emptyInput(), jab: true });
    assert.equal(JSON.stringify(game.snapshot()), final);
  }
});

test('equal results share a rank and ties use falls then damage', () => {
  const game = duel();
  assert.deepEqual(standings(game.snapshot().fighters).map(f => f.rank), [1, 1]);
  game.fighters[1].damage = 10; assert.equal(standings(game.snapshot().fighters)[0].id, 'member-1');
  game.fighters[1].deaths = 1; assert.equal(standings(game.snapshot().fighters)[0].id, 'member-0');
  game.fighters[1].kos = 1; assert.equal(standings(game.snapshot().fighters)[0].id, 'member-1');
});
