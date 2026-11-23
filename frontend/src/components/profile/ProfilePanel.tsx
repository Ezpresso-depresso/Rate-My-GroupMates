import type { CSSProperties, ReactNode } from 'react';
import { BACKGROUND_OPACITY, backgroundById } from '../../lib/backgrounds';
import './Profile.css';

interface Props {
  backgroundId?: string;
  children: ReactNode;
}

/** The raised panel a profile sits on, with its owner's preset background (if any) faded behind it. */
export function ProfilePanel({ backgroundId, children }: Props) {
  const background = backgroundById(backgroundId);
  return (
    <div
      className={`profile-page${background ? ` has-background bg-${background.id}` : ''}`}
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
