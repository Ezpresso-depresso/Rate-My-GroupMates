import { funnyAwards } from '../../lib/ratingCore';
import './Awards.css';

export function AwardRules() {
  return (
    <>
      <div className="eyebrow">The awards are unofficial. The lore is forever.</div>
      <h2>Roasts, props &amp; project receipts.</h2>
      <p>
        Stars rate the work. The category averages pick the joke. The first matching pattern wins, so the same
        scores always produce the same award.
      </p>
      <details className="award-cabinet">
        <summary>The complete award cabinet</summary>
        {funnyAwards.map((a) => (
          <article key={a.id}>
            <span>{a.icon}</span>
            <div>
              <b>{a.title}</b>
              <p>{a.desc}</p>
              <small>{a.rule}</small>
            </div>
          </article>
        ))}
      </details>
      <p className="small muted">
        Achievement tiers: Certified Carry ≥4.5 stars; Group Chat MVP ≥3.5; Looks Good Guys ≥2.5; Present in Spirit
        below 2.5. Top Groupmate requires ≥3.5 stars; Celebrity requires 10 received reviews.
      </p>
      <div className="notice">
        Awards are comic exaggerations based on score patterns, recalculated from every submitted review.
      </div>
    </>
  );
}
