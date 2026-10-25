import { Outlet } from 'react-router-dom';
import { useReviews } from '../../hooks/useReviews';
import { Footer } from './Footer';
import { Header } from './Header';
import './Layout.css';

export function Layout() {
  const { team } = useReviews();
  return (
    <>
      <Header />
      <main className="container">
        <Outlet />
        <Footer teamName={team.name} />
      </main>
    </>
  );
}
