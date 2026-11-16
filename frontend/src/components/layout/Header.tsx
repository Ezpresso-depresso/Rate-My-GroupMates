import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClassCount } from '../../lib/classCount';
import { AccountMenu } from './AccountMenu';
import './Layout.css';

export function Header() {
  const { user } = useAuth();
  const classCount = useClassCount(user.id);

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
          <NavLink to="/profiles">Find Groupmates</NavLink>
          <span className="main-nav-divider" aria-hidden="true">
            |
          </span>
          <span className="nav-with-nudge">
            <NavLink to="/profile">My Profile</NavLink>
            {classCount === 0 && (
              <Link to="/profile#classes" className="class-nudge">
                Add classes to profile!
              </Link>
            )}
          </span>
        </nav>
        <AccountMenu />
      </div>
    </header>
  );
}
