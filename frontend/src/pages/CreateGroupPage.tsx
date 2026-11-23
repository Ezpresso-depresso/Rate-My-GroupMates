import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CoursePicker } from '../components/groups/CoursePicker';
import { TeammateEmailField } from '../components/groups/TeammateEmailField';
import { useAuth } from '../hooks/useAuth';
import { isEmail, normalizeEmail, splitEmails } from '../lib/emails';
import { groupPath } from '../lib/teams';
import { api, type ApiError } from '../services/api';
import '../components/groups/Groups.css';

const MAX_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 300; // keep in sync with backend/src/config/constants.ts

interface Row {
  id: number;
  value: string;
}
let nextRowId = 0;
const newRow = (value = ''): Row => ({ id: nextRowId++, value });

export function CreateGroupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [course, setCourse] = useState('');
  /** One entry per teammate row (ids keep rows apart when one is removed); starts with one empty row. */
  const [rows, setRows] = useState<Row[]>(() => [newRow()]);
  const emails = rows.map((r) => r.value);
  /** The row to focus after "+ Add another teammate". */
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const me = normalizeEmail(user.email);
  const entered = emails.map(normalizeEmail);
  const invalid = entered.filter((e) => e && !isEmail(e));
  const invites = [...new Set(entered.filter((e) => isEmail(e) && e !== me))];

  /** What's wrong with one row, shown under it (blank rows are fine: they're skipped). */
  const problem = (i: number) => {
    const e = entered[i];
    if (!e) return undefined;
    if (!isEmail(e)) return 'Not an email';
    if (e === me) return 'That’s you: you’re added automatically';
    if (entered.indexOf(e) < i) return 'Already added above';
    return undefined;
  };

  const setRow = (i: number, value: string) => {
    // A pasted list ("a@x.com, b@y.com" or Gmail's "Name <a@x.com>; …") becomes one row per email.
    if (/[,;\n]/.test(value) || /<[^>]+>/.test(value)) {
      const list = splitEmails(value);
      if (list.length) {
        setRows((rs) => [...rs.slice(0, i), ...list.map(newRow), ...rs.slice(i + 1)]);
        return;
      }
    }
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value } : r)));
  };

  const addRow = () => {
    setFocusRow(rows.length);
    setRows((rs) => [...rs, newRow()]);
  };

  const removeRow = (i: number) => setRows((rs) => rs.filter((_, j) => j !== i));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Give your group a name');
    if (!course) return setError('Which course is this for?');
    if (invalid.length) return setError(`Fix or remove ${invalid.map((x) => `“${x}”`).join(', ')}`);
    if (invites.length === 0) return setError('Invite at least one teammate (not counting yourself)');

    setSaving(true);
    setError('');
    try {
      const team = await api.createTeam({ name: name.trim(), course, emails: invites, message: message.trim() });
      navigate(groupPath(team.id), { replace: true });
    } catch (err) {
      setError((err as ApiError).message);
      setSaving(false);
    }
  };

  return (
    <div className="page-panel">
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
        <CoursePicker value={course} onChange={setCourse} />
        <fieldset className="field teammates">
          <legend>Teammates</legend>
          {rows.map((row, i) => (
            <TeammateEmailField
              key={row.id}
              index={i}
              value={row.value}
              onChange={(v) => setRow(i, v)}
              onRemove={emails.length > 1 ? () => removeRow(i) : undefined}
              exclude={[user.email, ...emails.filter((_, j) => j !== i)]}
              problem={problem(i)}
              autoFocus={focusRow === i}
            />
          ))}
          {/* preventDefault on mousedown: the box being typed in keeps focus until the click lands, so a
              message appearing under it (on blur) can't shift this button out from under the pointer. */}
          <button type="button" className="teammate-add" onMouseDown={(e) => e.preventDefault()} onClick={addRow}>
            <span className="teammate-add-icon" aria-hidden="true">
              +
            </span>
            Add another teammate
          </button>
        </fieldset>

        <label className="field">
          <span>
            Message for your teammates <span className="field-optional">(optional)</span>
          </span>
          <textarea
            className="input group-message-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={3}
            placeholder="e.g. “join my epic awesome group”"
            aria-describedby="group-message-count"
          />
          <small id="group-message-count" className="muted group-message-count">
            Shown to everyone you invite when they open the invite. {message.length}/{MAX_MESSAGE_LENGTH}
          </small>
        </label>

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
        </div>
      </form>
    </div>
  );
}
