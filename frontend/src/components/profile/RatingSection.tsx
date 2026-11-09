import { summary } from '../../lib/ratingCore';
import type { ReceivedReview } from '../../types';
import { Stars } from '../common/Stars';
import './Profile.css';

/** "My Rating": your average stars and category scores across every group that counts. */
export function RatingSection({ reviews, groupCount }: { reviews: ReceivedReview[]; groupCount: number }) {
  const s = summary(reviews);

  return (
    <section className="card profile-section" aria-labelledby="my-rating">
      <h2 id="my-rating">My Rating</h2>
      {s.average === null ? (
        <p className="muted">No ratings yet. They’ll show up here once you’ve rated your teammates in a group.</p>
      ) : (
        <div className="rating-summary">
          <div className="rating-overall">
            <strong>{s.average.toFixed(1)}</strong>
            <Stars value={s.average} />
            <span className="muted small">
              {s.count} review{s.count === 1 ? '' : 's'} · {groupCount} group{groupCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="rating-categories">
            {s.scores.map((c) => (
              <div key={c.key} className="rating-category">
                <span>{c.name}</span>
                <b>{c.value === null ? '—' : c.value.toFixed(1)} / 10</b>
                <div className="profile-bar" aria-hidden="true">
                  <i style={{ width: `${(c.value ?? 0) * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
