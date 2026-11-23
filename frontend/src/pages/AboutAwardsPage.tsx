/*
 * About awards (from the account menu): what every award means and how it's earned. Everything
 * here is read from lib/ratingCore.ts, the same rules that hand the awards out, so it can't drift.
 */
import { AwardIcon } from '../components/awards/AwardIcon';
import { categories, funnyAwards, TIERS } from '../lib/ratingCore';
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
            When you rate a teammate, you give them an overall <b>star rating</b>, a 1–10 score in each category
            below, and pick one <b>signature award</b> for them (a comment is optional).
          </p>
          <ul className="info-list">
            <li>
              <b>Signature award:</b> each person gets the award their teammates picked for them most often (a tie
              goes to the one listed first below). It shows on the group’s awards page and in the Awards section of
              their profile, where they can pin up to 3.
            </li>
            <li>
              <b>Rank:</b> set by your average stars. Your profile shows your overall rank beside your bio; each
              group’s awards page shows your rank in that group.
            </li>
            <li>
              <b>Category scores:</b> averaged in the rating section of your profile.
            </li>
          </ul>
          <p className="muted">
            Your profile only counts groups where you’ve submitted your own ratings. Everything updates as reviews come
            in or get edited. The awards are jokes, not verdicts.
          </p>
          <h3 className="info-subhead">The categories</h3>
          <ul className="info-list">
            {categories.map((c) => (
              <li key={c.key}>
                <b>{c.name}</b> (1–10): <span className="muted">{c.hint}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-card" aria-labelledby="ranks">
          <h2 id="ranks">Ranks</h2>
          <p className="muted">Everyone has exactly one, from their average star rating. Lowest to highest:</p>
          <ul className="award-guide">
            {TIERS.map((t) => (
              <li key={t.name}>
                <span className={`award-guide-icon ${t.tone}`} aria-hidden="true">
                  {t.symbol}
                </span>
                <div>
                  <b>{t.name}</b>
                  <p>{t.meaning}</p>
                  <small>{t.requirement}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card form-card" aria-labelledby="signature">
          <h2 id="signature">Signature awards</h2>
          <p className="muted">
            When you rate a teammate you pick one of these for them. Each person ends up with the award their
            teammates picked most (a tie goes to the one listed first).
          </p>
          <ul className="award-guide">
            {funnyAwards.map((a) => (
              <li key={a.id}>
                <span className={`award-guide-icon ${a.tone}`} aria-hidden="true">
                  <AwardIcon id={a.id} symbol={a.icon} />
                </span>
                <div>
                  <b>{a.title}</b>
                  <p>{a.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
