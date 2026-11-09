import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Shell } from './components/layout/Shell';
import { AuthProvider } from './context/AuthProvider';
import { ReviewProvider } from './context/ReviewProvider';
import { AwardsPage } from './pages/AwardsPage';
import { CreateGroupPage } from './pages/CreateGroupPage';
import { GroupsPage } from './pages/GroupsPage';
import { JoinPage } from './pages/JoinPage';
import { PrivacyPage, TermsPage } from './pages/LegalPages';
import { ProfilePage } from './pages/ProfilePage';
import { RatePage } from './pages/RatePage';
import { SettingsPage } from './pages/SettingsPage';

/** One group's rating flow; remounts when the group changes so no state leaks between groups. */
function GroupRoute() {
  const { teamId = '' } = useParams();
  return (
    <ReviewProvider key={teamId} teamId={teamId}>
      <Outlet />
    </ReviewProvider>
  );
}

/** Everything behind sign-in. */
function SignedInRoutes() {
  return (
    // Shows the login page in place of any route until signed in, so invite links survive sign-in.
    <AuthProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<GroupsPage />} />
          <Route path="groups/new" element={<CreateGroupPage />} />
          <Route path="join/:teamId" element={<JoinPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="account" element={<Navigate to="/settings" replace />} />
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public: Google's sign-in consent screen links here. */}
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="*" element={<SignedInRoutes />} />
      </Routes>
    </BrowserRouter>
  );
}
