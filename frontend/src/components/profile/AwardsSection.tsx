/* "My Awards": everything you've earned, newest first, with up to 3 pinned at the top. */
import { useState } from 'react';
import { formatDate, MAX_PINS, type ProfileAward } from '../../lib/profile';
import { AwardRules } from '../awards/AwardRules';
import { Modal } from '../common/Modal';
import { PinButton } from './PinButton';
import './Profile.css';

interface AwardsSectionProps {
  awards: ProfileAward[];
  pinnedKeys: string[];
  onTogglePin: (key: string) => void;
}

export function AwardsSection({ awards, pinnedKeys, onTogglePin }: AwardsSectionProps) {
  const [showRules, setShowRules] = useState(false);

  const pinnedSet = new Set(pinnedKeys);
  // Pins whose award changed or disappeared (e.g. new reviews came in) just drop out.
  const pinned = pinnedKeys.flatMap((key) => awards.filter((a) => a.key === key));
  const rest = awards.filter((a) => !pinnedSet.has(a.key));
  const full = pinned.length >= MAX_PINS;

  const item = (a: ProfileAward) => (
    <li key={a.key} className={`award-item ${pinnedSet.has(a.key) ? 'pinned' : ''}`}>
      <span className={`seal ${a.tone}`} aria-hidden="true">
        {a.icon}
      </span>
      <div>
        <b>{a.title}</b>
        <p className="muted small">{a.desc}</p>
        <span className="muted small">
          {a.groupName} · {a.course} · {formatDate(a.receivedAt)}
        </span>
      </div>
      <PinButton pinned={pinnedSet.has(a.key)} full={full} label={a.title} onToggle={() => onTogglePin(a.key)} />
    </li>
  );

  return (
    <section className="card profile-section" aria-labelledby="my-awards">
      <div className="section-head">
        <h2 id="my-awards">My Awards</h2>
        <button type="button" className="textbtn small" onClick={() => setShowRules(true)}>
          How are awards calculated?
        </button>
      </div>
      {awards.length === 0 ? (
        <p className="muted">No awards yet. Finish rating your teammates in a group to see what you’ve earned.</p>
      ) : (
        <>
          {pinned.length > 0 && <ul className="award-list pinned-list">{pinned.map(item)}</ul>}
          <ul className="award-list">{rest.map(item)}</ul>
          <p className="muted small pin-hint">Pin up to {MAX_PINS} awards to keep them at the top.</p>
        </>
      )}
      {showRules && (
        <Modal label="How awards work" onClose={() => setShowRules(false)}>
          <AwardRules />
        </Modal>
      )}
    </section>
  );
}
