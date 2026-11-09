/*
 * Your name on the profile page. Like the avatar: hover shows a pen, click to edit.
 * Enter (or clicking away) saves, Escape cancels.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, type ApiError } from '../../services/api';
import './Profile.css';

const MAX_NAME_LENGTH = 80; // keep in sync with backend/src/config/constants.ts

export function NameEditor() {
  const { user, updateUser } = useAuth();
  const current = user.fullName || user.name;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const start = () => {
    setValue(current);
    setError('');
    setEditing(true);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const name = value.trim().replace(/\s+/g, ' ');
    if (name === current) return setEditing(false);
    if (!name) return setError('Enter your name');

    setBusy(true);
    setError('');
    try {
      updateUser(await api.setName(name));
      setEditing(false);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!editing)
    return (
      <button type="button" className="name-edit" onClick={start} aria-label={`Edit your name (${current})`} title="Edit your name">
        <h1>
          {current}
          {/* Inside the heading and sized in em, so it sits on the name's baseline at letter height. */}
          <svg className="name-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </h1>
      </button>
    );

  return (
    <form className="name-form inline-edit" onSubmit={save}>
      <input
        ref={input}
        className="name-input"
        value={value}
        maxLength={MAX_NAME_LENGTH}
        aria-label="Your name"
        disabled={busy}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setError('');
            setEditing(false);
          }
        }}
      />
      {error && (
        <p className="error name-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
