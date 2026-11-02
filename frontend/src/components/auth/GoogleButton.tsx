/* "Sign in with Google" via Google Identity Services. Hands the ID token (credential) to onCredential. */
import { useEffect, useRef, useState } from 'react';

interface GoogleId {
  initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<GoogleId> | null = null;

function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  scriptPromise ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('missing')));
    script.onerror = () => reject(new Error('blocked'));
    document.head.appendChild(script);
  }).catch((err) => {
    scriptPromise = null; // let a retry load it again
    document.querySelector(`script[src="${SCRIPT_SRC}"]`)?.remove();
    throw err;
  });
  return scriptPromise;
}

interface GoogleButtonProps {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}

export function GoogleButton({ clientId, onCredential, onError }: GoogleButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Keep the latest callbacks without re-rendering Google's button on every parent render.
  const callbacks = useRef({ onCredential, onError });
  useEffect(() => {
    callbacks.current = { onCredential, onError };
  });

  useEffect(() => {
    let ignore = false;
    loadGoogle()
      .then((gis) => {
        if (ignore || !ref.current) return;
        gis.initialize({
          client_id: clientId,
          callback: ({ credential }) =>
            credential
              ? callbacks.current.onCredential(credential)
              : callbacks.current.onError('Google didn’t send back a sign-in. Please try again'),
        });
        gis.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
      })
      .catch(() => !ignore && setFailed(true));
    return () => {
      ignore = true;
    };
  }, [clientId, attempt]);

  if (failed)
    return (
      <div className="google-failed">
        <p className="error">
          Couldn’t load Google sign-in. An ad or tracker blocker might be stopping it; try allowing accounts.google.com
          or another browser.
        </p>
        <button
          className="textbtn"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  return <div ref={ref} className="google-button" />;
}
