import { Component, lazy, Suspense, useRef, useState, type ReactNode } from 'react';
import { useReviews } from '../../hooks/useReviews';

const AfterpartyPanel = lazy(() => import('./AfterpartyPanel'));

class GameBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="notice" role="alert">
      <p>The game couldn’t load. Your awards are still available above. Refresh the page before trying the game again.</p>
      <button className="textbtn" onClick={this.props.onClose}>Close game</button>
    </div> : this.props.children;
  }
}

/** The only addition to the existing awards UI. Nothing mounts until requested. */
export function AfterpartyEntry() {
  const { hasSubmitted } = useReviews();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  if (!hasSubmitted) return null;
  const close = () => { setOpen(false); button.current?.focus(); };

  return <section aria-label="Optional afterparty">
    <div className="closing-card">
      <span className="closing-star" aria-hidden="true">✦</span>
      <div><h3>One more thing: the afterparty.</h3><p>An optional friendly brawl with your group, after the awards.</p></div>
      <button ref={button} className="btn" aria-expanded={open} aria-controls={open ? 'afterparty-panel' : undefined}
        onClick={() => setOpen(value => !value)}>{open ? 'Close Afterparty' : 'Enter Afterparty'} ↗</button>
    </div>
    {open && <GameBoundary onClose={close}><Suspense fallback={<p role="status">Opening the afterparty…</p>}>
      <AfterpartyPanel onClose={close} />
    </Suspense></GameBoundary>}
  </section>;
}
