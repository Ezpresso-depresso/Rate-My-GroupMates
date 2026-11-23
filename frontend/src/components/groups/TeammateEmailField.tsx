/*
 * One teammate's email on the create-group form. Typing suggests people who already have an
 * account (matched by email, like Find Groupmates); picking one fills in their email. Once the box
 * holds someone's account email it shows as a card (picture, name, email); click it to change.
 * Anyone's email can still be typed in full: invites work before the person signs up.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { isEmail, normalizeEmail } from '../../lib/emails';
import { api } from '../../services/api';
import type { SearchResult } from '../../types';
import { Avatar } from '../common/Avatar';
import '../common/Common.css';

const DEBOUNCE_MS = 200;
const MIN_CHARS = 2;

interface Props {
  index: number;
  value: string;
  onChange: (value: string) => void;
  /** Leave out when this is the only row (it can't be removed). */
  onRemove?: () => void;
  /** Emails already in other rows (and yours), left out of the suggestions. */
  exclude: string[];
  /** Shown under the box, e.g. "Not an email". */
  problem?: string;
  autoFocus?: boolean;
}

export function TeammateEmailField({ index, value, onChange, onRemove, exclude, problem, autoFocus }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [focused, setFocused] = useState(false);
  const [matches, setMatches] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  /** Whose account (if anyone's) the email in the box belongs to; `user: null` = no account. */
  const [lookup, setLookup] = useState<{ email: string; user: SearchResult | null } | null>(null);
  /** Clicked the card to change it: show the box (focused) instead. */
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = value.trim();
  const email = normalizeEmail(value);
  const known = lookup?.email === email ? lookup : null;

  // Once you leave a box holding a complete email, look up whose it is (typed or pasted ones too).
  useEffect(() => {
    if (focused || !isEmail(email) || lookup?.email === email) return;
    const controller = new AbortController();
    api
      .searchUsers(email, 'email', controller.signal)
      .then((users) => setLookup({ email, user: users.find((u) => normalizeEmail(u.email) === email) ?? null }))
      .catch(() => {
        /* no card, just the email: still a valid invite */
      });
    return () => controller.abort();
  }, [focused, email, lookup?.email]);

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (q.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .searchUsers(q, 'email', controller.signal)
        .then((users) => {
          const skip = new Set(exclude.map(normalizeEmail));
          setMatches(users.filter((u) => !skip.has(normalizeEmail(u.email))).slice(0, 6));
          setActive(0);
        })
        .catch(() => {
          /* suggestions are a convenience: typing the email still works */
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // Re-search only when the text changes; `exclude` is read when the results come back.
  }, [q]);

  // Nothing left to suggest once the box holds the only match's exact email.
  const exact = matches.length === 1 && normalizeEmail(matches[0].email) === normalizeEmail(q);
  const shown = q.length >= MIN_CHARS && !exact ? matches : [];
  const open = focused && shown.length > 0;
  // "Not an email" waits until you leave the box (you're probably still typing it).
  const visibleProblem = focused && !isEmail(normalizeEmail(value)) ? undefined : problem;

  const pick = (u: SearchResult) => {
    onChange(u.email);
    setLookup({ email: normalizeEmail(u.email), user: u });
    setMatches([]);
    input.current?.blur(); // show the card right away
  };

  // A card only for a real account that's fine to invite (not you, not a repeat).
  const card = !focused && !editing && !problem && known?.user ? known.user : null;
  const noAccount = !focused && !problem && known && !known.user;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // pick, don't submit the form
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMatches([]);
    }
  };

  return (
    <div className="teammate-row">
      <div className="combobox teammate-field">
        {card ? (
          <button
            type="button"
            className="teammate-card"
            aria-label={`Teammate ${index + 1}: ${card.fullName || card.name}, ${card.email}. Click to change`}
            onClick={() => setEditing(true)}
          >
            <Avatar member={card} size={32} />
            <span className="teammate-option-text">
              <strong>{card.fullName || card.name}</strong>
              <span className="muted">{card.email}</span>
            </span>
            <span className="teammate-card-change" aria-hidden="true">
              Change
            </span>
          </button>
        ) : (
          <input
            ref={input}
            className="input"
            type="email"
            inputMode="email"
            role="combobox"
            aria-label={`Teammate ${index + 1} email`}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
            aria-invalid={!!visibleProblem}
            autoComplete="off"
            spellCheck={false}
            placeholder="teammate@uci.edu"
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setEditing(false);
            }}
            onKeyDown={onKeyDown}
          />
        )}
        {open && (
          <ul id={listId} className="combobox-list" role="listbox" aria-label="People with matching emails">
            {shown.map((u, i) => (
              <li key={u.id} role="presentation">
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={`combobox-option teammate-option${i === active ? ' active' : ''}`}
                  // mousedown, not click: the input's blur would close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(u);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <Avatar member={u} size={28} />
                  <span className="teammate-option-text">
                    <strong>{u.fullName || u.name}</strong>
                    <span className="muted">{u.email}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {visibleProblem && <small className="teammate-problem">{visibleProblem}</small>}
        {noAccount && <small className="teammate-note">No account yet. They can join once they sign up with this email.</small>}
      </div>
      {onRemove && (
        <button type="button" className="teammate-remove" aria-label={`Remove teammate ${index + 1}`} onClick={onRemove}>
          ×
        </button>
      )}
    </div>
  );
}
