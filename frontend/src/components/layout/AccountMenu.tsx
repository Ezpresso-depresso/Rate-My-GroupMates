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

      <nav className="account-menu" aria-label="Account">
        <Link to="/profile" onClick={blur}>
          My Profile
        </Link>
        <Link to="/settings" onClick={blur}>
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
