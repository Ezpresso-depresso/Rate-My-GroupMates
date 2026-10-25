import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { CommentSection } from '../components/rating/CommentSection';
import { LiveResult } from '../components/rating/LiveResult';
import { OverallRating } from '../components/rating/OverallRating';
import { ScoreField } from '../components/rating/ScoreField';
import { TeammateTabs } from '../components/rating/TeammateTabs';
import { useReviews } from '../hooks/useReviews';
import { categories, incoming, summary, valid } from '../lib/ratingCore';
import type { ReviewDraft } from '../types';

export function RatePage() {
  const { team, currentUser, teammates, reviews, draftFor, updateDraft, submitAll } = useReviews();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(() => {
    const firstIncomplete = teammates.findIndex((t) => !valid(draftFor(t.id)));
    return firstIncomplete === -1 ? 0 : firstIncomplete;
  });
  const [error, setError] = useState('');

  const member = teammates[activeIndex];
  const draft = draftFor(member.id);
  const isLast = activeIndex === teammates.length - 1;

  // Peer reviews plus the current draft, so the result reacts as you rate.
  const preview = summary([...incoming(reviews, member.id).filter((r) => r.reviewerId !== currentUser.id), draft]);

  const change = (patch: Partial<ReviewDraft>) => {
    setError('');
    updateDraft(member.id, patch);
  };

  const goTo = (index: number) => {
    setError('');
    setActiveIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const next = () => {
    if (!valid(draft)) {
      setError(!draft.rating ? 'Choose an overall star rating to continue.' : 'Choose a score in every category to continue.');
      return;
    }
    if (!isLast) return goTo(activeIndex + 1);

    const incompleteId = submitAll();
    if (incompleteId) {
      setActiveIndex(teammates.findIndex((t) => t.id === incompleteId));
      setError('Finish this teammate’s star rating and category scores first.');
      return;
    }
    navigate('/awards', { state: { celebrate: true } });
  };

  return (
    <>
      <div className="flow-heading">
        <div>
          <div className="eyebrow">Don't take this too seriously</div>
          <h1>
            Leave a rating
            <br />
            <span>Just know that we're selling this data ASAP</span>
          </h1>
        </div>
        <p>
          Awards calculated algorithmically based on ratings
          <br />
          This database is not secure
        </p>
      </div>

      <TeammateTabs
        teammates={teammates}
        activeId={member.id}
        isReady={(id) => valid(draftFor(id))}
        onSelect={goTo}
      />

      <div className="rating-layout">
        <section className="card rating-editor">
          <div className="member-heading">
            <Avatar member={member} size={73} />
            <div>
              <div className="eyebrow">Rating your teammate</div>
              <h2>{member.name}</h2>
              <span className="muted small">
                {team.name} · {team.course}
              </span>
            </div>
          </div>

          <OverallRating value={draft.rating} onChange={(rating) => change({ rating })} />

          <div className="category-intro">
            <span className="eyebrow">A closer look</span>
            <span>1 = needs improvement · 10 = exceptional</span>
          </div>
          {categories.map((c) => (
            <ScoreField
              key={c.key}
              category={c}
              value={draft.scores[c.key]}
              onChange={(v) => change({ scores: { ...draft.scores, [c.key]: v } })}
            />
          ))}

          <CommentSection name={member.name} draft={draft} onChange={change} />

          <p className="error" role="alert">
            {error}
          </p>
          <div className="editor-actions">
            <button className="textbtn" disabled={activeIndex === 0} onClick={() => goTo(activeIndex - 1)}>
              ← Previous
            </button>
            <button className="btn" onClick={next}>
              {isLast ? 'Reveal team awards ✦' : 'Next teammate →'}
            </button>
          </div>
          <div className="autosave">
            <span className="live-dot" />
            Saved as you go. Nothing is submitted until you reveal awards.
          </div>
        </section>

        <LiveResult member={member} summary={preview} hasDraft={draft.rating > 0} />
      </div>
    </>
  );
}
