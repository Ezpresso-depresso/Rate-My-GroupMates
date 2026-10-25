import { funnyAward } from '../../lib/ratingCore';
import type { Member, Review, Summary } from '../../types';
import './Awards.css';

interface MemberDetailProps {
  member: Member;
  summary: Summary;
  /** The current user's review of this member, if submitted. */
  myReview?: Review;
}

export function MemberDetail({ member, summary: s, myReview }: MemberDetailProps) {
  const award = funnyAward(s);

  return (
    <>
      <div className="eyebrow">The full picture</div>
      <h2>{member.name}’s project receipts</h2>
      <div className="award-explainer">
        <b>
          {award.icon} {award.title}
        </b>
        <p>{award.desc}</p>
        <small>Why this award: {award.rule}</small>
      </div>
      <p className="muted">
        {s.count} received ratings · {s.average?.toFixed(1) ?? '—'} / 5 stars
      </p>
      {s.scores.map((c) => (
        <div key={c.key} className="detail-score">
          <span>{c.name}</span>
          <b>{c.value === null ? '—' : c.value.toFixed(1)} / 10</b>
          <div className="progress-track">
            <i style={{ width: `${(c.value ?? 0) * 10}%` }} />
          </div>
        </div>
      ))}
      {myReview?.text ? (
        <div className="shared-comment">
          <b>{myReview.anonymous ? 'Anonymous teammate' : 'Your feedback'}</b>
          <p>{myReview.text}</p>
        </div>
      ) : (
        <p className="small muted">You didn’t leave a written comment.</p>
      )}
      <p className="small muted">Category scores are shown as averages.</p>
    </>
  );
}
