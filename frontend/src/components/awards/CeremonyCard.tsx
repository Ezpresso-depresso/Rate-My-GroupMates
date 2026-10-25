import type { CSSProperties } from 'react';
import { funnyAward, medal } from '../../lib/ratingCore';
import type { Member, Summary } from '../../types';
import { Avatar } from '../common/Avatar';
import { Stars } from '../common/Stars';
import './Awards.css';

interface CeremonyCardProps {
  member: Member;
  summary: Summary;
  delay: number;
  onDetails: () => void;
}

export function CeremonyCard({ member, summary: s, delay, onDetails }: CeremonyCardProps) {
  const award = funnyAward(s);
  const m = medal(s);

  return (
    <article className="ceremony-card" style={{ '--delay': `${delay}ms` } as CSSProperties}>
      <div className="ceremony-card-top">
        <Avatar member={member} size={53} />
        <span className={`tier-pill ${m.tone}`}>
          {m.symbol} {m.name}
        </span>
      </div>
      <h2>{member.name}</h2>
      <div className="ceremony-rating">
        <strong>{s.average?.toFixed(1) ?? '—'}</strong>
        <span>
          <Stars value={s.average} />
          <small>{s.count} teammate reviews</small>
        </span>
      </div>

      <div className="divider" />
      <div className="eyebrow">Earned award</div>
      <div className="ceremony-award">
        <span className={`seal ${award.tone}`}>{award.icon}</span>
        <h3>{award.title}</h3>
      </div>
      <p>{award.desc}</p>
      <span className="lore-trait">{award.trait}</span>
      {s.awards.length > 0 && (
        <div className="earned-badges">
          {s.awards.map((b) => (
            <span key={b.name} title={b.reason}>
              {b.icon} {b.name}
            </span>
          ))}
        </div>
      )}

      <div className="divider" />
      <div className="eyebrow">Top achievement</div>
      <div className="achievement-line">
        <span className={`mini-medal ${m.tone}`}>{m.symbol}</span>
        <span>
          <b>{m.name}</b>
          <small>{s.top ? `${s.top.name} · ${s.top.value!.toFixed(1)}/10` : 'Keep growing together'}</small>
        </span>
      </div>
      <button className="details-button" onClick={onDetails}>
        See the full picture <span>↗</span>
      </button>
    </article>
  );
}
