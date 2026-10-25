import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AwardsEmpty } from '../components/awards/AwardsEmpty';
import { AwardsHero } from '../components/awards/AwardsHero';
import { CeremonyCard } from '../components/awards/CeremonyCard';
import { Confetti } from '../components/awards/Confetti';
import { MemberDetail } from '../components/awards/MemberDetail';
import { Modal } from '../components/common/Modal';
import { useReviews } from '../hooks/useReviews';
import { incoming, summary } from '../lib/ratingCore';

export function AwardsPage() {
  const { team, currentUser, teammates, reviews, hasSubmitted } = useReviews();
  const celebrate = (useLocation().state as { celebrate?: boolean } | null)?.celebrate === true;
  const [detailId, setDetailId] = useState<string | null>(null);

  if (!hasSubmitted) return <AwardsEmpty />;

  const results = teammates.map((member) => ({ member, summary: summary(incoming(reviews, member.id)) }));
  const detail = results.find((r) => r.member.id === detailId);

  return (
    <>
      <AwardsHero teamName={team.name} count={teammates.length} />

      <div className="awards-sectionhead">
        <div>
          <div className="eyebrow">The team’s moment</div>
          <h2>Credit where it’s due.</h2>
        </div>
        <Link className="textbtn" to="/">
          Edit your ratings ↗
        </Link>
      </div>

      <div className="ceremony-grid">
        {results.map(({ member, summary: s }, i) => (
          <CeremonyCard
            key={member.id}
            member={member}
            summary={s}
            delay={i * 100}
            onDetails={() => setDetailId(member.id)}
          />
        ))}
      </div>

      <div className="closing-card">
        <span className="closing-star">✦</span>
        <div>
          <h3>The project is submitted. The lore is permanent.</h3>
          <p>Give props to the carry. A title to the yapper. And everyone their flowers.</p>
        </div>
        <Link className="btn" to="/">
          Back to ratings →
        </Link>
      </div>

      {detail && (
        <Modal label={`${detail.member.name} details`} onClose={() => setDetailId(null)}>
          <MemberDetail
            member={detail.member}
            summary={detail.summary}
            myReview={reviews.find((r) => r.reviewerId === currentUser.id && r.targetId === detail.member.id)}
          />
        </Modal>
      )}

      {celebrate && <Confetti />}
      <div className="sr-only" aria-live="polite">
        Reviews submitted. Team awards revealed.
      </div>
    </>
  );
}
