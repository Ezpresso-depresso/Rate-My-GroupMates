import { NavLink, Outlet } from 'react-router-dom';
import { useReviews } from '../../hooks/useReviews';
import { groupPath } from '../../lib/teams';
import { Footer } from './Footer';
import { Header } from './Header';
import './Layout.css';

/** Inside a group whose reviews are open. */
export function Layout() {
  const { team } = useReviews();
  const base = groupPath(team.id);
  return (
    <>
      <Header
        nav={
          <>
            <NavLink to="/" end>
              ← My groups
            </NavLink>
            <NavLink to={base} end>
              01 · Rate teammates
            </NavLink>
            <NavLink to={`${base}/awards`}>02 · Team awards</NavLink>
          </>
        }
      />
      <main className="container">
        <Outlet />
        <Footer teamName={team.name} />
      </main>
    </>
  );
}
