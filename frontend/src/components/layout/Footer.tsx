import { useState } from 'react';
import { AwardRules } from '../awards/AwardRules';
import { Modal } from '../common/Modal';
import './Layout.css';

export function Footer({ teamName }: { teamName: string }) {
  const [showRules, setShowRules] = useState(false);

  return (
    <footer className="site-footer">
      <span>
        {teamName} · Review &amp; awards
        <br />
        Drafts stay in this browser until you submit
      </span>
      <button className="textbtn" onClick={() => setShowRules(true)}>
        How awards work
      </button>
      {showRules && (
        <Modal label="How awards work" onClose={() => setShowRules(false)}>
          <AwardRules />
        </Modal>
      )}
    </footer>
  );
}
