import { useContext, useEffect, useState, type FormEvent } from 'react';
import { GoogleButton } from '../components/auth/GoogleButton';
import { AuthGateContext } from '../context/authContext';
import { isEmail, normalizeEmail } from '../lib/emails';
import { PASSWORD_MIN, passwordProblem } from '../lib/passwords';
import { api, type ApiError } from '../services/api';
import type { AuthConfig, Session } from '../types';
import { LegalLinks } from './LegalPages';
import '../components/auth/Auth.css';
import '../components/layout/Layout.css';

type Mode = 'signIn' | 'signUp';

export function LoginPage() {
  const gate = useContext(AuthGateContext);
  if (!gate) throw new Error('LoginPage must be rendered by <AuthProvider>');
  const { signIn, notice } = gate;

  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Google is optional: the button only shows when the server has GOOGLE_CLIENT_ID set.
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    let ignore = false;
    api
      .authConfig()
      .then((c) => !ignore && setConfig(c))
      .catch(() => {}); // without the config we just don't offer Google; email + password still works
    return () => {
      ignore = true;
    };
  }, []);

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

  const switchTo = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeEmail(email);
    if (mode === 'signUp') {
      if (!name.trim()) return setError('Enter your name');
      if (!isEmail(cleanEmail)) return setError('Enter a valid email address');
      const problem = passwordProblem(password, cleanEmail);
      if (problem) return setError(problem);
      return finish(() => api.register(name.trim(), cleanEmail, password));
    }
    if (!cleanEmail || !password) return setError('Enter your email and password');
    finish(() => api.login(cleanEmail, password));
  };

  const signingUp = mode === 'signUp';

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

        {config?.googleClientId && (
          <div className="login-google">
            <GoogleButton
              clientId={config.googleClientId}
              onCredential={(credential) => finish(() => api.googleLogin(credential))}
              onError={setError}
            />
            <div className="login-or">or</div>
          </div>
        )}

        <div className="login-tabs" role="tablist" aria-label="Sign in or create an account">
          <button
            type="button"
            role="tab"
            id="tab-signIn"
            aria-selected={!signingUp}
            aria-controls="login-panel"
            onClick={() => switchTo('signIn')}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            id="tab-signUp"
            aria-selected={signingUp}
            aria-controls="login-panel"
            onClick={() => switchTo('signUp')}
          >
            Create account
          </button>
        </div>

        <form
          id="login-panel"
          role="tabpanel"
          aria-labelledby={signingUp ? 'tab-signUp' : 'tab-signIn'}
          className="login-form"
          onSubmit={submit}
          noValidate
        >
          {signingUp && (
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                placeholder="Zahi Imaduddin"
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={signingUp ? 'email' : 'username'}
              placeholder="you@uci.edu"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              aria-describedby={signingUp ? 'password-hint' : undefined}
            />
          </label>
          {signingUp && (
            <small id="password-hint" className="muted">
              At least {PASSWORD_MIN} characters. Use the email your group will invite.
            </small>
          )}

          <p className="error" role="alert">
            {error}
          </p>
          <button className="btn login-submit" disabled={busy}>
            {busy ? (signingUp ? 'Creating account…' : 'Signing in…') : signingUp ? 'Create account' : 'Sign in'}
          </button>
          {!signingUp && <p className="muted small login-forgot">Forgot your password? Ask the project team to reset it.</p>}
        </form>

        <LegalLinks />
      </div>
    </main>
  );
}
