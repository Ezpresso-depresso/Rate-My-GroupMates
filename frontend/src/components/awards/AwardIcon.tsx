/*
 * A signature award's icon. Most are a single text symbol (FunnyAward.icon); the few with no good
 * symbol are drawn here as tiny one-colour pictures in the same style. Both are sized by the
 * surrounding font size (1em) and coloured by it (currentColor), so they fit any award circle.
 */
import type { ReactNode } from 'react';

const DRAWN: Record<string, ReactNode> = {
  // The Third Wheel: a wheel (rim, hub and six spokes).
  thirdwheel: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="2.4" />
      <path
        d="M12 3.5v17M4.6 7.75l14.8 8.5M4.6 16.25l14.8-8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </>
  ),
  // Hard Carry: someone leaning into a big boulder, pushing it up a slope (Sisyphus).
  carry: (
    <>
      <path d="M1 22.2 23 13.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="8.6" r="6" />
      <circle cx="6.8" cy="7.4" r="2.2" />
      <path
        d="M7.5 10.1 5.2 15.6M7.8 10.9l2.3-2.1M5.2 15.6l-2.5 5.2M5.2 15.6l2.4 1.7-.3 2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // Group Leader: a wolf’s head and neck, muzzle pointed up, howling; a crescent moon to its right.
  leader: (
    <>
      <path d="M6.6 23C6.8 18.4 7.6 14.6 9.2 11.6l.6-5.3 1.8-3.9 1.4 3.9 5.6-3.7 1 1.3-4 4.8c.3 3.9.8 8.7 1.9 14.3Z" />
      <path d="M20.8 8.4a3.1 3.1 0 1 0 2.6 4.9 2.5 2.5 0 0 1-2.6-4.9Z" />
    </>
  ),
};

export function AwardIcon({ id, symbol }: { id: string; symbol: string }) {
  const drawn = DRAWN[id];
  if (!drawn)
    return (
      <span className="award-symbol" aria-hidden="true">
        {symbol}
      </span>
    );
  return (
    <svg className="award-symbol" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      {drawn}
    </svg>
  );
}
