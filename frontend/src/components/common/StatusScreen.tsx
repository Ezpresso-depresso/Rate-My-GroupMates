import './Common.css';

interface StatusScreenProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}

/** Full-page loading / error state shown before the team data is available. */
export function StatusScreen({ title, message, onRetry }: StatusScreenProps) {
  return (
    <main className="status-screen" role={onRetry ? 'alert' : 'status'}>
      <div className="card">
        <h2>{title}</h2>
        {message && <p className="muted">{message}</p>}
        {onRetry && (
          <button className="btn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </main>
  );
}
