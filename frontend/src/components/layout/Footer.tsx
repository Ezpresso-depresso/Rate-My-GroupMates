import { Link } from 'react-router-dom';
import './Layout.css';

export function Footer({ teamName }: { teamName: string }) {
  return (
    <footer className="site-footer">
      <span>
        {teamName} · Review &amp; awards
        <br />
        Drafts stay in this browser until you submit
      </span>
      <Link className="textbtn" to="/about-awards">
        About awards
      </Link>
    </footer>
  );
}
