import type { Member } from '../../types';
import { Avatar } from '../common/Avatar';
import './Rating.css';

interface TeammateTabsProps {
  teammates: Member[];
  activeId: string;
  isReady: (id: string) => boolean;
  onSelect: (index: number) => void;
}

export function TeammateTabs({ teammates, activeId, isReady, onSelect }: TeammateTabsProps) {
  const done = teammates.filter((t) => isReady(t.id)).length;

  return (
    <div className="teammate-tabs" role="group" aria-label="Choose a teammate">
      {teammates.map((t, i) => {
        const active = t.id === activeId;
        const ready = isReady(t.id);
        return (
          <button
            key={t.id}
            className={`teammate-tab ${active ? 'active' : ''}`}
            aria-current={active || undefined}
            onClick={() => onSelect(i)}
          >
            <Avatar member={t} />
            <span>
              {t.name}
              <small>{ready ? 'Review ready' : `Teammate ${i + 1} of ${teammates.length}`}</small>
            </span>
            <span className="tab-check">{ready ? '✓' : ''}</span>
          </button>
        );
      })}
      <span className="flow-completion">
        {done}/{teammates.length} reviews ready
      </span>
    </div>
  );
}
