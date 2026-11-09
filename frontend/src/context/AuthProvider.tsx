/*
 * Holds the signed-in user. Restores the session from localStorage on load and
 * shows the login page (at the current URL, so invite links keep working after
 * sign-in) until someone signs in.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StatusScreen } from '../components/common/StatusScreen';
import { LoginPage } from '../pages/LoginPage';
import { api, ApiError, setUnauthorizedHandler } from '../services/api';
import { getToken, setToken } from '../services/session';
import type { Session, User } from '../types';
import { AuthContext, AuthGateContext } from './authContext';

type State =
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'signedOut'; notice: string }
  | { kind: 'signedIn'; user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => (getToken() ? { kind: 'checking' } : { kind: 'signedOut', notice: '' }));
  const [attempt, setAttempt] = useState(0);

  const signOut = useCallback((notice = '') => {
    setToken(null);
    setState({ kind: 'signedOut', notice });
  }, []);

  const signIn = useCallback((session: Session) => {
    setToken(session.token);
    setState({ kind: 'signedIn', user: session.user });
  }, []);

  // Any request that comes back 401 (expired/revoked session) signs out everywhere.
  useEffect(() => {
    setUnauthorizedHandler((message) => signOut(message));
  }, [signOut]);

  // Restore a saved session. Only a 401 signs you out; a network blip shows a retry screen instead.
  useEffect(() => {
    if (state.kind !== 'checking') return;
    let ignore = false;
    api
      .me()
      .then((user) => !ignore && setState({ kind: 'signedIn', user }))
      .catch((err: ApiError) => {
        if (ignore) return;
        if (err.status === 401) signOut(err.message);
        else setState({ kind: 'error', message: err.message });
      });
    return () => {
      ignore = true;
    };
  }, [state.kind, attempt, signOut]);

  if (state.kind === 'checking') return <StatusScreen title="Signing you in…" />;
  if (state.kind === 'error')
    return (
      <StatusScreen
        title="Couldn’t check your sign-in"
        message={state.message}
        onRetry={() => {
          setState({ kind: 'checking' });
          setAttempt((a) => a + 1);
        }}
        secondary={{ label: 'Sign out', onClick: () => signOut() }}
      />
    );
  if (state.kind === 'signedOut')
    return (
      <AuthGateContext.Provider value={{ signIn, notice: state.notice }}>
        <LoginPage />
      </AuthGateContext.Provider>
    );

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        signOut: () => signOut(),
        replaceSession: signIn,
        updateUser: (user) => setState({ kind: 'signedIn', user }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
