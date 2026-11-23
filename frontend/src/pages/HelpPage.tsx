/* Help (from the account menu): start or end the guided tour, read about awards, find the privacy policy and terms. */
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { currentClassCount } from '../lib/classCount';
import { endTour, startTour, useTour } from '../lib/tour';
import '../components/groups/Groups.css';
import './InfoPages.css';

export function HelpPage() {
  const { user } = useAuth();
  const running = useTour().step !== null;

  // Starts the tour right here: its first pop-up appears on the navbar's My Profile tab.
  const tour = () => startTour(user.id, currentClassCount());

  return (
    <div className="page-panel info-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Help</div>
          <h1>Getting around</h1>
        </div>
      </div>

      <div className="info-cards">
        <section className="card form-card">
          {/* The "in progress" pill sits beside the heading, so it never moves the buttons. */}
          <div className="tour-head">
            <h2>Guided tour</h2>
            {running && (
              <span className="tour-status" role="status">
                The guided tour is in progress.
              </span>
            )}
          </div>
          <p className="muted">
            A few quick pop-ups walk you through the basics: adding your classes, finding groupmates, and making a group.
          </p>
          <div className="form-actions">
            <button type="button" className="btn" onClick={tour}>
              {running ? 'Restart the guided tour' : 'Start the guided tour'}
            </button>
            {running && (
              <button type="button" className="btn btn-quiet" onClick={endTour}>
                End the guided tour
              </button>
            )}
          </div>
        </section>

        <section className="card form-card">
          <h2>Awards</h2>
          <p className="muted">What each award, tier and badge means, and how they’re worked out from your ratings.</p>
          <div className="form-actions">
            <Link className="btn btn-quiet" to="/about-awards">
              About awards →
            </Link>
          </div>
        </section>
      </div>

      <nav className="help-legal" aria-label="Legal">
        <Link to="/privacy">Privacy policy</Link>
        <span aria-hidden="true">·</span>
        <Link to="/terms">Terms of use</Link>
      </nav>
    </div>
  );
}
