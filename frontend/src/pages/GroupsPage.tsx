import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { useAuth } from '../hooks/useAuth';
import { acceptedCount, groupPath, joinPath, ownerOf, PENDING_COLOR } from '../lib/teams';
import { readStorage, writeStorage } from '../lib/storage';
import { advanceTour, useTour } from '../lib/tour';
import { api, type ApiError } from '../services/api';
import type { Team } from '../types';
import '../components/groups/Groups.css';

/** Whether Past groups is collapsed, remembered in this browser. */
const PAST_COLLAPSED_KEY = 'rmg-past-groups-collapsed';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; teams: Team[] };

export function GroupsPage() {
  const { user } = useAuth();
  const { step } = useTour();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [declining, setDeclining] = useState('');
  const [error, setError] = useState('');
  const [pastCollapsed, setPastCollapsed] = useState(() => readStorage(PAST_COLLAPSED_KEY, false));

  const togglePast = () => {
    setPastCollapsed((collapsed) => {
      writeStorage(PAST_COLLAPSED_KEY, !collapsed || undefined); // stored only while collapsed
      return !collapsed;
    });
  };

  useEffect(() => {
    let ignore = false;
    api
      .getTeams()
      .then((teams) => !ignore && setState({ kind: 'ready', teams }))
      .catch((err: ApiError) => !ignore && setState({ kind: 'error', message: err.message }));
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const reload = () => {
    setState({ kind: 'loading' });
    setAttempt((a) => a + 1);
  };

  const decline = async (team: Team) => {
    if (!window.confirm(`Decline the invite to “${team.name}”?`)) return;
    setDeclining(team.id);
    setError('');
    try {
      await api.leaveTeam(team.id);
      setState((s) => (s.kind === 'ready' ? { ...s, teams: s.teams.filter((t) => t.id !== team.id) } : s));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setDeclining('');
    }
  };

  if (state.kind === 'loading')
    return (
      <div className="page-panel">
        <p className="muted">Loading your groups…</p>
      </div>
    );
  if (state.kind === 'error')
    return (
      <div className="page-panel">
        <div className="card empty-groups" role="alert">
          <h2>Couldn’t load your groups</h2>
          <p className="muted">{state.message}</p>
          <button className="btn" onClick={reload}>
            Try again
          </button>
        </div>
      </div>
    );

  const invites = state.teams.filter((t) => t.todo === 'accept');
  const groups = state.teams.filter((t) => t.todo !== 'accept');
  // Active: waiting for people to join, or reviews open and you still have to rate. Past: you've rated.
  const active = groups.filter((t) => !isDone(t));
  const past = groups.filter(isDone);

  return (
    <div className="page-panel">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Hi {user.name}</div>
          <h1>Your groups</h1>
        </div>
        <span className="nudge-anchor">
          <Link className="btn" to="/groups/new" onClick={() => advanceTour('group', null)}>
            + New group
          </Link>
          {step === 'group' && <span className="nudge nudge-wide nudge-right">Make a group!</span>}
        </span>
      </div>

      <p className="error" role="alert">
        {error}
      </p>

      {invites.length > 0 && (
        <>
          <h2 className="section-title">Invitations</h2>
          <ul className="invite-list">
            {invites.map((team) => (
              <li key={team.id} className="card invite-card">
                <div>
                  <h3>{team.name}</h3>
                  <span className="muted small">
                    {ownerOf(team)?.name ?? 'Someone'} invited you · {team.course}
                  </span>
                  {team.message && <p className="invite-message">“{team.message}”</p>}
                </div>
                <div className="invite-actions">
                  <button className="btn-danger" onClick={() => decline(team)} disabled={declining === team.id}>
                    {declining === team.id ? 'Declining…' : 'Decline'}
                  </button>
                  <Link className="btn" to={joinPath(team.id)}>
                    Accept →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {groups.length === 0 ? (
        <>
          {invites.length > 0 && <h2 className="section-title">Groups</h2>}
          <div className="card empty-groups">
            <h2>No groups yet</h2>
            <p className="muted">
              Start one and invite your teammates, or ask whoever’s in charge to invite <strong>{user.email}</strong>.
            </p>
          </div>
        </>
      ) : (
        <>
          <section aria-labelledby="active-groups">
            <h2 className="section-title" id="active-groups">
              Active groups <span className="section-count">{active.length}</span>
            </h2>
            {active.length === 0 ? (
              <p className="muted groups-none">Nothing in progress. Start a new group whenever you’re ready.</p>
            ) : (
              <GroupGrid teams={active} />
            )}
          </section>

          {past.length > 0 && (
            <section aria-labelledby="past-groups">
              <h2 className="section-title" id="past-groups">
                <button type="button" className="section-toggle" aria-expanded={!pastCollapsed} onClick={togglePast}>
                  <span className="section-chevron" aria-hidden="true">
                    ▾
                  </span>
                  Past groups <span className="section-count">{past.length}</span>
                </button>
              </h2>
              {!pastCollapsed && <GroupGrid teams={past} />}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GroupGrid({ teams }: { teams: Team[] }) {
  return (
    <ul className="group-grid">
      {teams.map((team) => (
        <li key={team.id}>
          {/* Finished groups ("Done ✓ · see awards") open straight to their awards. */}
          <Link className="card group-card" to={isDone(team) ? `${groupPath(team.id)}/awards` : groupPath(team.id)}>
            <div>
              <h3>{team.name}</h3>
              <span className="muted small">{team.course}</span>
            </div>
            <div className="avatar-stack" aria-hidden="true">
              {team.members.map((m) => (
                <Avatar key={m.id} member={m.status === 'accepted' ? m : { ...m, color: PENDING_COLOR }} size={30} />
              ))}
            </div>
            <GroupStatus team={team} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Reviews are open and you've already submitted yours. */
const isDone = (team: Team) => team.status === 'reviewing' && team.todo !== 'review';

function GroupStatus({ team }: { team: Team }) {
  if (team.status === 'pending')
    return (
      <span className="pill-status">
        Waiting · {acceptedCount(team)}/{team.members.length} joined
      </span>
    );
  if (!isDone(team)) return <span className="pill-status todo">To do: rate your teammates</span>;
  return <span className="pill-status ok">Done ✓ · see awards</span>;
}
