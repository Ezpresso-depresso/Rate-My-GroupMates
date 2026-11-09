import { Link, NavLink } from 'react-router-dom';
import { AccountMenu } from './AccountMenu';
import './Layout.css';

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="logo">10</span>
        Rate My Groupmates
        <span className="pill">UCI</span>
      </Link>
      <div className="header-right">
        <nav className="main-nav" aria-label="Main navigation">
          <NavLink to="/" end>
            My Groups
          </NavLink>
          <span className="main-nav-divider" aria-hidden="true">
            |
          </span>
          <NavLink to="/profiles">Search Profiles</NavLink>
          <span className="main-nav-divider" aria-hidden="true">
            |
          </span>
          <NavLink to="/profile">My Profile</NavLink>
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}
