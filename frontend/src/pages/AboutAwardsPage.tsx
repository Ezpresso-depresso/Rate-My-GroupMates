/*
 * About awards (from the account menu): what every award means and how it's earned. Everything
 * here is read from lib/ratingCore.ts, the same rules that hand the awards out, so it can't drift.
 */
import { BADGES, categories, funnyAwards, TIERS } from '../lib/ratingCore';
import '../components/groups/Groups.css';
import './InfoPages.css';

export function AboutAwardsPage() {
  return (
    <div className="page-panel info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Help</div>
          <h1>About awards</h1>
        </div>
      </div>

      <div className="info-cards">
        <section className="card form-card">
          <h2>How awards work</h2>
          <p>
            Once everyone in a group has submitted their ratings, each person gets awards from the ratings their
            teammates gave them: one <b>achievement tier</b> from their average stars, one <b>signature award</b> from
            the pattern of their category scores, and any <b>badges</b> they qualify for.
          </p>
          <p className="muted">
            Awards are recalculated from every submitted review, so the same scores always give the same awards. The
            signature awards are comic exaggerations, not verdicts.
          </p>
          <ul className="info-list">
            {categories.map((c) => (
              <li key={c.key}>
                <b>{c.name}</b> (1–10): <span className="muted">{c.hint}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-card" aria-labelledby="tiers">
          <h2 id="tiers">Achievement tiers</h2>
          <p className="muted">Everyone gets exactly one, from their average star rating.</p>
          <ul className="award-guide">
            {TIERS.map((t, i) => (
              <li key={t.name}>
                <span className={`award-guide-icon ${t.tone}`} aria-hidden="true">
                  {t.symbol}
                </span>
                <div>
                  <b>{t.name}</b>
                  <p>{t.meaning}</p>
                  <small>{i === TIERS.length - 1 ? `Below ${TIERS[i - 1].min} stars` : `${t.min}+ stars on average`}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-card" aria-labelledby="badges">
          <h2 id="badges">Badges</h2>
          <p className="muted">Extras on top of your tier, for clearing a bar.</p>
          <ul className="award-guide">
            {BADGES.map((b) => (
              <li key={b.name}>
                <span className="award-guide-icon gold" aria-hidden="true">
                  {b.icon}
                </span>
                <div>
                  <b>{b.name}</b>
                  <small>{b.reason}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-card" aria-labelledby="signature">
          <h2 id="signature">Signature awards</h2>
          <p className="muted">
            One per person, picked from their category averages. They’re checked in this order and the first match
            wins.
          </p>
          <ul className="award-guide">
            {funnyAwards.map((a) => (
              <li key={a.id}>
                <span className={`award-guide-icon ${a.tone}`} aria-hidden="true">
                  {a.icon}
                </span>
                <div>
                  <b>{a.title}</b> <span className="muted small">· {a.trait}</span>
                  <p>{a.desc}</p>
                  <small>{a.rule}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
