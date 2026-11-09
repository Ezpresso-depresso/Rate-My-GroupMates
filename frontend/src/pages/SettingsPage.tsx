import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PASSWORD_MIN, passwordProblem } from '../lib/passwords';
import { api, type ApiError } from '../services/api';
import '../components/groups/Groups.css';

export function SettingsPage() {
  const { user, replaceSession } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (!current) return setError('Enter your current password');
    const problem = passwordProblem(next, user.email);
    if (problem) return setError(problem);
    if (next !== confirm) return setError('The new passwords don’t match');
    if (next === current) return setError('Your new password is the same as your current one');

    setSaving(true);
    setError('');
    try {
      replaceSession(await api.changePassword(current, next));
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>{user.fullName || user.name}</h1>
          <span className="muted">{user.email}</span>
        </div>
      </div>

      <form className="card form-card" onSubmit={submit} noValidate>
        <h2>Change password</h2>
        <label className="field">
          <span>Current password</span>
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            aria-describedby="new-password-hint"
          />
        </label>
        <small id="new-password-hint" className="muted">
          At least {PASSWORD_MIN} characters. Changing it signs you out on your other devices.
        </small>
        <label className="field">
          <span>Confirm new password</span>
          <input
            className="input"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>

        <p className="error" role="alert">
          {error}
        </p>
        {done && (
          <p className="notice ok-notice" role="status">
            Password changed ✓
          </p>
        )}
        <div className="form-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
          <Link className="textbtn" to="/">
            Back to my groups
          </Link>
        </div>
      </form>
    </>
  );
}
