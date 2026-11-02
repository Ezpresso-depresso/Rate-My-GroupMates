import { Link } from 'react-router-dom';
import './Common.css';

interface StatusScreenProps {
  title: string;
  message?: string;
  onRetry?: () => void;
  /** A second, quieter action: a button, or a link when `to` is given. */
  secondary?: { label: string; onClick?: () => void; to?: string };
}

/** Full-page loading / error state. */
export function StatusScreen({ title, message, onRetry, secondary }: StatusScreenProps) {
  const isError = Boolean(onRetry || secondary);
  return (
    <main className="status-screen" role={isError ? 'alert' : 'status'}>
      <div className="card">
        <h2>{title}</h2>
        {message && <p className="muted">{message}</p>}
        {isError && (
          <div className="status-actions">
            {onRetry && (
              <button className="btn" onClick={onRetry}>
                Try again
              </button>
            )}
            {secondary &&
              (secondary.to ? (
                <Link className="textbtn" to={secondary.to}>
                  {secondary.label}
                </Link>
              ) : (
                <button className="textbtn" onClick={secondary.onClick}>
                  {secondary.label}
                </button>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
