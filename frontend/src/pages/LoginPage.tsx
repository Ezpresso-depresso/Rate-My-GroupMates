import { useContext, useEffect, useState, type FormEvent } from 'react';
import { GoogleButton } from '../components/auth/GoogleButton';
import { AuthGateContext } from '../context/authContext';
import { isEmail, normalizeEmail } from '../lib/emails';
import { api, type ApiError } from '../services/api';
import type { AuthConfig, Session } from '../types';
import '../components/auth/Auth.css';
import '../components/layout/Layout.css';

type ConfigState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; config: AuthConfig };

export function LoginPage() {
  const gate = useContext(AuthGateContext);
  if (!gate) throw new Error('LoginPage must be rendered by <AuthProvider>');
  const { signIn, notice } = gate;

  const [config, setConfig] = useState<ConfigState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .authConfig()
      .then((c) => !ignore && setConfig({ kind: 'ready', config: c }))
      .catch((err: ApiError) => !ignore && setConfig({ kind: 'error', message: err.message }));
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const finish = async (login: () => Promise<Session>) => {
    setError('');
    setBusy(true);
    try {
      signIn(await login());
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  };

  return (
    <main className="status-screen">
      <div className="card login-card">
        <div className="login-brand">
          <span className="logo">10</span>
          Rate My Groupmates
        </div>
        <p className="login-pitch">
          Rate your teammates after a group project.
          <br />
          <span className="muted">Then find out who carried. (It was you. Probably.)</span>
        </p>

        {notice && <p className="notice">{notice}</p>}

        {config.kind === 'loading' && <p className="muted">Loading sign-in…</p>}
        {config.kind === 'error' && (
          <div role="alert">
            <p className="error">Couldn’t reach the server: {config.message}</p>
            <button
              className="btn"
              onClick={() => {
                setConfig({ kind: 'loading' });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        )}
        {config.kind === 'ready' && (
          <>
            {config.config.googleClientId ? (
              <div className={busy ? 'login-google busy' : 'login-google'} aria-busy={busy}>
                <GoogleButton
                  clientId={config.config.googleClientId}
                  onCredential={(credential) => finish(() => api.googleLogin(credential))}
                  onError={setError}
                />
                {busy && <p className="muted small">Signing you in…</p>}
              </div>
            ) : (
              !config.config.devLogin && (
                <p className="error">
                  Google sign-in isn’t set up yet. Set GOOGLE_CLIENT_ID on the backend (see backend/.env.example).
                </p>
              )
            )}
            {config.config.devLogin && <DevLogin busy={busy} onSubmit={(email, name) => finish(() => api.devLogin(email, name))} />}
          </>
        )}

        <p className="error" role="alert">
          {error}
        </p>
      </div>
    </main>
  );
}

/** Local testing only (backend DEV_LOGIN=true): sign in as anyone, no Google. */
function DevLogin({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string, name: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = normalizeEmail(email);
    if (!isEmail(clean)) return setError('Enter a valid email address');
    setError('');
    onSubmit(clean, name.trim());
  };

  return (
    <form className="dev-login" onSubmit={submit} noValidate>
      <div className="eyebrow">Test login · local dev only</div>
      <input
        className="input"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="zahi@example.com"
        aria-label="Email"
        autoComplete="email"
      />
      <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Name" maxLength={80} />
      <button className="btn" disabled={busy}>
        Sign in
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
