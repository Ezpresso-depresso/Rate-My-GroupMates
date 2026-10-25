import { Link, NavLink } from 'react-router-dom';
import './Layout.css';

export function Header() {
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
    </header>
  );
}
