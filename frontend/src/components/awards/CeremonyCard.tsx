import type { CSSProperties } from 'react';
import { medal, tierFor } from '../../lib/ratingCore';
import { AwardIcon } from './AwardIcon';
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
  const award = s.award;
  // Rank is global (every rating across all groups counts), not this group's average.
  const m = member.rating ? tierFor(member.rating.average) : medal(s);

  return (
    <article className="ceremony-card" style={{ '--delay': `${delay}ms` } as CSSProperties}>
      <div className="ceremony-card-top">
        <Avatar member={member} size={53} glow={m.tone === 'pope'} />
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
      {award ? (
        <>
          <div className="ceremony-award">
            <span className={`seal ${award.tone}`}>
              <AwardIcon id={award.id} symbol={award.icon} />
            </span>
            <h3>{award.title}</h3>
          </div>
          <p>{award.desc}</p>
        </>
      ) : (
        <p className="muted">No award picked yet.</p>
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
