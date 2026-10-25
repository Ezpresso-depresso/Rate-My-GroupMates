import { funnyAward, medal } from '../../lib/ratingCore';
import type { Member, Summary } from '../../types';
import { Stars } from '../common/Stars';
import './Rating.css';

interface LiveResultProps {
  member: Member;
  summary: Summary;
  hasDraft: boolean;
}

export function LiveResult({ member, summary: s, hasDraft }: LiveResultProps) {
  const award = funnyAward(s);
  const m = medal(s);

  return (
    <aside className="card live-result">
      <div className="result-title">
        <h2>{member.name}’s result</h2>
        <span className="live-status">
          <i />
          Updates live
        </span>
      </div>

      <div className="result-section">
        <div className="eyebrow">Average rating</div>
        <div className="average-line">
          <strong>{s.average === null ? '—' : s.average.toFixed(1)}</strong>
          <Stars value={s.average} />
        </div>
        <span className="result-caption">
          {s.count} ratings · {hasDraft ? 'including your current draft' : 'sample peer reviews'}
        </span>
      </div>

      <div className="result-section">
        <div className="eyebrow">Award</div>
        <div className="recognition-row">
          <div className={`seal ${award.tone}`}>{award.icon}</div>
          <div>
            <span className="award-trait">{award.trait}</span>
            <h3>{award.title}</h3>
            <p>{award.desc}</p>
          </div>
        </div>
      </div>

      <div className="result-section">
        <div className="eyebrow">Achievement</div>
        <div className="recognition-row">
          <div className={`seal ${m.tone}`}>{m.symbol}</div>
          <div>
            <h3>{m.name}</h3>
            <p>Your group project energy, certified</p>
          </div>
        </div>
      </div>

      <div className="preview-note">
        Includes two sample peer reviews.
        <br />
        Change any rating and watch the result react.
      </div>
    </aside>
  );
}
