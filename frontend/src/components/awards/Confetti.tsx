import type { CSSProperties } from 'react';
import './Awards.css';

const COLORS = ['#ffd94b', '#8185ed', '#e5b7dd'];

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--x': `${(i * 17) % 100}%`,
              '--r': `${i * 41}deg`,
              '--d': `${(i % 5) * 0.09}s`,
              '--c': COLORS[i % 3],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
