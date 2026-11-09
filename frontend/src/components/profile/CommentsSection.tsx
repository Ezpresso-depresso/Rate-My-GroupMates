/*
 * Written comments you've received. Pinned ones (up to 3) always show; the rest sit in a
 * collapsible list, newest first, revealed 10 at a time.
 */
import { useState } from 'react';
import { formatDate, MAX_PINS } from '../../lib/profile';
import type { ProfileData, ReceivedReview } from '../../types';
import { Stars } from '../common/Stars';
import { PinButton } from './PinButton';
import './Profile.css';

const PAGE = 10;

interface CommentsSectionProps {
  profile: ProfileData;
  onTogglePin: (id: string) => void;
}

export function CommentsSection({ profile, onTogglePin }: CommentsSectionProps) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const groupName = new Map(profile.groups.map((g) => [g.id, g.name]));
  const comments = profile.reviews.filter((r) => r.text); // already newest first
  const pinnedIds = new Set(profile.pinnedComments);
  // Keep the order you pinned them in.
  const pinned = profile.pinnedComments.flatMap((id) => comments.filter((c) => c.id === id));
  const rest = comments.filter((c) => !pinnedIds.has(c.id));
  const full = pinned.length >= MAX_PINS;

  const item = (c: ReceivedReview) => (
    <li key={c.id} className={`comment ${pinnedIds.has(c.id) ? 'pinned' : ''}`}>
      <div className="comment-head">
        <span>
          <b>{c.reviewerName ?? 'Anonymous teammate'}</b>
          <span className="muted small">
            {' '}
            · {groupName.get(c.teamId)} · {formatDate(c.submittedAt)}
          </span>
        </span>
        <Stars value={c.rating} />
        <PinButton pinned={pinnedIds.has(c.id)} full={full} label="comment" onToggle={() => onTogglePin(c.id)} />
      </div>
      <p>{c.text}</p>
    </li>
  );

  return (
    <section className="card profile-section" aria-labelledby="comments">
      <h2 id="comments">Comments</h2>
      {comments.length === 0 ? (
        <p className="muted">No written comments yet.</p>
      ) : (
        <>
          {pinned.length > 0 && <ul className="comment-list">{pinned.map(item)}</ul>}

          {rest.length > 0 && (
            <>
              <button type="button" className="expand-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {pinned.length > 0 ? 'Other comments' : 'All comments'} ({rest.length}) <span aria-hidden="true">{open ? '▴' : '▾'}</span>
              </button>
              {open && (
                <>
                  <ul className="comment-list">{rest.slice(0, shown).map(item)}</ul>
                  {shown < rest.length && (
                    <button type="button" className="textbtn show-more" onClick={() => setShown((n) => n + PAGE)}>
                      Show {Math.min(PAGE, rest.length - shown)} more
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <p className="muted small pin-hint">Pin up to {MAX_PINS} comments to keep them at the top.</p>
        </>
      )}
    </section>
  );
}
