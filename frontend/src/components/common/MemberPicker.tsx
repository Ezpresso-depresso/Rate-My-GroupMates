import { useState, type FormEvent } from 'react';
import { api } from '../../services/api';
import type { Team } from '../../types';
import { Avatar } from './Avatar';
import './Common.css';

interface MemberPickerProps {
  team: Team;
  onSelect: (memberId: string) => void;
}

/** "Who are you?" screen. Stand-in for login: the choice is remembered in this browser. */
export function MemberPicker({ team, onSelect }: MemberPickerProps) {
  // PLAYTEST ONLY: "join as a new member" form state. Remove with the form below.
  const [name, setName] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError('');
    try {
      const member = await api.joinTeam(team.id, name);
      onSelect(member.id); // changing the member reloads the team, so the new member shows up
    } catch (err) {
      setJoinError((err as Error).message);
      setJoining(false);
    }
  };

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
        {/* PLAYTEST ONLY: lets each tester join as their own member. Remove once real auth exists. */}
        <form className="member-join" onSubmit={join}>
          <p className="muted">Not listed? Join as a new member:</p>
          <div className="member-join-row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} />
            <button className="btn" disabled={joining || !name.trim()}>
              Join
            </button>
          </div>
          {joinError && <p className="error">{joinError}</p>}
        </form>
      </div>
    </main>
  );
}
