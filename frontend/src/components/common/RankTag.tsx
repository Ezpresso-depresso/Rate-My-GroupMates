import { tierFor } from '../../lib/ratingCore';

/** Someone's overall rank as a small tag next to their name. Only The Pope also gets an avatar glow (see Avatar). */
export function RankTag({ average }: { average: number | null }) {
  const rank = tierFor(average);
  return (
    <span className="tag rank-tag" title={rank.meaning}>
      {rank.symbol} {rank.name}
    </span>
  );
}
