/* "Background ▾" on the profile page: pick one of the preset backgrounds (or none). Saves on click. */
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PROFILE_BACKGROUNDS } from '../../lib/backgrounds';
import { api, type ApiError } from '../../services/api';
import './Profile.css';

export function BackgroundPicker() {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const current = user.profileBackground ?? '';

  const choose = async (id: string) => {
    if (id === current || busy) return;
    setBusy(true);
    setError('');
    try {
      updateUser(await api.setBackground(id));
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  const options = [{ id: '', label: 'None', src: '' }, ...PROFILE_BACKGROUNDS];

  return (
    <div className="background-picker">
      <button type="button" className="textbtn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Background <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="background-options" role="group" aria-label="Profile background">
          {options.map((b) => (
            <button
              key={b.id || 'none'}
              type="button"
              className={`background-option ${b.id === current ? 'selected' : ''}`}
              aria-pressed={b.id === current}
              disabled={busy}
              onClick={() => choose(b.id)}
              title={b.label}
            >
              <span className="background-thumb" style={b.src ? { backgroundImage: `url(${b.src})` } : undefined} />
              <span className="small">{b.label}</span>
            </button>
          ))}
          {error && (
            <p className="error small" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
