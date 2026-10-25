import type { Team } from '../../types';
import { Avatar } from './Avatar';
import './Common.css';

interface MemberPickerProps {
  team: Team;
  onSelect: (memberId: string) => void;
}

/** "Who are you?" screen. Stand-in for login: the choice is remembered in this browser. */
export function MemberPicker({ team, onSelect }: MemberPickerProps) {
  return (
    <main className="status-screen">
      <div className="card member-picker">
        <div className="eyebrow">
          {team.name} · {team.course}
        </div>
        <h2>Who are you?</h2>
        <p className="muted">Pick your name to rate the rest of your team.</p>
        <div className="member-options">
          {team.members.map((m) => (
            <button key={m.id} className="member-option" onClick={() => onSelect(m.id)}>
              <Avatar member={m} size={40} />
              {m.name}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
