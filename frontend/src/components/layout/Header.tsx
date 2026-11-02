import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../common/Avatar';
import './Layout.css';

/** `nav` is only passed inside a group whose reviews are open. */
export function Header({ nav }: { nav?: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="logo">10</span>
        Rate My Groupmates
        <span className="pill">UCI</span>
      </Link>
      {nav && (
        <nav className="nav" aria-label="Group navigation">
          {nav}
        </nav>
      )}
      <div className="current-member">
        <Avatar member={user} size={30} />
        <span>
          {user.name}
          <span className="muted small header-email">{user.email}</span>
          <span className="header-links">
            <Link className="textbtn" to="/account">
              Account
            </Link>
            <button className="textbtn" onClick={signOut}>
              Sign out
            </button>
          </span>
        </span>
      </div>
    </header>
  );
}
