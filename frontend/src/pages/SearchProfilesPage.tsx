/*
 * Find people by class (the default), name or email; the filter menu beside the box picks which.
 * By class: typing suggests real UCI courses, and picking one lists everyone whose profile lists
 * it (their groups' classes plus ones they added). /profiles?class=COMPSCI%20161 opens that search. By name/email: results update as you type. Requests wait for a short pause in typing, and
 * an older, slower response can never overwrite a newer one.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { Stars } from '../components/common/Stars';
import { useAuth } from '../hooks/useAuth';
import { advanceTour, useTour } from '../lib/tour';
import { api, type ApiError } from '../services/api';
import type { Course, SearchField, SearchResult } from '../types';
import '../components/groups/Groups.css';
import '../components/profile/Profile.css';

const DEBOUNCE_MS = 200;
const DEFAULT_FILTER: SearchField = 'class';

const FILTERS: { value: SearchField; label: string; placeholder: string }[] = [
  { value: 'class', label: 'Class', placeholder: 'Search by class, e.g. COMPSCI 161' },
  { value: 'all', label: 'Name or email', placeholder: 'Search by name or email' },
  { value: 'name', label: 'Name', placeholder: 'Search by name' },
  { value: 'email', label: 'Email', placeholder: 'Search by email' },
];

// The search survives leaving and coming back to this page (e.g. after viewing a profile) until
// it's cleared. sessionStorage: per tab, gone when the tab closes.
const QUERY_KEY = 'rmg-profile-search';
const FILTER_KEY = 'rmg-profile-search-by';
const COURSE_KEY = 'rmg-profile-search-course';
function load(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function store(key: string, value: string) {
  try {
    if (value.trim()) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    /* storage blocked: the search just won't be remembered */
  }
}
function savedFilter(): SearchField {
  const value = load(FILTER_KEY);
  return FILTERS.find((f) => f.value === value)?.value ?? DEFAULT_FILTER;
}

type Results = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; users: SearchResult[] };
type Suggestions = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; courses: Course[] };

/** A class link from a profile (?class=…) starts a search for that class. */
function linkedClass(): string {
  const code = new URLSearchParams(window.location.search).get('class')?.trim() ?? '';
  if (code) {
    store(FILTER_KEY, 'class');
    store(COURSE_KEY, code);
    store(QUERY_KEY, code);
  }
  return code;
}

