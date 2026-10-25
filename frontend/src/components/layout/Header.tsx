import { Link, NavLink } from 'react-router-dom';
import { useReviews } from '../../hooks/useReviews';
import { Avatar } from '../common/Avatar';
import './Layout.css';

export function Header() {
  const { currentUser, switchMember } = useReviews();

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <span className="logo">10</span>
        Rate My Groupmates
        <span className="pill">UCI</span>
      </Link>
      <nav className="nav" aria-label="Main navigation">
        <NavLink to="/" end>
          01 · Rate teammates
        </NavLink>
        <NavLink to="/awards">02 · Team awards</NavLink>
      </nav>
      <div className="current-member">
        <Avatar member={currentUser} size={30} />
        <span>
          {currentUser.name}
          <button className="textbtn" onClick={switchMember}>
            Not you? Switch
          </button>
        </span>
      </div>
    </header>
  );
}
