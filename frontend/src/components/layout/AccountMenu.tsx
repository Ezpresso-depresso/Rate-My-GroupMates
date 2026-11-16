/*
 * The signed-in pill in the header (name + email, then avatar). Clicking it opens your profile;
 * hovering it (or tabbing into it) shows a small menu. Shown/hidden purely in CSS (Layout.css).
 */
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../common/Avatar';
import './Layout.css';

// Drop focus after a click so the menu (which also opens on :focus-within) closes once the mouse leaves.
const blur = (e: MouseEvent<HTMLElement>) => e.currentTarget.blur();

export function AccountMenu() {
  const { user, signOut } = useAuth();

  return (
    <div className="current-member">
      <Link className="member-pill" to="/profile" aria-label="Your profile" onClick={blur}>
        <span className="member-text">
          {user.name}
          <span className="muted header-email">{user.email}</span>
        </span>
        <Avatar member={user} size={33} />
      </Link>

      {/* "My Profile" lives in the navbar links and on the pill itself, so it isn't repeated here. */}
      <nav className="account-menu" aria-label="Account">
        <Link to="/settings" onClick={blur}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </Link>
        <button type="button" className="account-menu-signout" onClick={() => signOut()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Sign out
        </button>
      </nav>
    </div>
  );
}
