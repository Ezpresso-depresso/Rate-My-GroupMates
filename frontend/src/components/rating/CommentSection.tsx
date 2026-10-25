import { MAX_COMMENT_LENGTH } from '../../lib/ratingCore';
import type { ReviewDraft } from '../../types';
import './Rating.css';

interface CommentSectionProps {
  name: string;
  draft: ReviewDraft;
  onChange: (patch: Partial<ReviewDraft>) => void;
}

export function CommentSection({ name, draft, onChange }: CommentSectionProps) {
  return (
    <section className="comment-section">
      <h3>
        A little context <span>Optional</span>
      </h3>
      <textarea
        maxLength={MAX_COMMENT_LENGTH}
        aria-label="Optional feedback"
        placeholder={`One thing ${name} did well, or could do differently…`}
        value={draft.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <div className="comment-meta">
        <span>Specific feedback goes a long way.</span>
        <span>
          {draft.text.length}/{MAX_COMMENT_LENGTH}
        </span>
      </div>
      <label className="toggle-line">
        <input
          type="checkbox"
          role="switch"
          checked={draft.anonymous}
          onChange={(e) => onChange({ anonymous: e.target.checked })}
        />
        <span>
          Make review anonymous
          <small>Your name is hidden in the review display.</small>
        </span>
      </label>
    </section>
  );
}
