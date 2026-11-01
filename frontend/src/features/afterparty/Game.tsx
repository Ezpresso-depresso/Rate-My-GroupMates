import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { BrawlGame, emptyInput, standings, type Contestant, type Snapshot } from './engine';
import { ArenaScene } from './scene';

interface Props { members: Contestant[]; playerId: string; duration: number; onReplay: () => void; }
const keysUsed = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK']);

export function Game({ members, playerId, duration, onReplay }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const game = useRef<BrawlGame | null>(null);
  const held = useRef(new Set<string>());
  const audio = useRef<AudioContext | null>(null);
  const sound = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [state, setState] = useState<Snapshot>(() => new BrawlGame(members, playerId, duration).snapshot());
  const [error, setError] = useState('');

  useEffect(() => {
    const element = host.current!;
    const simulation = new BrawlGame(members, playerId, duration);
    game.current = simulation;
    let scene: ArenaScene;
    try { scene = new ArenaScene(element, simulation); }
    catch {
      let cancelled = false;
      queueMicrotask(() => { if (!cancelled) setError('The 3D arena could not start. Enable hardware acceleration in your browser, then try again.'); });
      return () => { cancelled = true; game.current = null; };
    }
    element.focus({ preventScroll: true });
    const keys = held.current;
    const pause = () => {
      keys.clear();
      if (simulation.phase !== 'results') simulation.paused = true;
      setState(simulation.snapshot());
    };
    const visibility = () => { if (document.hidden) pause(); };
    const lostContext = (event: Event) => {
      event.preventDefault(); pause(); setError('The graphics connection was interrupted. Restart the arena to continue.');
    };
    const keydown = (event: KeyboardEvent) => {
      if (document.activeElement !== element) return;
      if (event.code === 'Escape' && !event.repeat) {
        simulation.paused = !simulation.paused; keys.clear(); setState(simulation.snapshot());
      }
      if (keysUsed.has(event.code)) { event.preventDefault(); keys.add(event.code); }
    };
    const keyup = (event: KeyboardEvent) => { keys.delete(event.code); };
    const focusout = () => keys.clear();
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', visibility);
    element.addEventListener('blur', focusout); scene.renderer.domElement.addEventListener('webglcontextlost', lostContext);
    let last = 0, accumulator = 0, hudTime = 0;
    let previousDamage = 0;
    scene.renderer.setAnimationLoop((now: number) => {
      const delta = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now;
      accumulator += delta; hudTime += delta;
      const input = emptyInput();
      input.x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      input.z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      input.jump = keys.has('Space'); input.dash = keys.has('ShiftLeft') || keys.has('ShiftRight');
      input.jab = keys.has('KeyJ'); input.heavy = keys.has('KeyK');
      while (accumulator >= 1 / 60) { simulation.update(1 / 60, input); accumulator -= 1 / 60; }
      scene.render();
      const damage = simulation.fighters.reduce((sum, f) => sum + f.damage, 0);
      if (damage > previousDamage && sound.current && audio.current?.state === 'running') {
        const ctx = audio.current, oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(150, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.09);
        gain.gain.setValueAtTime(0.055, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.11);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
      previousDamage = damage;
      if (hudTime >= 0.1) { hudTime = 0; setState(simulation.snapshot()); }
    });
    return () => {
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility);
      element.removeEventListener('blur', focusout); scene.renderer.domElement.removeEventListener('webglcontextlost', lostContext);
      keys.clear(); scene.dispose(); game.current = null;
      void audio.current?.close().catch(() => {}); audio.current = null;
    };
  }, [members, playerId, duration]);

  const focus = () => host.current?.focus({ preventScroll: true });
  const togglePause = () => {
    if (!game.current) return;
    game.current.paused = !game.current.paused; held.current.clear();
    setState(game.current.snapshot()); focus();
  };
  const toggleSound = async () => {
    try {
      if (!audio.current) audio.current = new AudioContext();
      await audio.current.resume();
      sound.current = !sound.current; setSoundEnabled(sound.current);
    } catch { sound.current = false; setSoundEnabled(false); }
    focus();
  };
  const press = (event: PointerEvent<HTMLElement>, key: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); held.current.add(key); focus();
  };
  const release = (key: string) => held.current.delete(key);
  const control = (key: string, label: string, text: string) => <button type="button" aria-label={label}
    onPointerDown={e => press(e, key)} onPointerUp={() => release(key)} onPointerCancel={() => release(key)}
    onLostPointerCapture={() => release(key)} onKeyDown={e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); held.current.add(key); } }}
    onKeyUp={() => release(key)} onBlur={() => release(key)}>{text}</button>;
  const player = state?.fighters.find(f => f.id === playerId);
  const awarded = state ? members[state.awardIndex] : null;
  const scores = state ? standings(state.fighters) : [];
  const active = state?.phase === 'brawl';

  return <div className="ap-game" data-phase={state?.phase ?? 'loading'}>
    <div className="ap-gamebar">
      <div><span className={`ap-live-dot ${active ? 'is-live' : ''}`} />{state?.phase === 'awards' ? 'THE CEREMONY' : state?.phase === 'results' ? 'THAT’S A WRAP' : 'FREE-FOR-ALL'}<span className="ap-mode">1 PLAYER / {members.length - 1} AI</span></div>
      <div className="ap-game-actions">
        <button onClick={toggleSound} aria-pressed={soundEnabled}>Sound {soundEnabled ? 'on' : 'off'}</button>
        <button onClick={togglePause} disabled={state?.phase === 'results' || !!error}>{state?.paused ? 'Resume' : 'Pause'} <kbd>Esc</kbd></button>
      </div>
    </div>
    <div className="ap-game-layout">
      <div className="ap-stage-wrap">
        <div ref={host} className="ap-stage" tabIndex={0} role="group" aria-label="Arena controls. W A S D to move, J to punch, K for heavy punch, Space to jump, Shift to dash, Escape to pause."
          onPointerDown={e => { focus(); if (e.pointerType === 'mouse' && active) press(e, 'KeyJ'); }}
          onPointerUp={() => release('KeyJ')} onPointerCancel={() => release('KeyJ')} onLostPointerCapture={() => release('KeyJ')} />
        {active && <div className={`ap-timer ${state.remaining <= 10 ? 'ap-urgent' : ''}`}><span>TIME LEFT</span><strong>{Math.ceil(state.remaining)}<small>s</small></strong></div>}
        {state?.phase === 'awards' && awarded && <div className="ap-award-banner" aria-live="polite">
          <span>THE SPOTLIGHT · {state.awardIndex + 1} / {members.length}</span>
          <h2>{awarded.award}</h2><p>{awarded.name}</p>
        </div>}
        {state?.phase === 'countdown' && <div className="ap-countdown" aria-live="assertive"><span>GLOVES ON.</span><strong>{state.countdown}</strong><p>Every teammate for themselves.</p></div>}
        {active && !!player?.down && <div className="ap-respawn" role="status">Catch your breath. Back in {Math.ceil(player.down)}…</div>}
        {state?.phase === 'awards' && <button className="ap-skip" onClick={() => { game.current?.skipCeremony(); focus(); }}>Skip ceremony →</button>}
        {state?.paused && !error && <div className="ap-overlay"><div className="ap-dialog" role="dialog" aria-label="Game paused">
          <span className="ap-eyebrow">TAKE A BREATHER</span><h2>Time out.</h2><p>The clock and every teammate are paused.</p><button className="ap-primary" onClick={togglePause}>Back to the brawl →</button>
        </div></div>}
        {state?.phase === 'results' && !error && <div className="ap-overlay"><div className="ap-dialog ap-results" role="dialog" aria-label="Brawl results">
          <span className="ap-eyebrow">THE AFTERPARTY AWARDS</span><h2>{scores.filter(f => f.rank === 1).length > 1 ? 'Shared glory.' : `${scores[0]?.name} takes the crown.`}</h2>
          <p>Just for fun. Your team ratings stay exactly as they were.</p>
          <div className="ap-result-table"><table><thead><tr><th>Rank / teammate</th><th>KOs</th><th>Falls</th><th>Damage</th></tr></thead>
            <tbody>{scores.map(f => <tr key={f.id}><th><span>{f.rank.toString().padStart(2, '0')}</span> {f.name}{f.id === playerId ? ' · YOU' : ''}</th><td>{f.kos}</td><td>{f.deaths}</td><td>{f.damage}</td></tr>)}</tbody></table></div>
          <p className="ap-tiebreak">Most KOs wins. Ties: fewer falls, then more damage. Equal scores share a rank.</p>
          <button className="ap-primary" onClick={onReplay}>One more round ↗</button>
        </div></div>}
        {error && <div className="ap-overlay"><div className="ap-dialog" role="alert"><h2>Arena unavailable</h2><p>{error}</p><button className="ap-primary" onClick={onReplay}>Try again</button></div></div>}
      </div>
      <aside className="ap-roster" aria-label="Live standings">
        <div className="ap-roster-title"><span>THE LINEUP</span><span>{members.length.toString().padStart(2, '0')}</span></div>
        <p>Same team. New rivalries.</p>
        <div className="ap-roster-list">{state?.fighters.map((f, i) => <div className={`ap-fighter ${f.id === playerId ? 'ap-you' : ''}`} key={f.id}>
          <div className="ap-fighter-top"><span className="ap-avatar" style={{ background: f.color }}>{f.name.slice(0, 1).toUpperCase()}</span>
            <div><strong>{f.name}</strong><small>{f.id === playerId ? 'YOU' : `BOT ${String(i + 1).padStart(2, '0')}`}{f.down ? ' · RECOVERING' : ''}</small></div><b>{f.kos}<small>KO</small></b></div>
          <div className="ap-health" role="meter" aria-label={`${f.name} health`} aria-valuenow={Math.ceil(f.hp)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${f.hp}%`, background: f.color }} /></div>
        </div>)}</div>
        <div className="ap-feed" aria-live="polite">{state?.feed.map(item => <p key={item.id}>{item.text}</p>)}</div>
        <div className="ap-roster-note"><span>HOUSE RULE</span><p>Friendly chaos only.<br />KOs don’t change your ratings.</p></div>
      </aside>
    </div>
    <div className="ap-controls">
      <div className="ap-key-guide"><span><kbd>W A S D</kbd> Move</span><span><kbd>J</kbd> / click · Punch</span><span><kbd>K</kbd> Heavy</span><span><kbd>SPACE</kbd> Jump</span><span><kbd>SHIFT</kbd> Dash</span></div>
      <div className="ap-energy"><span>YOUR STAMINA</span><div role="meter" aria-label="Your stamina" aria-valuenow={Math.round(player?.stamina ?? 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${player?.stamina ?? 100}%` }} /></div></div>
    </div>
    <div className="ap-touch" aria-label="Touch controls">
      <div className="ap-dpad">{control('KeyW', 'Move forward', '↑')}{control('KeyA', 'Move left', '←')}{control('KeyS', 'Move backward', '↓')}{control('KeyD', 'Move right', '→')}</div>
      <div className="ap-touch-actions">{control('Space', 'Jump', 'Jump')}{control('ShiftLeft', 'Dash', 'Dash')}{control('KeyK', 'Heavy punch', 'Heavy')}{control('KeyJ', 'Punch', 'Punch')}</div>
    </div>
  </div>;
}
