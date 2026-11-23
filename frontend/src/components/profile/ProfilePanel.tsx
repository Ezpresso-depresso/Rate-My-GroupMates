import type { CSSProperties, ReactNode } from 'react';
import { BACKGROUND_OPACITY, backgroundById } from '../../lib/backgrounds';
import './Profile.css';

interface Props {
  backgroundId?: string;
  /** The Pope (a perfect 5.0): the panel glows gold instead of casting a shadow. */
  glow?: boolean;
  children: ReactNode;
}

/** The raised panel a profile sits on, with its owner's preset background (if any) faded behind it. */
export function ProfilePanel({ backgroundId, glow, children }: Props) {
  const background = backgroundById(backgroundId);
  return (
    <div
      className={`profile-page${background ? ` has-background bg-${background.id}` : ''}${glow ? ' pope-glow' : ''}`}
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
