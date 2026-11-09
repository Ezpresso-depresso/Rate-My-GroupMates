/*
 * Find people by name or email. Results update as you type (after a short pause, so every
 * keystroke isn't a request); an older, slower search can never overwrite a newer one.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { useAuth } from '../hooks/useAuth';
import { api, type ApiError } from '../services/api';
import type { PublicUser } from '../types';
import '../components/groups/Groups.css';
import '../components/profile/Profile.css';

const DEBOUNCE_MS = 200;

// The search survives leaving and coming back to this page (e.g. after viewing a profile) until
// it's cleared. sessionStorage: per tab, gone when the tab closes.
const QUERY_KEY = 'rmg-profile-search';
function savedQuery(): string {
  try {
    return sessionStorage.getItem(QUERY_KEY) ?? '';
  } catch {
    return '';
  }
}
function saveQuery(value: string) {
  try {
    if (value.trim()) sessionStorage.setItem(QUERY_KEY, value);
    else sessionStorage.removeItem(QUERY_KEY);
  } catch {
    /* storage blocked: the search just won't be remembered */
  }
}

type Results = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; users: PublicUser[] };

export function SearchProfilesPage() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState(savedQuery);
  const [results, setResults] = useState<Results>(() => (query.trim() ? { kind: 'loading' } : { kind: 'idle' }));
  const q = query.trim();

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .searchUsers(q, controller.signal)
        .then((users) => setResults({ kind: 'ready', users }))
        .catch((err: ApiError) => {
          if (!controller.signal.aborted) setResults({ kind: 'error', message: err.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const onChange = (value: string) => {
    setQuery(value);
    saveQuery(value);
    setResults(value.trim() ? { kind: 'loading' } : { kind: 'idle' });
  };

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Search</div>
          <h1>Search Profiles</h1>
        </div>
      </div>

      <form className="profile-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search profiles by name or email"
          autoFocus
        />
      </form>

      <div aria-live="polite">
        {results.kind === 'idle' && <p className="muted">Start typing a name or email.</p>}
        {results.kind === 'loading' && <p className="muted">Searching…</p>}
        {results.kind === 'error' && (
          <p className="error" role="alert">
            {results.message}
          </p>
        )}
        {results.kind === 'ready' &&
          (results.users.length === 0 ? (
            <p className="muted">No one matches “{q}”.</p>
          ) : (
            <ul className="member-list search-results">
              {results.users.map((u) => (
                <li key={u.id} className="member-row">
                  <Avatar member={u} size={40} />
                  <div className="member-row-text">
                    <strong>
                      {u.fullName || u.name}
                      {u.id === me.id && <span className="tag">you</span>}
                    </strong>
                    <span className="muted small">{u.email}</span>
                  </div>
                  <Link className="btn" to={u.id === me.id ? '/profile' : `/profiles/${u.id}`}>
                    View profile →
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
