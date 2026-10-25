import { starHints } from '../../lib/ratingCore';
import './Rating.css';

interface OverallRatingProps {
  value: number;
  onChange: (value: number) => void;
}

export function OverallRating({ value, onChange }: OverallRatingProps) {
  return (
    <section className="overall-panel">
      <h3>
        Overall rating <span>Your call, 1–5 stars</span>
      </h3>
      <div className="starline">
        <div className="rating-buttons" role="group" aria-label="Overall rating">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              className={v <= value ? 'on' : ''}
              aria-pressed={v === value}
              aria-label={`${v} out of 5 stars`}
              onClick={() => onChange(v)}
            >
              {v <= value ? '★' : '☆'}
            </button>
          ))}
        </div>
        <span className="rating-hint">{starHints[value]}</span>
      </div>
    </section>
  );
}
