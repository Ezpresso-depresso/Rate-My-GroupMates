/* Someone else's profile, read-only: the same sections as yours, without the editing and pinning. */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { AwardsSection } from '../components/profile/AwardsSection';
import { CommentsSection } from '../components/profile/CommentsSection';
import { ProfilePanel } from '../components/profile/ProfilePanel';
import { RatingSection } from '../components/profile/RatingSection';
import { useAuth } from '../hooks/useAuth';
import { profileAwards } from '../lib/profile';
import { api, type ApiError } from '../services/api';
import type { UserProfileData } from '../types';
import '../components/groups/Groups.css';
import '../components/profile/Profile.css';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; data: UserProfileData };

export function UserProfilePage() {
  const { userId = '' } = useParams();
  const { user: me } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (userId === me.id) return;
    let ignore = false;
    api
      .getUserProfile(userId)
      .then((data) => !ignore && setState({ kind: 'ready', data }))
      .catch((err: ApiError) => !ignore && setState({ kind: 'error', message: err.message }));
    return () => {
      ignore = true;
    };
  }, [userId, me.id, attempt]);

  const data = state.kind === 'ready' ? state.data : null;
  const awards = useMemo(() => (data ? profileAwards(data) : []), [data]);

  if (userId === me.id) return <Navigate to="/profile" replace />;

  if (state.kind === 'loading') return <p className="muted">Loading profile…</p>;
  if (state.kind === 'error')
    return (
      <div className="card empty-groups" role="alert">
        <h2>Couldn’t load this profile</h2>
        <p className="muted">{state.message}</p>
        <div className="status-actions">
          <button
            className="btn"
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
          <Link className="textbtn" to="/profiles">
            Back to search
          </Link>
        </div>
      </div>
    );

  const { user } = state.data;
  return (
    <ProfilePanel backgroundId={user.profileBackground}>
      <div className="card profile-section page-heading profile-heading">
        <Avatar member={user} size={96} />
        <div>
          <h1>{user.fullName || user.name}</h1>
          <span className="muted profile-email">{user.email}</span>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
        </div>
        <Link className="textbtn back-to-search" to="/profiles">
          ← Back to search
        </Link>
      </div>

      <div className="profile-sections">
        <RatingSection reviews={state.data.reviews} groupCount={state.data.groups.length} own={false} />
        <CommentsSection profile={state.data} />
        <AwardsSection awards={awards} pinnedKeys={state.data.pinnedAwards} />
      </div>
    </ProfilePanel>
  );
}
