/*
 * Pick the signature award for the teammate being rated: a 3×3 grid of the nine awards. A
 * teammate ends up with whichever award their reviewers picked most (lib/ratingCore.ts).
 * Works like a set of radio buttons: click to pick, or arrow keys to move between them.
 */
import { useRef, type KeyboardEvent } from 'react';
import { funnyAwards } from '../../lib/ratingCore';
import { AwardIcon } from '../awards/AwardIcon';
import './Rating.css';

interface Props {
  name: string;
  value: string | null;
  onChange: (awardId: string) => void;
}

const COLUMNS = 3;

export function AwardPicker({ name, value, onChange }: Props) {
  const grid = useRef<HTMLDivElement>(null);
  const selected = funnyAwards.findIndex((a) => a.id === value);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (index + step + funnyAwards.length) % funnyAwards.length;
    onChange(funnyAwards[next].id);
    grid.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div className="award-picker">
      <div className="award-picker-head">
        <span className="award-picker-title" id="award-picker-label">
          Pick {name}’s award
        </span>
        <span className="muted small">They get whichever award their teammates pick most.</span>
      </div>
      <div className="award-grid" role="radiogroup" aria-labelledby="award-picker-label" ref={grid}>
        {funnyAwards.map((a, i) => {
          const checked = a.id === value;
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={checked}
              // Only one stop in the tab order: the picked award (or the first, if none yet).
              tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
              className={`award-option${checked ? ' selected' : ''}`}
              onClick={() => onChange(a.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className={`award-option-icon ${a.tone}`} aria-hidden="true">
                <AwardIcon id={a.id} symbol={a.icon} />
              </span>
              <span className="award-option-text">
                <strong>{a.title}</strong>
                <span>{a.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
