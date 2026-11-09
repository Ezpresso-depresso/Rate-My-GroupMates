/*
 * Your avatar on the profile page. Hover shows a pen; click to pick a picture, or drag one onto it.
 * The image is cropped/resized in the browser (lib/image.ts) before upload.
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AVATAR_ACCEPT, toAvatarDataUrl } from '../../lib/image';
import { api, type ApiError } from '../../services/api';
import { Avatar } from '../common/Avatar';
import './Profile.css';

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

export function AvatarEditor({ size = 96 }: { size?: number }) {
  const { user, updateUser } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // A file dropped just outside the avatar would otherwise make the browser open it and leave the app.
  useEffect(() => {
    const block = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError((err as ApiError | Error).message);
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File | undefined) =>
    file && run(async () => updateUser(await api.setAvatar(await toAvatarDataUrl(file))));

  const remove = () => run(async () => updateUser(await api.removeAvatar()));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!busy) upload(e.dataTransfer.files[0]);
  };

  return (
    <div className="avatar-editor">
      <button
        type="button"
        className={`avatar-drop ${dragging ? 'dragging' : ''}`}
        style={{ width: size, height: size }}
        onClick={() => input.current?.click()}
        onDragEnter={(e) => hasFiles(e) && setDragging(true)}
        onDragOver={(e) => hasFiles(e) && e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={busy}
        aria-label="Change profile picture: click to choose a file, or drop an image here"
        title="Change profile picture"
      >
        <Avatar member={user} size={size} />
        <span className="avatar-overlay" aria-hidden="true">
          {busy ? (
            <span className="avatar-spinner" />
          ) : (
            <svg viewBox="0 0 24 24" width={size * 0.3} height={size * 0.3} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={AVATAR_ACCEPT}
        hidden
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = ''; // so picking the same file again still triggers onChange
        }}
      />
      {user.avatar && (
        <button type="button" className="textbtn avatar-remove" onClick={remove} disabled={busy}>
          Remove photo
        </button>
      )}
      {error && (
        <p className="error avatar-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
