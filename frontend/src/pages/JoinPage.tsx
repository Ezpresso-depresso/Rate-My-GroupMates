/* /join/:teamId — where invite links land. Enter the group's code to accept. */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { groupPath, ownerOf, viewerOf } from '../lib/teams';
import { api, type ApiError } from '../services/api';
import type { Team } from '../types';
import '../components/groups/Groups.css';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; status: number }
  | { kind: 'ready'; team: Team };

export function JoinPage() {
  const { teamId = '' } = useParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'accept' | 'decline'>('');

  useEffect(() => {
    let ignore = false;
    api
      .getTeam(teamId)
      .then((team) => !ignore && setState({ kind: 'ready', team }))
      .catch((err: ApiError) => {
        if (!ignore) setState({ kind: 'error', message: err.message, status: err.status });
      });
    return () => {
      ignore = true;
    };
  }, [teamId, attempt]);

  if (state.kind === 'loading') return <p className="muted">Opening your invite…</p>;
  if (state.kind === 'error')
    return (
      <div className="card form-card join-card" role="alert">
        <h2>Can’t open this invite</h2>
        <p className="muted">{state.message}</p>
        <div className="form-actions">
          {state.status === 403 ? (
            <button className="btn" onClick={signOut}>
              Use a different Google account
            </button>
          ) : state.status === 400 || state.status === 404 ? null : (
            <button
              className="btn"
              onClick={() => {
                setState({ kind: 'loading' });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          )}
          <Link className="textbtn" to="/">
            My groups
          </Link>
        </div>
      </div>
    );

  const { team } = state;
  if (viewerOf(team, user)?.status === 'accepted') return <Navigate to={groupPath(team.id)} replace />;
  const owner = ownerOf(team);

  const accept = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return setError('Enter the code from whoever invited you');
    setBusy('accept');
    setError('');
    try {
      await api.acceptInvite(team.id, code);
      navigate(groupPath(team.id), { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
      setBusy('');
    }
  };

  const decline = async () => {
    if (!window.confirm(`Decline the invite to “${team.name}”?`)) return;
    setBusy('decline');
    setError('');
    try {
      await api.leaveTeam(team.id);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
      setBusy('');
    }
  };

  return (
    <form className="card form-card join-card" onSubmit={accept} noValidate>
      <div>
        <div className="eyebrow">You’ve been summoned</div>
        <h2>
          {owner?.name ?? 'Someone'} invited you to {team.name}
        </h2>
        <p className="muted">
          {team.course} · {team.members.length} people. Enter the invite code they sent you to join.
        </p>
      </div>
      <label className="field">
        <span>Invite code</span>
        <input
          className="input code-input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError('');
          }}
          placeholder="K7QX2P"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
          aria-invalid={Boolean(error)}
        />
      </label>
      <p className="error" role="alert">
        {error}
      </p>
      <div className="form-actions">
        <button className="btn" disabled={Boolean(busy)}>
          {busy === 'accept' ? 'Joining…' : 'Join group'}
        </button>
        <button type="button" className="btn-danger" onClick={decline} disabled={Boolean(busy)}>
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </form>
  );
}
