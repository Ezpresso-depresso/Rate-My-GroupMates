import { useEffect, useMemo, useRef, useState } from 'react';
import { useReviews } from '../../hooks/useReviews';
import { funnyAward, incoming, summary } from '../../lib/ratingCore';
import { Game } from './Game';
import { fighterColor } from './scene';
import './afterparty.css';

export default function AfterpartyPanel({ onClose }: { onClose: () => void }) {
  const { team, currentUser, reviews, hasSubmitted } = useReviews();
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(0);
  const [duration, setDuration] = useState(90);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.scrollIntoView({ block: 'start' }); }, []);
  const members = useMemo(() => team.members.map((m, i) => ({
    id: m.id, name: m.name, color: fighterColor(i), award: funnyAward(summary(incoming(reviews, m.id))).title,
  })), [team.members, reviews]);
  if (!hasSubmitted) return null;

  return <section ref={panel} className="afterparty" id="afterparty-panel" aria-label="Afterparty arena">
    <div className="ap-shell">
      <div className="ap-nav"><span className="ap-brand"><span>r/g</span> OPTIONAL AFTERPARTY</span><button onClick={onClose} className="ap-back">← Back to awards</button></div>
      <header className="ap-heading"><div><span className="ap-eyebrow">{team.name} / THE POST-PROJECT PLAYGROUND</span><h1>Work’s done.<br className="ap-mobile-break" /> <em>Gloves on.</em></h1></div><div className="ap-edition"><span>AFTERPARTY</span><strong>VOL. 01 ↗</strong></div></header>
      {!started ? <section className="ap-lobby">
        <div className="ap-lobby-copy"><span className="ap-eyebrow">FROM TEAM AWARDS TO FRIENDLY CHAOS</span><h2>One room.<br />Everyone’s invited.</h2><p>Your whole group takes the stage for their awards. Then the gloves come out. You play as <strong>{currentUser.name}</strong>; the other {members.length - 1} teammates join as AI.</p>
          <div className="ap-lobby-members">{members.map(m => <span key={m.id}><i style={{ background: m.color }} />{m.name}{m.id === currentUser.id ? ' (you)' : ''}</span>)}</div>
          <label className="ap-duration">ROUND LENGTH<select value={duration} onChange={e => setDuration(Number(e.target.value))}><option value={60}>60 seconds · Quick round</option><option value={90}>90 seconds · Classic</option><option value={120}>120 seconds · Extra chaos</option></select></label>
          <button className="ap-primary" disabled={members.length < 2} onClick={() => setStarted(true)}>Enter the afterparty ↗</button>
          {members.length < 2 && <p role="status">You’ll need at least two group members to start a brawl.</p>}
          <p className="ap-lobby-footnote">Single-player · {members.length} fighters · Your ratings stay unchanged</p>
        </div>
        <div className="ap-playbook"><span className="ap-eyebrow">A LITTLE FRIENDLY COMPETITION</span><div className="ap-glove-art" aria-hidden="true"><span>✦</span><b>KO!</b><i>GOOD GAME, GROUPMATE.</i></div>
          <ol><li><span>01</span><div><strong>Take your moment.</strong><p>Celebrate the team awards together in the arena.</p></div></li><li><span>02</span><div><strong>Move. Dodge. Throw a punch.</strong><p>Chain three jabs, land a heavy hit or dash out of trouble. Watch your stamina.</p></div></li><li><span>03</span><div><strong>Settle it on the scoreboard.</strong><p>Most KOs takes the round. Get knocked down? You’ll be back in 2.5 seconds.</p></div></li></ol>
        </div>
      </section> : <Game key={round} members={members} playerId={currentUser.id} duration={duration} onReplay={() => setRound(r => r + 1)} />}
      <footer className="ap-footer"><span>A little competition. Still the same team.</span><span>MADE FOR THE AFTER HOURS ✦</span></footer>
    </div>
  </section>;
}
