/*
 * A dropdown you can also type into: typing filters the list (best matches first), the chevron
 * opens the whole list, and only a listed option can end up chosen. Leaving the box with an exact
 * match typed (e.g. "swe" or "161") or just one match left picks it; anything else snaps back.
 */
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import './Common.css';

export interface ComboOption {
  value: string;
  /** Shown in the box once chosen, and as the option's main text. */
  label: string;
  /** Secondary text after the label in the list, e.g. a course title. */
  hint?: string;
  /** What the box shows once chosen, if not just the label. */
  display?: string;
  /** Typing exactly this (any case) picks the option, e.g. "COMPSCI" or "161". */
  key: string;
  /** Options with a group get a heading in the full list (not while filtering). */
  group?: string;
}

interface Props {
  label: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function rank(option: ComboOption, q: string): number {
  const key = norm(option.key);
  const text = norm(`${option.label} ${option.hint ?? ''}`);
  if (key === q) return 4;
  if (key.startsWith(q)) return 3;
  if (text.split(/[\s·:,()/-]+/).some((w) => w.startsWith(q))) return 2;
  if (text.includes(q)) return 1;
  return 0;
}

export function Combobox({ label, options, value, onChange, placeholder, disabled, inputRef }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const selected = options.find((o) => o.value === value);
  const [text, setText] = useState<string | null>(null); // null = not typing: show the selection
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const q = norm(text ?? '');
  const shown = useMemo(() => {
    if (!q) return options;
    return options
      .map((o, i) => ({ o, i, r: rank(o, q) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r || a.i - b.i)
      .map((x) => x.o);
  }, [options, q]);

  const choose = (option: ComboOption) => {
    setText(null);
    setOpen(false);
    if (option.value !== value) onChange(option.value);
  };

  const scrollTo = (index: number) => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const move = (delta: number) => {
    if (!shown.length) return;
    const next = open ? (active + delta + shown.length) % shown.length : Math.max(0, shown.indexOf(selected!));
    setOpen(true);
    setActive(next);
    requestAnimationFrame(() => scrollTo(next));
  };

  /** Leaving the box: an exact or only match counts as a pick; otherwise go back to the selection. */
  const settle = () => {
    setOpen(false);
    if (text === null) return;
    const exact = q ? options.find((o) => norm(o.key) === q || norm(o.label) === q || norm(o.display ?? '') === q) : undefined;
    const pick = exact ?? (q && shown.length === 1 ? shown[0] : undefined);
    if (pick) choose(pick);
    else setText(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); // don't submit the form
      if (shown[active]) choose(shown[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setText(null);
    }
  };

  let lastGroup: string | undefined;
  return (
    <div className="combobox">
      <input
        ref={inputRef}
        id={id}
        className="input"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && shown[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={text ?? selected?.display ?? selected?.label ?? ''}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          setActive(Math.max(0, options.indexOf(selected!)));
          setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={settle}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="combobox-toggle"
        tabIndex={-1}
        aria-label={`Show all ${label.toLowerCase()} options`}
        disabled={disabled}
        // mousedown, not click: keeps focus in the box, so the list doesn't close on blur.
        onMouseDown={(e) => {
          e.preventDefault();
          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
          if (open) return setOpen(false);
          input.focus();
          setText(null);
          const start = Math.max(0, options.indexOf(selected!));
          setActive(start);
          setOpen(true);
          requestAnimationFrame(() => scrollTo(start));
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul ref={listRef} id={listId} className="combobox-list" role="listbox" aria-label={label}>
          {shown.length === 0 && <li className="combobox-note">No matches for “{text}”</li>}
          {shown.map((o, i) => {
            const heading = !q && o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <li key={o.value} role="presentation">
                {heading && (
                  <div className="combobox-group" aria-hidden="true">
                    {heading}
                  </div>
                )}
                <div
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={o.value === value}
                  className={`combobox-option${i === active ? ' active' : ''}${o.value === value ? ' selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                >
                  <strong>{o.label}</strong>
                  {o.hint && <span className="muted">{o.hint}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
