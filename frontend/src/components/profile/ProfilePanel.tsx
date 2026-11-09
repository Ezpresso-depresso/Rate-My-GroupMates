import type { CSSProperties, ReactNode } from 'react';
import { BACKGROUND_OPACITY, backgroundById } from '../../lib/backgrounds';
import './Profile.css';

/** The raised panel a profile sits on, with its owner's preset background (if any) faded behind it. */
export function ProfilePanel({ backgroundId, children }: { backgroundId?: string; children: ReactNode }) {
  const background = backgroundById(backgroundId);
  return (
    <div
      className={`profile-page ${background ? 'has-background' : ''}`}
      style={
        background
          ? ({ '--profile-bg': `url(${background.src})`, '--profile-bg-opacity': background.opacity ?? BACKGROUND_OPACITY } as CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
