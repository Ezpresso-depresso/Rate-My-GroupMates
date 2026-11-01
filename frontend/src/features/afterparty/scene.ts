import * as THREE from 'three';
import { ATTACKS, type BrawlGame, type Fighter } from './engine';

const COLORS = ['#ffbd69', '#b497ff', '#65ddcb', '#ff86a7', '#7abaff', '#e3ec80', '#ff986d', '#d995ef'];
export const fighterColor = (index: number) => COLORS[index % COLORS.length];
interface Avatar {
  root: THREE.Group; body: THREE.Group; arms: THREE.Group[]; legs: THREE.Group[];
  ring: THREE.Mesh; arc: THREE.Mesh; label: HTMLDivElement; health: HTMLSpanElement; materials: THREE.MeshStandardMaterial[];
}

/** Procedural articulated characters: no external models or network asset requests. */
export class ArenaScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera();
  avatars: Avatar[] = [];
  particles: THREE.Mesh[] = [];
  observer: ResizeObserver;
  host: HTMLDivElement;
  game: BrawlGame;
  width = 1;
  height = 1;
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(host: HTMLDivElement, game: BrawlGame) {
    this.host = host; this.game = game;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#121529');
    this.renderer.domElement.setAttribute('aria-label', '3D afterparty arena. Use the controls below to play.');
    host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#cedbff', '#353054', 2.8));
    const sun = new THREE.DirectionalLight('#ffe3cc', 4);
    sun.position.set(-6, 14, 9); sun.castShadow = true;
    const r = game.radius;
    Object.assign(sun.shadow.camera, { left: -r - 3, right: r + 3, top: r + 3, bottom: -r - 3, far: 60 });
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight('#a89bff', 2);
    fill.position.set(8, 5, -8); this.scene.add(fill);
    this.stage();
    this.avatars = game.fighters.map((f, i) => this.avatar(f, i));
    for (let i = 0; i < 96; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshBasicMaterial({ color: COLORS[i % COLORS.length] }));
      p.visible = false; this.scene.add(p); this.particles.push(p);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host); this.resize();
  }

  private box(parent: THREE.Object3D, size: number[], position: number[], color: string, glow = false) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.12,
      emissive: glow ? color : '#000000', emissiveIntensity: glow ? 1.1 : 0 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
    mesh.position.set(position[0], position[1], position[2]); mesh.castShadow = !glow; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }

  private stage() {
    const r = this.game.radius;
    this.box(this.scene, [r * 2 + 1, 0.65, r * 2 + 1], [0, -0.38, 0], '#272b48');
    this.box(this.scene, [r * 2, 0.12, r * 2], [0, -0.06, 0], '#444969');
    const grid = new THREE.GridHelper(r * 2, Math.round(r * 2), '#606582', '#505572');
    grid.position.y = 0.015; this.scene.add(grid);
    for (const sign of [-1, 1]) {
      this.box(this.scene, [r * 2 + 0.3, 0.14, 0.11], [0, 0.1, sign * r], sign < 0 ? '#a896ff' : '#f0c975', true);
      this.box(this.scene, [0.11, 0.14, r * 2], [sign * r, 0.1, 0], '#a896ff', true);
      this.box(this.scene, [r * 2, 0.22, 0.14], [0, 0.75, -r - 0.1], '#66618d');
      for (const z of [-1, 1]) {
        this.box(this.scene, [0.45, 1.05, 0.45], [sign * r, 0.4, z * r], '#777198');
        this.box(this.scene, [0.5, 0.12, 0.5], [sign * r, 0.97, z * r], '#cabaff', true);
      }
    }
    const circle = new THREE.Mesh(new THREE.RingGeometry(r * 0.43, r * 0.43 + 0.035, 96), new THREE.MeshBasicMaterial({ color: '#9193b0', side: THREE.DoubleSide }));
    circle.rotation.x = -Math.PI / 2; circle.position.y = 0.025; this.scene.add(circle);
    for (const b of this.game.bumpers) {
      const bumper = new THREE.Mesh(new THREE.CylinderGeometry(b.radius, b.radius, 0.9, 24), new THREE.MeshStandardMaterial({ color: '#8378b2', roughness: 0.5 }));
      bumper.position.set(b.x, 0.45, b.z); bumper.castShadow = true; bumper.receiveShadow = true; this.scene.add(bumper);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(b.radius + 0.02, 0.075, 8, 24), new THREE.MeshStandardMaterial({ color: '#d1b7ff', emissive: '#9a70d4', emissiveIntensity: 0.5 }));
      rim.rotation.x = Math.PI / 2; rim.position.set(b.x, 0.84, b.z); this.scene.add(rim);
    }
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.textAlign = 'center'; ctx.fillStyle = '#9294b1'; ctx.font = '900 100px sans-serif';
    ctx.fillText('AFTER HOURS', 512, 115);
    ctx.font = '500 28px monospace'; ctx.fillStyle = '#b5acc5'; ctx.fillText('GOOD TEAM. FRIENDLY CHAOS.', 512, 170);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(r * 1.05, r * 0.26), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    logo.rotation.x = -Math.PI / 2; logo.position.set(0, 0.03, 0); this.scene.add(logo);
  }

  private avatar(f: Fighter, index: number): Avatar {
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body); this.scene.add(root);
    const materials: THREE.MeshStandardMaterial[] = [];
    const material = (color: string) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 }); materials.push(m); return m; };
    const suit = material(f.color), dark = material('#242842'), skin = material('#ffe0bd'), glove = material('#faf1dd');
    const sphere = (parent: THREE.Object3D, radius: number, pos: number[], mat: THREE.MeshStandardMaterial, scale = [1, 1, 1]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), mat);
      mesh.position.set(pos[0], pos[1], pos[2]); mesh.scale.set(scale[0], scale[1], scale[2]); mesh.castShadow = true; parent.add(mesh); return mesh;
    };
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.35, 5, 12), suit);
    torso.position.y = 0.92; torso.castShadow = true; body.add(torso);
    sphere(body, 0.36, [0, 1.65, 0], skin, [1.05, 1.06, 1]);
    sphere(body, 0.37, [0, 1.81, -0.065], dark, [1.06, 0.62, 1]);
    // Different hair silhouettes and a colored headband make each teammate recognizable.
    if (index % 3 === 0) sphere(body, 0.14, [0, 2.05, -0.03], dark);
    else if (index % 3 === 1) this.box(body, [0.15, 0.19, 0.42], [0, 2, -0.02], '#242842');
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.045, 6, 24), suit);
    band.rotation.x = Math.PI / 2; band.position.y = 1.79; body.add(band);
    for (const x of [-0.13, 0.13]) {
      sphere(body, 0.065, [x, 1.66, 0.33], dark, [0.7, 1.15, 0.5]);
      sphere(body, 0.019, [x - 0.012, 1.68, 0.365], glove);
    }
    this.box(body, [0.1, 0.025, 0.025], [0, 1.5, 0.35], '#8b5360');
    const arms: THREE.Group[] = [], legs: THREE.Group[] = [];
    for (const sign of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sign * 0.38, 1.15, 0); body.add(arm);
      sphere(arm, 0.16, [sign * 0.08, -0.15, 0], suit, [1, 1.5, 1]);
      sphere(arm, 0.21, [sign * 0.08, -0.37, 0.09], glove, [1, 1, 1.18]); arms.push(arm);
      const leg = new THREE.Group(); leg.position.set(sign * 0.18, 0.63, 0); body.add(leg);
      sphere(leg, 0.16, [0, -0.19, 0], dark, [0.9, 1.65, 0.9]);
      sphere(leg, 0.19, [0, -0.43, 0.075], suit, [1, 0.55, 1.6]); legs.push(leg);
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.54, f.id === this.game.playerId ? 0.65 : 0.58, 48),
      new THREE.MeshBasicMaterial({ color: f.id === this.game.playerId ? '#f9df86' : f.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; this.scene.add(ring);
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.6, 24, 1, Math.PI * 0.15, Math.PI * 0.7),
      new THREE.MeshBasicMaterial({ color: '#ffda83', side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
    arc.rotation.x = Math.PI / 2; arc.visible = false; root.add(arc);
    const label = document.createElement('div'); label.className = 'fighter-label';
    const name = document.createElement('b'); name.textContent = `${f.id === this.game.playerId ? 'YOU · ' : ''}${f.name}`;
    const track = document.createElement('span'); track.className = 'fighter-health';
    const health = document.createElement('span'); health.style.background = f.color; track.appendChild(health);
    label.append(name, track); this.host.appendChild(label);
    return { root, body, arms, legs, ring, arc, label, health, materials };
  }

  resize() {
    this.width = Math.max(1, this.host.clientWidth); this.height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(this.width, this.height);
    const aspect = this.width / this.height, r = this.game.radius;
    const halfHeight = Math.max(r * 1.22, (r + 1.6) / aspect);
    Object.assign(this.camera, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight, near: 0.1, far: r * 10 });
    this.camera.position.set(0, r * 1.65, r * 1.7);
    this.camera.lookAt(0, 0, 0); this.camera.updateProjectionMatrix();
  }

  render() {
    const game = this.game, time = game.elapsed;
    this.avatars.forEach((avatar, i) => {
      const f = game.fighters[i];
      const celebrating = game.phase === 'awards' && game.awardIndex === i;
      const bounce = !this.reducedMotion && celebrating ? Math.abs(Math.sin(time * 5)) * 0.3 : 0;
      avatar.root.position.set(f.x, f.y + bounce, f.z); avatar.root.rotation.y = f.angle;
      avatar.body.rotation.z = f.down ? Math.PI / 2 : f.stun ? -0.18 : 0;
      avatar.body.position.y = f.down ? 0.25 : 0;
      const stride = f.moving > 0.2 && !f.down && f.y < 0.1 ? Math.sin(time * 13) * Math.min(f.moving / 6, 0.65) : 0;
      avatar.legs[0].rotation.x = stride; avatar.legs[1].rotation.x = -stride;
      avatar.arms.forEach((arm, j) => {
        arm.rotation.set((j ? -1 : 1) * stride * 0.7, 0, celebrating ? (j ? -1 : 1) * 2.6 : 0);
      });
      avatar.body.rotation.x = f.dashTime ? 0.4 : 0;
      avatar.arc.visible = false;
      if (f.attack) {
        const rule = ATTACKS[f.attack.kind], age = f.attack.age;
        const extension = age < rule.windup ? -age / rule.windup * 0.65
          : Math.max(0, 1 - (age - rule.windup) / (rule.duration - rule.windup)) * 2.3;
        const hand = f.attack.combo % 2;
        avatar.arms[hand].rotation.x = -extension;
        if (f.attack.kind === 'heavy') avatar.arms[1 - hand].rotation.x = -extension * 0.7;
        avatar.arc.visible = age >= rule.windup && age < rule.windup + rule.active;
        avatar.arc.position.y = 0.8;
        avatar.body.rotation.z = Math.sin(age / rule.duration * Math.PI) * (hand ? -0.2 : 0.2);
      }
      avatar.root.visible = !f.invincible || Math.floor(time * 12) % 2 === 0;
      for (const m of avatar.materials) { m.emissive.set(f.flash ? '#ffffff' : '#000000'); m.emissiveIntensity = f.flash ? 0.65 : 0; }
      avatar.ring.position.set(f.x, 0.035, f.z); avatar.ring.scale.setScalar(celebrating ? 1.3 : 1);
      const projected = new THREE.Vector3(f.x, f.y + 2.5 + bounce, f.z).project(this.camera);
      avatar.label.style.transform = `translate(-50%, -100%) translate(${(projected.x + 1) / 2 * this.width}px, ${(1 - projected.y) / 2 * this.height}px)`;
      avatar.label.style.opacity = f.down ? '0.45' : '1';
      avatar.health.style.width = `${f.hp}%`;
    });
    this.particles.forEach(p => { p.visible = false; });
    if (!this.reducedMotion) {
      let particle = 0;
      for (const effect of game.effects) {
        for (let j = 0; j < (effect.kind === 'ko' ? 14 : 7) && particle < this.particles.length; j++) {
          const p = this.particles[particle++], angle = j * 2.4;
          const spread = effect.age * (effect.kind === 'ko' ? 6 : 3);
          p.visible = true; p.position.set(effect.x + Math.cos(angle) * spread, Math.max(0.1, effect.y + Math.sin(j * 3) * spread + effect.age * 2), effect.z + Math.sin(angle) * spread);
          p.scale.setScalar(1 - effect.age / 0.55); p.rotation.set(j + time, j, time);
          (p.material as THREE.MeshBasicMaterial).color.set(effect.color);
        }
      }
      if (game.phase === 'awards') {
        for (let j = 0; j < 32; j++) {
          const p = this.particles[j]; p.visible = true;
          p.position.set(Math.sin(j * 17) * game.radius, 5 - ((time * 1.8 + j * 0.3) % 5), Math.cos(j * 7) * game.radius);
          p.scale.set(1, 0.35, 1.8); p.rotation.set(time + j, time * 2, j);
          (p.material as THREE.MeshBasicMaterial).color.set(COLORS[j % COLORS.length]);
        }
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.observer.disconnect(); this.renderer.setAnimationLoop(null);
    this.avatars.forEach(a => a.label.remove());
    const materials = new Set<THREE.Material>(), geometries = new Set<THREE.BufferGeometry>();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        geometries.add(object.geometry);
        (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
      }
      if (object instanceof THREE.DirectionalLight) object.shadow.dispose();
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => { if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose(); m.dispose(); });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
