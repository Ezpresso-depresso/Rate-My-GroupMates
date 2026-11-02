import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import './Layout.css';

/** Header + page container for screens outside a group's review flow. */
export function Shell({ children }: { children?: ReactNode }) {
  return (
    <>
      <Header />
      <main className="container">{children ?? <Outlet />}</main>
    </>
  );
}
