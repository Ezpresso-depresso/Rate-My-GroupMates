import { MAX_PINS } from '../../lib/profile';
import './Profile.css';

interface PinButtonProps {
  pinned: boolean;
  /** True when MAX_PINS are already pinned (and this one isn't). */
  full: boolean;
  label: string;
  onToggle: () => void;
}

export function PinButton({ pinned, full, label, onToggle }: PinButtonProps) {
  const title = pinned ? `Unpin ${label}` : full ? `You can pin up to ${MAX_PINS}. Unpin one first` : `Pin ${label}`;
  return (
    <button
      type="button"
      className={`pin-button ${pinned ? 'pinned' : ''}`}
      aria-pressed={pinned}
      aria-label={title}
      title={title}
      disabled={full && !pinned}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      </svg>
    </button>
  );
}
