import type { Category } from '../../types';
import './Rating.css';

interface ScoreFieldProps {
  category: Category;
  value?: number;
  onChange: (value: number) => void;
}

export function ScoreField({ category: c, value = 0, onChange }: ScoreFieldProps) {
  const labelId = `label-${c.key}`;

  return (
    <section className="score-field" aria-labelledby={labelId}>
      <div className="score-title">
        <span id={labelId}>{c.name}</span>
        <output>
          {value || '—'}
          <small>/ 10</small>
        </output>
      </div>
      <p>{c.hint}</p>
      <div className="score-choices" role="group" aria-label={`${c.name} score`}>
        {Array.from({ length: 10 }, (_, n) => n + 1).map((v) => (
          <button
            key={v}
            type="button"
            className={v === value ? 'selected' : v < value ? 'below' : ''}
            aria-pressed={v === value}
            aria-label={`${c.name}: ${v} out of 10`}
            onClick={() => onChange(v)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="scale-label">
        <span>1 · Room to grow</span>
        <span>Above and beyond · 10</span>
      </div>
    </section>
  );
}
