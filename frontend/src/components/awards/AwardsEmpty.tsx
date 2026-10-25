import { Link } from 'react-router-dom';
import './Awards.css';

export function AwardsEmpty() {
  return (
    <section className="card awards-empty">
      <div className="empty-award">✦</div>
      <div className="eyebrow">A little suspense is a good thing.</div>
      <h1>The awards are waiting.</h1>
      <p>
        Give every teammate their ratings.
        <br />
        Then come back for the reveal.
      </p>
      <Link className="btn" to="/">
        Continue rating →
      </Link>
    </section>
  );
}
