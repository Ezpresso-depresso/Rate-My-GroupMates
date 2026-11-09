import { useEffect, useMemo, useState } from 'react';
import { AvatarEditor } from '../components/profile/AvatarEditor';
import { AwardsSection } from '../components/profile/AwardsSection';
import { CommentsSection } from '../components/profile/CommentsSection';
import { NameEditor } from '../components/profile/NameEditor';
import { RatingSection } from '../components/profile/RatingSection';
import { useAuth } from '../hooks/useAuth';
import { MAX_PINS, profileAwards } from '../lib/profile';
import { api, type ApiError } from '../services/api';
import type { ProfileData } from '../types';
import '../components/groups/Groups.css';
import '../components/profile/Profile.css';

type State = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; profile: ProfileData };

export function ProfilePage() {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    let ignore = false;
    api
      .getProfile()
      .then((profile) => !ignore && setState({ kind: 'ready', profile }))
      .catch((err: ApiError) => !ignore && setState({ kind: 'error', message: err.message }));
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const profile = state.kind === 'ready' ? state.profile : null;
  const awards = useMemo(() => (profile ? profileAwards(profile) : []), [profile]);

  /** Pin or unpin, saving right away; puts things back if the save fails. */
  const togglePin = async (kind: 'comments' | 'awards', id: string) => {
    if (!profile) return;
    const field = kind === 'comments' ? 'pinnedComments' : 'pinnedAwards';
    // Drop pins whose comment/award no longer exists, so they don't count toward the limit.
    const exists = (pin: string) =>
      kind === 'comments' ? profile.reviews.some((r) => r.id === pin && r.text) : awards.some((a) => a.key === pin);
    const current = profile[field].filter(exists);
    const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    if (next.length > MAX_PINS) return;

    setPinError('');
    setState({ kind: 'ready', profile: { ...profile, [field]: next } });
    try {
      const saved = await api.setPins({ [kind]: next });
      setState((s) => (s.kind === 'ready' ? { kind: 'ready', profile: { ...s.profile, ...saved } } : s));
    } catch (err) {
      setPinError(`Couldn’t save that pin: ${(err as ApiError).message}`);
      setState((s) => (s.kind === 'ready' ? { kind: 'ready', profile: { ...s.profile, [field]: profile[field] } } : s));
    }
  };

  return (
    <div className="profile-page">
      <div className="page-heading profile-heading">
        <AvatarEditor size={96} />
        <div>
          <div className="eyebrow">Profile</div>
          <NameEditor />
          <span className="muted profile-email">{user.email}</span>
        </div>
      </div>

      {state.kind === 'loading' && <p className="muted">Loading your ratings…</p>}
      {state.kind === 'error' && (
        <div className="card empty-groups" role="alert">
          <h2>Couldn’t load your profile</h2>
          <p className="muted">{state.message}</p>
          <button
            className="btn"
            onClick={() => {
              setState({ kind: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {profile && (
        <div className="profile-sections">
          <p className="error" role="alert">
            {pinError}
          </p>
          <RatingSection reviews={profile.reviews} groupCount={profile.groups.length} />
          <CommentsSection profile={profile} onTogglePin={(id) => togglePin('comments', id)} />
          <AwardsSection awards={awards} pinnedKeys={profile.pinnedAwards} onTogglePin={(key) => togglePin('awards', key)} />
        </div>
      )}
    </div>
  );
}
