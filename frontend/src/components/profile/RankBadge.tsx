/*
 * Someone's overall rank, shown beside their bio (same height as the bio box). Always shown (it can't be hidden or pinned), and worked out from
 * the same reviews as the profile's rating section.
 */
import { summary, tierFor } from '../../lib/ratingCore';
import type { ReceivedReview } from '../../types';
import './Profile.css';

/** Whether these received reviews make someone The Pope (a perfect 5.0 average). */
export const isPope = (reviews: ReceivedReview[]) => tierFor(summary(reviews).average).tone === 'pope';

export function RankBadge({ reviews }: { reviews: ReceivedReview[] }) {
  // The average itself is in the profile's rating section; the badge just names the rank.
  const rank = tierFor(summary(reviews).average);

  return (
    <div className="rank-badge" role="img" aria-label={`Rank: ${rank.name}`} title={rank.meaning}>
      <span className={`rank-badge-icon ${rank.tone}`} aria-hidden="true">
        {rank.symbol}
      </span>
      <span className="rank-badge-text" aria-hidden="true">
        <span className="rank-badge-label">Rank</span>
        <strong>{rank.name}</strong>
      </span>
    </div>
  );
}
