import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Shell } from './components/layout/Shell';
import { AuthProvider } from './context/AuthProvider';
import { ReviewProvider } from './context/ReviewProvider';
import { AwardsPage } from './pages/AwardsPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { GroupsPage } from './pages/GroupsPage';
import { JoinPage } from './pages/JoinPage';
import { RatePage } from './pages/RatePage';

/** One group's rating flow; remounts when the group changes so no state leaks between groups. */
function GroupRoute() {
  const { teamId = '' } = useParams();
  return (
    <ReviewProvider key={teamId} teamId={teamId}>
      <Outlet />
    </ReviewProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Shows the login page in place of any route until signed in, so invite links survive sign-in. */}
      <AuthProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<GroupsPage />} />
            <Route path="groups/new" element={<CreateGroupPage />} />
            <Route path="join/:teamId" element={<JoinPage />} />
          </Route>
          <Route path="groups/:teamId" element={<GroupRoute />}>
            <Route element={<Layout />}>
              <Route index element={<RatePage />} />
              <Route path="awards" element={<AwardsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
