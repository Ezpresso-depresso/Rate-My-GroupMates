import './Common.css';

export function Stars({ value }: { value: number | null }) {
  const lit = Math.round(value ?? 0);
  return (
    <span className="stars" aria-label={`${value?.toFixed(1) ?? 'No'} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < lit ? 'lit' : ''}>
          {i < lit ? '★' : '☆'}
        </span>
      ))}
    </span>
  );
}
