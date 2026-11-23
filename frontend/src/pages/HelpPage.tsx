/* Help (from the account menu): start or end the guided tour, or read about awards. */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { currentClassCount } from '../lib/classCount';
import { endTour, startTour, useTour } from '../lib/tour';
import '../components/groups/Groups.css';
import './InfoPages.css';

export function HelpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const running = useTour().step !== null;

  const tour = () => {
    startTour(user.id, currentClassCount());
    navigate('/profile'); // the tour's first step lives on the profile
  };

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
          <h2>Guided tour</h2>
          <p className="muted">
            A few quick pop-ups walk you through the basics: adding your classes, finding groupmates, and making a group.
          </p>
          {running && (
            <p className="tour-status" role="status">
              The guided tour is in progress.
            </p>
          )}
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
    </div>
  );
}
