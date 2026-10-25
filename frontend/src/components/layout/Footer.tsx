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
        Sample peer reviews · Changes stay in this browser
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
