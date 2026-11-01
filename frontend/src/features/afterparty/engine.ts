/** Browser-independent simulation. Reviews are read at the page boundary, never written here. */
export interface Contestant { id: string; name: string; color: string; award: string; }
export type Phase = 'awards' | 'countdown' | 'brawl' | 'results';
export type AttackKind = 'jab' | 'heavy';
export interface Input { x: number; z: number; jump: boolean; dash: boolean; jab: boolean; heavy: boolean; }
export const emptyInput = (): Input => ({ x: 0, z: 0, jump: false, dash: false, jab: false, heavy: false });
export interface Fighter extends Contestant {
  x: number; z: number; y: number; vx: number; vz: number; vy: number; angle: number;
  hp: number; stamina: number; kos: number; deaths: number; damage: number;
  stun: number; down: number; invincible: number; flash: number;
  cooldown: number; dashTime: number; dashCooldown: number; combo: number; comboTime: number;
  attack: { kind: AttackKind; age: number; hit: string[]; combo: number } | null;
  target: string | null; think: number; moving: number;
}
export interface Effect { x: number; z: number; y: number; age: number; color: string; kind: 'hit' | 'ko' | 'dash'; }
export interface FeedItem { id: number; text: string; }
export interface Snapshot {
  phase: Phase; paused: boolean; remaining: number; countdown: number; awardIndex: number;
  fighters: { id: string; name: string; color: string; hp: number; stamina: number; kos: number; deaths: number; damage: number; down: number }[];
  feed: FeedItem[];
}
export const ATTACKS = {
  jab: { windup: 0.12, active: 0.12, duration: 0.38, range: 1.65, damage: 16, force: 5, cost: 6 },
  heavy: { windup: 0.38, active: 0.14, duration: 0.85, range: 1.95, damage: 30, force: 10, cost: 28 },
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export class BrawlGame {
  fighters: Fighter[];
  playerId: string;
  radius: number;
  phase: Phase = 'awards';
  phaseTime = 0;
  remaining: number;
  duration: number;
  paused = false;
  elapsed = 0;
  effects: Effect[] = [];
  feed: FeedItem[] = [];
  eventId = 0;
  random: () => number;
  bumpers: { x: number; z: number; radius: number }[];

  constructor(members: Contestant[], playerId: string, duration = 90, random = Math.random) {
    if (members.length < 2) throw new Error('At least two teammates are needed for a brawl.');
    if (!members.some(m => m.id === playerId)) throw new Error('Select a team member before entering.');
    if (new Set(members.map(m => m.id)).size !== members.length) throw new Error('Team member IDs must be unique.');
    this.playerId = playerId;
    this.duration = duration;
    this.remaining = duration;
    this.random = random;
    this.radius = Math.max(7, Math.sqrt(members.length) * 3.1);
    this.bumpers = [-1, 1].flatMap(x => [-1, 1].map(z => ({ x: x * this.radius * 0.64, z: z * this.radius * 0.52, radius: 0.65 })));
    this.fighters = members.map((m, i) => {
      const angle = i / members.length * Math.PI * 2;
      return { ...m, x: Math.sin(angle) * this.radius * 0.53, z: Math.cos(angle) * this.radius * 0.53,
        y: 0, vx: 0, vz: 0, vy: 0, angle: angle + Math.PI, hp: 100, stamina: 100, kos: 0, deaths: 0, damage: 0,
        stun: 0, down: 0, invincible: 0, flash: 0, cooldown: 0, dashTime: 0, dashCooldown: 0, combo: 0,
        comboTime: 0, attack: null, target: null, think: 0, moving: 0 };
    });
  }

  get awardIndex() { return Math.min(this.fighters.length - 1, Math.floor(this.phaseTime / 2.8)); }
  skipCeremony() { if (this.phase === 'awards') { this.phase = 'countdown'; this.phaseTime = 0; } }
  snapshot(): Snapshot {
    return { phase: this.phase, paused: this.paused, remaining: this.remaining, countdown: Math.max(1, Math.ceil(3 - this.phaseTime)),
      awardIndex: this.awardIndex, fighters: this.fighters.map(({ id, name, color, hp, stamina, kos, deaths, damage, down }) =>
        ({ id, name, color, hp, stamina, kos, deaths, damage, down })), feed: [...this.feed] };
  }

  update(dt: number, input: Input) {
    if (this.paused || this.phase === 'results') return;
    dt = clamp(dt, 0, 1 / 30);
    this.elapsed += dt;
    this.phaseTime += dt;
    this.effects = this.effects.filter(e => (e.age += dt) < 0.55);
    if (this.phase === 'awards') {
      if (this.phaseTime >= this.fighters.length * 2.8) this.skipCeremony();
      return;
    }
    if (this.phase === 'countdown') {
      if (this.phaseTime >= 3) { this.phase = 'brawl'; this.phaseTime = 0; }
      return;
    }
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining <= 0) { this.phase = 'results'; return; }
    for (const f of this.fighters) {
      for (const key of ['stun', 'invincible', 'flash', 'cooldown', 'dashTime', 'dashCooldown', 'comboTime'] as const) f[key] = Math.max(0, f[key] - dt);
      f.stamina = Math.min(100, f.stamina + 19 * dt);
      if (f.down > 0) {
        f.down = Math.max(0, f.down - dt);
        if (!f.down) this.respawn(f);
        continue;
      }
      const command = f.id === this.playerId ? input : this.ai(f, dt);
      this.move(f, command, dt);
    }
    this.collisions();
    // Resolve after every fighter has moved so outcomes do not depend on frame render order.
    for (const f of this.fighters) this.attackStep(f, dt);
  }

  private ai(f: Fighter, dt: number): Input {
    const command = emptyInput();
    f.think -= dt;
    if (f.think <= 0 || !this.fighters.some(t => t.id === f.target && !t.down)) {
      const opponents = this.fighters.filter(t => t.id !== f.id && !t.down);
      // Randomized distance cost treats humans and bots identically.
      f.target = opponents.map(t => ({ t, cost: distance(f, t) + this.random() * 4 + (t.invincible > 0 ? 5 : 0) }))
        .sort((a, b) => a.cost - b.cost)[0]?.t.id ?? null;
      f.think = 0.5 + this.random() * 1.1;
    }
    const target = this.fighters.find(t => t.id === f.target);
    if (!target) return command;
    const dx = target.x - f.x, dz = target.z - f.z, d = Math.hypot(dx, dz);
    const nx = dx / (d || 1), nz = dz / (d || 1);
    if (!f.attack && !f.stun) f.angle = Math.atan2(dx, dz);
    if (d > 1.3) { command.x = nx; command.z = nz; }
    else if (d < 0.95) { command.x = -nx * 0.6; command.z = -nz * 0.6; }
    if (target.attack?.kind === 'heavy' && target.attack.age < 0.3 && d < 2.5 && f.stamina > 35) {
      command.x = nz; command.z = -nx; command.dash = true;
    } else if (d < 1.8 && !f.cooldown && !f.attack && this.random() < dt * 4) {
      command.heavy = this.random() < 0.24 && f.stamina > 40;
      command.jab = !command.heavy;
    }
    if (d > 5 && f.stamina > 75) command.dash = true;
    // Steer around stage bumpers rather than walking into them indefinitely.
    for (const b of this.bumpers) {
      const ahead = { x: f.x + command.x, z: f.z + command.z };
      if (distance(ahead, b) < b.radius + 0.8) {
        command.x += -(b.z - f.z) * 1.6;
        command.z += (b.x - f.x) * 1.6;
      }
    }
    return command;
  }

  private move(f: Fighter, input: Input, dt: number) {
    const length = Math.hypot(input.x, input.z);
    const x = input.x / Math.max(1, length), z = input.z / Math.max(1, length);
    const canMove = f.stun <= 0;
    if (canMove) {
      if (length > 0.05 && !f.attack && !f.dashTime) f.angle = Math.atan2(x, z);
      if (input.jump && f.y === 0 && !f.attack) f.vy = 7;
      if (input.dash && !f.dashCooldown && !f.attack && f.stamina >= 25) {
        f.stamina -= 25; f.dashTime = 0.18; f.dashCooldown = 0.8;
        f.invincible = Math.max(f.invincible, 0.16);
        this.effects.push({ x: f.x, z: f.z, y: 0.15, age: 0, color: f.color, kind: 'dash' });
      }
      if (!f.attack && !f.cooldown && !f.dashTime) {
        const kind = input.heavy ? 'heavy' : input.jab ? 'jab' : null;
        if (kind && f.stamina >= ATTACKS[kind].cost) {
          f.stamina -= ATTACKS[kind].cost;
          f.combo = kind === 'jab' && f.comboTime > 0 ? f.combo % 3 + 1 : 1;
          f.comboTime = 0.95;
          f.attack = { kind, age: 0, hit: [], combo: f.combo };
        }
      }
    }
    const speed = canMove ? (f.attack ? 1.4 : 4.6) : 0;
    const desiredX = f.dashTime ? Math.sin(f.angle) * 15 : x * speed;
    const desiredZ = f.dashTime ? Math.cos(f.angle) * 15 : z * speed;
    const blend = 1 - Math.exp(-(f.stun ? 3 : 16) * dt);
    f.vx += (desiredX - f.vx) * blend; f.vz += (desiredZ - f.vz) * blend;
    f.x += f.vx * dt; f.z += f.vz * dt;
    f.vy -= 20 * dt; f.y = Math.max(0, f.y + f.vy * dt);
    if (!f.y) f.vy = 0;
    f.moving = Math.hypot(f.vx, f.vz);
    this.constrain(f);
  }

  private constrain(f: Fighter) {
    const edge = this.radius - 0.55;
    f.x = clamp(f.x, -edge, edge); f.z = clamp(f.z, -edge, edge);
    for (const b of this.bumpers) {
      const d = distance(f, b), minimum = b.radius + 0.46;
      if (d < minimum) {
        f.x = b.x + (d > 0.001 ? (f.x - b.x) / d : 1) * minimum;
        f.z = b.z + (d > 0.001 ? (f.z - b.z) / d : 0) * minimum;
      }
    }
  }

  private collisions() {
    for (let i = 0; i < this.fighters.length; i++) {
      const a = this.fighters[i];
      if (a.down) continue;
      for (let j = i + 1; j < this.fighters.length; j++) {
        const b = this.fighters[j];
        if (b.down || Math.abs(a.y - b.y) > 1.4) continue;
        const d = distance(a, b);
        if (d < 0.92) {
          const dx = d > 0.001 ? (b.x - a.x) / d : 1, dz = d > 0.001 ? (b.z - a.z) / d : 0;
          const push = (0.92 - d) / 2;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
          this.constrain(a); this.constrain(b);
        }
      }
    }
  }

  private attackStep(f: Fighter, dt: number) {
    if (!f.attack || f.down) return;
    const a = f.attack, rule = ATTACKS[a.kind];
    a.age += dt;
    if (a.age >= rule.windup && a.age <= rule.windup + rule.active) {
      for (const t of this.fighters) {
        if (t.id === f.id || t.down || t.invincible || a.hit.includes(t.id) || Math.abs(t.y - f.y) > 1.1) continue;
        const dx = t.x - f.x, dz = t.z - f.z, d = Math.hypot(dx, dz);
        const facing = (Math.sin(f.angle) * dx + Math.cos(f.angle) * dz) / (d || 1);
        if (d > rule.range || facing < 0.4) continue;
        a.hit.push(t.id);
        const finisher = a.kind === 'jab' && a.combo === 3;
        const damage = rule.damage + (finisher ? 8 : 0), force = rule.force + (finisher ? 3 : 0);
        f.damage += Math.min(t.hp, damage);
        t.hp = Math.max(0, t.hp - damage);
        t.vx = dx / (d || 1) * force; t.vz = dz / (d || 1) * force;
        t.stun = a.kind === 'heavy' ? 0.32 : 0.16; t.flash = 0.18;
        t.attack = null; t.cooldown = 0.25;
        this.effects.push({ x: t.x, z: t.z, y: t.y + 1.1, age: 0, color: finisher ? '#fddd75' : '#ffffff', kind: 'hit' });
        if (!t.hp) {
          t.down = 2.5; t.deaths++; f.kos++;
          this.feed.unshift({ id: ++this.eventId, text: `${f.name} knocked out ${t.name}` });
          this.feed = this.feed.slice(0, 3);
          this.effects.push({ x: t.x, z: t.z, y: 0.7, age: 0, color: t.color, kind: 'ko' });
        }
      }
    }
    if (a.age >= rule.duration) { f.attack = null; f.cooldown = 0.08; }
  }

  private respawn(f: Fighter) {
    const candidates = Array.from({ length: 16 }, (_, i) => {
      const angle = i / 16 * Math.PI * 2;
      const point = { x: Math.sin(angle) * this.radius * 0.8, z: Math.cos(angle) * this.radius * 0.8 };
      return { ...point, safety: Math.min(...this.fighters.filter(t => t !== f && !t.down).map(t => distance(point, t))) };
    });
    const point = candidates.sort((a, b) => b.safety - a.safety)[0];
    Object.assign(f, { x: point.x, z: point.z, y: 0, vx: 0, vz: 0, vy: 0, hp: 100, stamina: 100,
      stun: 0, attack: null, invincible: 2, cooldown: 0.4, dashTime: 0, combo: 0, comboTime: 0 });
    this.constrain(f);
  }
}

/** Equal scores share a rank; display order is stable for ties. */
export function standings(fighters: Snapshot['fighters']) {
  const ordered = [...fighters].sort((a, b) => b.kos - a.kos || a.deaths - b.deaths || b.damage - a.damage);
  return ordered.map((f, i) => ({ ...f, rank: ordered.findIndex(t => t.kos === f.kos && t.deaths === f.deaths && t.damage === f.damage) + 1, order: i }));
}
