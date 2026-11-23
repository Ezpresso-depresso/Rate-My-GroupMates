import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClassCount } from '../../lib/classCount';
import { useTour } from '../../lib/tour';
import { AccountMenu } from './AccountMenu';
import './Layout.css';

export function Header() {
  const { user } = useAuth();
  const classCount = useClassCount(user.id);
  const { step } = useTour();
  const { pathname } = useLocation();
  // During the help tour each popup sits on its navbar tab until you're on that page, where it
  // moves onto the thing to click (see ProfilePage, SearchProfilesPage, GroupsPage).
  const profileNudge = step === 'classes' ? pathname !== '/profile' : classCount === 0;

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="logo">10</span>
        Rate My Groupmates
        <span className="pill">UCI</span>
      </Link>
      <div className="header-right">
        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-with-nudge">
            <NavLink to="/" end>
              My Groups
            </NavLink>
            {step === 'group' && pathname !== '/' && (
              <Link to="/" className="nudge">
                Make a group!
              </Link>
            )}
          </span>
          <span className="main-nav-divider" aria-hidden="true">
            |
          </span>
          <span className="nav-with-nudge">
            <NavLink to="/profiles">Find Groupmates</NavLink>
            {step === 'search' && pathname !== '/profiles' && (
              <Link to="/profiles" className="nudge nudge-wide">
                Find groupmates in your class!
              </Link>
            )}
          </span>
          <span className="main-nav-divider" aria-hidden="true">
            |
          </span>
          <span className="nav-with-nudge">
            <NavLink to="/profile">My Profile</NavLink>
            {profileNudge && (
              <Link to="/profile#classes" className="nudge">
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
