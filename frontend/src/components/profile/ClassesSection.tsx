/*
 * The classes someone is in / has taken: their groups' courses plus ones they added. On your own
 * profile you can add classes (from the UCI course list) and drop any of them. Each class links to
 * Find Groupmates for that class.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { setClassCount } from '../../lib/classCount';
import { api, type ApiError } from '../../services/api';
import type { ProfileClass } from '../../types';
import { CoursePicker } from '../groups/CoursePicker';
import '../groups/Groups.css';
import './Profile.css';

interface Props {
  classes: ProfileClass[];
  /** Leave out for a read-only view (someone else's profile). */
  onChange?: (classes: ProfileClass[]) => void;
}

export function ClassesSection({ classes, onChange }: Props) {
  const { hash } = useLocation();
  const section = useRef<HTMLElement>(null);
  // The navbar's "Add classes to profile!" links to /profile#classes: open the picker and scroll to it.
  const editable = !!onChange;
  const [adding, setAdding] = useState(() => editable && hash === '#classes');
  useEffect(() => {
    if (hash !== '#classes') return;
    if (editable) setAdding(true);
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash, editable]);
  const [course, setCourse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (action: () => Promise<ProfileClass[]>) => {
    setBusy(true);
    setError('');
    try {
      const next = await action();
      setClassCount(next.length);
      onChange?.(next);
      return true;
    } catch (err) {
      setError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!course) return setError('Pick a department and course first');
    if (classes.some((c) => c.code === course)) return setError(`${course} is already on your profile`);
    if (await save(() => api.addClass(course))) setCourse('');
  };

  /** The class whose "are you sure?" popover is open. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmChip = useRef<HTMLLIElement>(null);

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    if (!confirming) return;
    const onPointer = (e: PointerEvent) => {
      // Clicks on the chip itself (its × toggles the popover) don't count as outside.
      if (!confirmChip.current?.contains(e.target as Node)) setConfirming(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(null);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [confirming]);

  const drop = (code: string) => {
    setConfirming(null);
    void save(() => api.dropClass(code));
  };

  return (
    <section ref={section} className="card profile-section" aria-labelledby="classes">
      <div className="classes-head">
        <h2 id="classes">Classes</h2>
        {editable && !adding && (
          <button type="button" className="textbtn" onClick={() => setAdding(true)}>
            + Add a class
          </button>
        )}
      </div>

      {classes.length === 0 ? (
        <p className="muted">
          {editable ? 'No classes yet. Join a group or add the classes you’re taking.' : 'No classes listed yet.'}
        </p>
      ) : (
        <ul className="class-chips" aria-label="Classes">
          {classes.map((c) => (
            <li key={c.code} className="class-chip" ref={confirming === c.code ? confirmChip : undefined}>
              <Link
                to={`/profiles?class=${encodeURIComponent(c.code)}`}
                title={`${c.title}${c.groups.length ? ` · from ${c.groups.join(', ')}` : ''}\nFind others in ${c.code}`}
              >
                <strong>{c.code}</strong>
                <span className="muted">{c.title}</span>
              </Link>
              {editable && (
                <button
                  type="button"
                  className="class-chip-remove"
                  aria-label={`Remove ${c.code}`}
                  aria-expanded={confirming === c.code}
                  disabled={busy}
                  onClick={() => setConfirming((open) => (open === c.code ? null : c.code))}
                >
                  ×
                </button>
              )}
              {confirming === c.code && (
                <div className="class-confirm" role="dialog" aria-label={`Remove ${c.code}?`}>
                  <p>
                    Are you sure you want to remove <strong>{c.code}</strong>?
                  </p>
                  {c.groups.length > 0 && (
                    <p className="muted small">
                      It’s from your group{c.groups.length > 1 ? 's' : ''} {c.groups.join(', ')}; removing just hides it.
                    </p>
                  )}
                  <div className="class-confirm-actions">
                    <button type="button" className="textbtn" onClick={() => setConfirming(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-danger-small" autoFocus onClick={() => drop(c.code)}>
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && adding && (
        <div className="class-add">
          <CoursePicker value={course} onChange={setCourse} />
          <div className="class-add-actions">
            <button type="button" className="btn" disabled={busy} onClick={add}>
              {busy ? 'Saving…' : 'Add class'}
            </button>
            <button
              type="button"
              className="textbtn"
              onClick={() => {
                setAdding(false);
                setCourse('');
                setError('');
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
