/*
 * Your short bio on the profile page. Works like the name: hover shows a pen, click to edit,
 * Enter (or clicking away) saves, Escape cancels. Saving it empty removes it.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { api, type ApiError } from '../../services/api';
import './Profile.css';

export const MAX_BIO_LENGTH = 100; // keep in sync with backend/src/config/constants.ts

const Pen = () => (
  <svg className="name-pen" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export function BioEditor() {
  const { user, updateUser } = useAuth();
  const current = user.bio ?? '';
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const start = () => {
    setValue(current);
    setError('');
    setEditing(true);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const bio = value.replace(/\s+/g, ' ').trim();
    if (bio === current) return setEditing(false);

    setBusy(true);
    setError('');
    try {
      updateUser(await api.setBio(bio));
      setEditing(false);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!editing)
    return (
      <button type="button" className="bio-edit" onClick={start} title="Edit your bio">
        {current ? <span className="profile-bio">{current}</span> : <span className="profile-bio empty">Add a short bio</span>}
        <Pen />
      </button>
    );

  return (
    <form className="bio-form inline-edit" onSubmit={save}>
      <input
        ref={input}
        className="bio-input"
        value={value}
        maxLength={MAX_BIO_LENGTH}
        placeholder="A line about you, e.g. “Always on time with the slides”"
        aria-label="Your bio"
        aria-describedby="bio-count"
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
      <span id="bio-count" className="muted bio-count">
        {value.length}/{MAX_BIO_LENGTH}
      </span>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