export function SearchProfilesPage() {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const [linked] = useState(linkedClass);
  // The link has done its job (the search is remembered like any other), so tidy the address.
  useEffect(() => {
    if (linked) navigate('/profiles', { replace: true });
  }, [linked, navigate]);
  const [query, setQuery] = useState(() => linked || load(QUERY_KEY));
  const [by, setBy] = useState<SearchField>(() => (linked ? 'class' : savedFilter()));
  /** By class: the course picked from the suggestions ('' while still typing). */
  const [course, setCourse] = useState(() => linked || load(COURSE_KEY));
  const [menuOpen, setMenuOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions>({ kind: 'loading' });
  const [active, setActive] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  const isClass = by === 'class';
  /** What the people search runs on: the picked course, or the typed text. */
  const searchFor = isClass ? course : q;
  const [results, setResults] = useState<Results>(() => (searchFor ? { kind: 'loading' } : { kind: 'idle' }));
  const filter = FILTERS.find((f) => f.value === by) ?? FILTERS[0];
  const showSuggestions = isClass && suggestOpen && !!q && !course;
  const { step } = useTour();

  // Help tour: any finished search (a picked class, or name/email results) completes this step.
  useEffect(() => {
    if (results.kind === 'ready') advanceTour('search', 'group');
  }, [results.kind]);

  // People matching the search.
  useEffect(() => {
    if (!searchFor) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        api
          .searchUsers(searchFor, by, controller.signal)
          .then((users) => setResults({ kind: 'ready', users }))
          .catch((err: ApiError) => {
            if (!controller.signal.aborted) setResults({ kind: 'error', message: err.message });
          });
      },
      isClass ? 0 : DEBOUNCE_MS, // a picked course is final; no need to wait
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchFor, by, isClass]);

  // By class: course suggestions for what's typed so far.
  useEffect(() => {
    if (!isClass || !q || course) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .searchCourses(q, controller.signal)
        .then((courses) => {
          setSuggestions({ kind: 'ready', courses });
          setActive(0);
        })
        .catch((err: ApiError) => {
          if (!controller.signal.aborted) setSuggestions({ kind: 'error', message: err.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isClass, q, course]);

  // Close the filter menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const pickCourse = (code: string) => {
    setCourse(code);
    store(COURSE_KEY, code);
    setQuery(code);
    store(QUERY_KEY, code);
    setSuggestOpen(false);
    setResults({ kind: 'loading' });
  };

  const onChange = (value: string) => {
    setQuery(value);
    store(QUERY_KEY, value);
    if (isClass) {
      // Editing the text un-picks the course until a new one is chosen.
      setCourse('');
      store(COURSE_KEY, '');
      setResults({ kind: 'idle' });
      setSuggestOpen(true);
      if (value.trim()) setSuggestions({ kind: 'loading' });
    } else {
      setResults(value.trim() ? { kind: 'loading' } : { kind: 'idle' });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isClass || course) return;
    const list = suggestions.kind === 'ready' ? suggestions.courses : [];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestOpen(true);
      if (list.length) setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length);
    } else if (e.key === 'Enter' && showSuggestions && list[active]) {
      e.preventDefault();
      pickCourse(list[active].code);
    } else if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault(); // don't also clear the box
      setSuggestOpen(false);
    }
  };

  const chooseFilter = (value: SearchField) => {
    setMenuOpen(false);
    inputRef.current?.focus();
    if (value === by) return;
    setBy(value);
    store(FILTER_KEY, value);
    setCourse('');
    store(COURSE_KEY, '');
    if (value === 'class') {
      setResults({ kind: 'idle' });
      setSuggestOpen(true);
      if (q) setSuggestions({ kind: 'loading' });
    } else {
      setResults(q ? { kind: 'loading' } : { kind: 'idle' });
    }
  };

  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Search</div>
          <h1>Find Groupmates</h1>
        </div>
      </div>

      <form className="profile-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="profile-search-box">
          <input
            ref={inputRef}
            className="input"
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setSuggestOpen(false)}
            placeholder={filter.placeholder}
            aria-label={`Search people by ${filter.label.toLowerCase()}`}
            autoComplete="off"
            {...(isClass && {
              role: 'combobox',
              'aria-autocomplete': 'list' as const,
              'aria-expanded': showSuggestions,
              'aria-controls': 'course-suggestions',
              'aria-activedescendant':
                showSuggestions && suggestions.kind === 'ready' && suggestions.courses[active] ? `course-option-${active}` : undefined,
            })}
            autoFocus
          />
          {step === 'search' && <span className="nudge nudge-above">Find groupmates in your class!</span>}
          <svg className="profile-search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>

          {showSuggestions && (
            <ul className="course-suggestions" id="course-suggestions" role="listbox" aria-label="Classes">
              {suggestions.kind === 'loading' && <li className="course-suggestions-note">Looking up classes…</li>}
              {suggestions.kind === 'error' && <li className="course-suggestions-note error">{suggestions.message}</li>}
              {suggestions.kind === 'ready' && suggestions.courses.length === 0 && (
                <li className="course-suggestions-note">No UCI class matches “{q}”.</li>
              )}
              {suggestions.kind === 'ready' &&
                suggestions.courses.map((c, i) => (
                  <li
                    key={c.code}
                    id={`course-option-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className={i === active ? 'active' : undefined}
                    // mousedown, not click: the input's blur would close the list first.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickCourse(c.code);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <strong>{c.code}</strong>
                    <span className="muted">{c.title}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="search-filter" ref={menuRef}>
          <button
            type="button"
            className={by === DEFAULT_FILTER ? 'search-filter-toggle' : 'search-filter-toggle active'}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Search filter: ${filter.label}`}
            title={`Searching by ${filter.label.toLowerCase()}`}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />
            </svg>
          </button>
          {menuOpen && (
            <div className="search-filter-menu" role="menu" aria-label="Search by">
              <div className="search-filter-heading">Search by</div>
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={f.value === by}
                  className={f.value === by ? 'selected' : undefined}
                  onClick={() => chooseFilter(f.value)}
                >
                  {f.label}
                  {f.value === by && (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      <div aria-live="polite">
        {results.kind === 'loading' && <p className="muted">Searching…</p>}
        {results.kind === 'error' && (
          <p className="error" role="alert">
            {results.message}
          </p>
        )}
        {results.kind === 'ready' &&
          (results.users.length === 0 ? (
            <p className="muted">{isClass ? `No one lists ${course} on their profile yet.` : `No one matches “${q}”.`}</p>
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
                  <div className="search-rating">
                    {u.rating.average === null ? (
                      <span className="muted small">No ratings yet</span>
                    ) : (
                      <>
                        <Stars value={u.rating.average} />
                        <span className="small">
                          <b>{u.rating.average.toFixed(1)}</b>{' '}
                          <span className="muted">
                            ({u.rating.count} review{u.rating.count === 1 ? '' : 's'})
                          </span>
                        </span>
                      </>
                    )}
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
