import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isEmail, splitEmails } from '../lib/emails';
import { groupPath } from '../lib/teams';
import { api, type ApiError } from '../services/api';
import '../components/groups/Groups.css';

const MAX_LENGTH = 80;

export function CreateGroupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  const [emailText, setEmailText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parsed = splitEmails(emailText);
  const invalid = parsed.filter((e) => !isEmail(e));
  const invites = parsed.filter((e) => isEmail(e) && e !== user.email);
  const includesSelf = parsed.includes(user.email);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give your group a name');
    if (!course.trim()) return setError('Which course is this for?');
    if (invalid.length) return setError(`Fix or remove ${invalid.map((x) => `“${x}”`).join(', ')}`);
    if (invites.length === 0) return setError('Invite at least one teammate (not counting yourself)');

    setSaving(true);
    setError('');
    try {
      const team = await api.createTeam({ name: name.trim(), course: course.trim(), emails: invites });
      navigate(groupPath(team.id), { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">New group</div>
          <h1>Assemble the squad</h1>
        </div>
      </div>

      <form className="card form-card" onSubmit={submit} noValidate>
        <label className="field">
          <span>Group name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group 16"
            maxLength={MAX_LENGTH}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Course</span>
          <input
            className="input"
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="INF 151"
            maxLength={MAX_LENGTH}
          />
        </label>
        <label className="field">
          <span>Teammates’ emails</span>
          <textarea
            className="input"
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            placeholder={'kent@uci.edu\nomar@uci.edu, qitai@uci.edu'}
            aria-invalid={invalid.length > 0}
            aria-describedby="email-help"
          />
          <small id="email-help" className="muted">
            One per line or separated by commas. Use the Google account each person will sign in with. You’re added
            automatically.
          </small>
        </label>

        {parsed.length > 0 && (
          <ul className="email-chips" aria-label="Emails to invite">
            {parsed.map((e) => (
              <li key={e} className={!isEmail(e) ? 'bad' : e === user.email ? 'skip' : undefined}>
                {e}
                {!isEmail(e) && ' · not an email'}
                {e === user.email && ' · that’s you'}
              </li>
            ))}
          </ul>
        )}

        <p className="error" role="alert">
          {error}
        </p>
        <div className="form-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'Creating…' : `Create group${invites.length ? ` & invite ${invites.length}` : ''}`}
          </button>
          <Link className="textbtn" to="/">
            Cancel
          </Link>
          {includesSelf && <span className="muted small">(You’re already in it, no need to invite yourself.)</span>}
        </div>
      </form>
    </>
  );
}
