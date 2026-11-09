import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import './Layout.css';

/** `nav` is only passed inside a group whose reviews are open. */
export function Header({ nav }: { nav?: ReactNode }) {
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
      <AccountMenu />
    </header>
  );
}
