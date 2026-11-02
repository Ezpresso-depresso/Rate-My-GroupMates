/*
 * Waiting room for a group whose reviews haven't started: who has joined, the
 * invite link + code to share, and (for the creator) managing invites.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isEmail, splitEmails } from '../../lib/emails';
import { acceptedCount, joinUrl } from '../../lib/teams';
import { api, type ApiError } from '../../services/api';
import type { Team } from '../../types';
import { CopyField } from './CopyField';
import { MemberRow } from './MemberRow';
import './Groups.css';

interface GroupLobbyProps {
  team: Team;
  /** Shown when the background re-check is failing. */
  pollError: string;
  onChange: (team: Team) => void;
  /** The group can't be shown anymore (deleted, or you were removed). */
  onGone: (message: string) => void;
}

export function GroupLobby({ team, pollError, onChange, onGone }: GroupLobbyProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = team.owner === user.id;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const joined = acceptedCount(team);
  const total = team.members.length;
  const waitingOn = total - joined;

  /** Runs one action at a time and reports failures in the lobby's error line. */
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try {
      await action();
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 404) onGone(e.message);
      else setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const cancelInvite = (memberId: string, email: string) => {
    if (!window.confirm(`Cancel ${email}’s invite?`)) return;
    run(`cancel:${memberId}`, async () => onChange(await api.cancelInvite(team.id, memberId)));
  };

  const newCode = () => {
    if (!window.confirm('Make a new code? The current one stops working right away, so anyone who hasn’t joined will need the new one.')) return;
    run('code', async () => onChange(await api.regenerateCode(team.id)));
  };

  const deleteGroup = () => {
    if (!window.confirm(`Delete “${team.name}” for everyone? This can’t be undone.`)) return;
    run('delete', async () => {
      await api.deleteTeam(team.id);
      navigate('/', { replace: true });
    });
  };

  const leaveGroup = () => {
    if (!window.confirm(`Leave “${team.name}”? You’d need a new invite to come back.`)) return;
    run('leave', async () => {
      await api.leaveTeam(team.id);
      navigate('/', { replace: true });
    });
  };

  return (
    <div className="lobby">
      <div className="lobby-heading">
        <div className="eyebrow">Waiting room · {team.course}</div>
        <h1>{team.name}</h1>
        <p className="muted">
          {waitingOn === 0
            ? 'Everyone else declined, so it’s just you. Rating yourself is not allowed (nice try). Invite at least one more person below.'
            : `Reviews unlock once everyone has joined. ${waitingOn === 1 ? 'One person is' : `${waitingOn} people are`} still “on their way”.`}
        </p>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={joined}>
          <span style={{ width: `${(joined / total) * 100}%` }} />
        </div>
        <p className="small muted">
          {joined} of {total} joined · this page updates on its own
        </p>
        {pollError && <p className="notice">{pollError}</p>}
      </div>

      <div className="lobby-grid">
        <section className="card lobby-card">
          <h2>Invite your group</h2>
          <p className="muted small">
            Send everyone the link <em>and</em> the code. They have to sign in with the exact email you invited.
          </p>
          <CopyField label="Invite link" value={joinUrl(team.id)} />
          {team.inviteCode && <CopyField label="Invite code" value={team.inviteCode} mono />}
          {isOwner && (
            <button className="textbtn" onClick={newCode} disabled={Boolean(busy)}>
              {busy === 'code' ? 'Making a new code…' : 'Make a new code'}
            </button>
          )}
        </section>

        <section className="card lobby-card">
          <h2>Members</h2>
          <ul className="member-list">
            {team.members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                tags={
                  <>
                    {m.userId === team.owner && <span className="tag">creator</span>}
                    {m.userId === user.id && <span className="tag">you</span>}
                  </>
                }
                action={
                  isOwner && m.status === 'invited' ? (
                    <button
                      className="btn-danger small"
                      onClick={() => cancelInvite(m.id, m.email)}
                      disabled={Boolean(busy)}
                      aria-label={`Cancel ${m.email}’s invite`}
                    >
                      {busy === `cancel:${m.id}` ? 'Cancelling…' : 'Cancel invite'}
                    </button>
                  ) : undefined
                }
              />
            ))}
          </ul>
          {isOwner && <AddInvites team={team} disabled={Boolean(busy)} onChange={onChange} onGone={onGone} />}
        </section>
      </div>

      <p className="error" role="alert">
        {error}
      </p>

      <div className="lobby-footer">
        {isOwner ? (
          <button className="btn-danger" onClick={deleteGroup} disabled={Boolean(busy)}>
            {busy === 'delete' ? 'Deleting…' : 'Delete group'}
          </button>
        ) : (
          <button className="btn-danger" onClick={leaveGroup} disabled={Boolean(busy)}>
            {busy === 'leave' ? 'Leaving…' : 'Leave group'}
          </button>
        )}
      </div>
    </div>
  );
}

function AddInvites({
  team,
  disabled,
  onChange,
  onGone,
}: {
  team: Team;
  disabled: boolean;
  onChange: (team: Team) => void;
  onGone: (message: string) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const emails = splitEmails(text);
    if (emails.length === 0) return setError('Type at least one email');
    const bad = emails.find((x) => !isEmail(x));
    if (bad) return setError(`“${bad}” isn’t a valid email address`);
    const existing = new Set(team.members.map((m) => m.email));
    const fresh = emails.filter((x) => !existing.has(x));
    if (fresh.length === 0) return setError('Everyone you listed is already in this group');

    setSaving(true);
    setError('');
    try {
      onChange(await api.addInvites(team.id, fresh));
      setText('');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 404) onGone(apiErr.message);
      else setError(apiErr.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="add-invites" onSubmit={submit} noValidate>
      <label className="field">
        <span>Invite more people</span>
        <div className="copy-row">
          <input
            className="input"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            placeholder="name@uci.edu, another@uci.edu"
            aria-invalid={Boolean(error)}
          />
          <button className="btn" disabled={disabled || saving}>
            {saving ? 'Inviting…' : 'Invite'}
          </button>
        </div>
      </label>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
