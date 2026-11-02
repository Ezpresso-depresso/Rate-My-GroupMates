/* Privacy policy + terms. Public (no sign-in) because Google's consent screen links to them. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../config';
import '../components/layout/Layout.css';
import './LegalPages.css';

const UPDATED = 'November 2, 2026';

function Contact() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
  ) : (
    <>the Group 16 team (INF 151, UC Irvine)</>
  );
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="logo">10</span>
          Rate My Groupmates
        </Link>
      </header>
      <main className="container legal">
        <article className="card legal-card">
          <div className="eyebrow">Last updated {UPDATED}</div>
          <h1>{title}</h1>
          {children}
        </article>
        <LegalLinks />
      </main>
    </>
  );
}

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label="Legal">
      <Link to="/privacy">Privacy</Link>
      <span aria-hidden="true">·</span>
      <Link to="/terms">Terms</Link>
    </nav>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy">
      <p>
        Rate My Groupmates is a student project for INF 151 at UC Irvine. It lets people in a class group rate each other
        after a project. This page explains what it stores and why.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>From Google sign-in:</strong> your name and email address, and Google’s ID for your account (so you get
          the same account every time). We don’t get your password and don’t ask for access to Gmail, Drive or anything
          else.
        </li>
        <li>
          <strong>Groups:</strong> group names, courses, and the emails of the people invited to each group.
        </li>
        <li>
          <strong>Ratings:</strong> the stars, scores and comments you give teammates, and whether you marked a review
          anonymous.
        </li>
        <li>
          <strong>In your browser:</strong> a sign-in token and any ratings you haven’t submitted yet. Signing out
          removes the token.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>People in a group see each other’s names and emails, and the emails of people invited to it.</li>
        <li>
          Group members see the ratings and comments given inside that group. For anonymous reviews, other members
          don’t see who wrote them (the app still stores it, so you can edit your own).
        </li>
        <li>
          The project team can access the database to run and fix the app. Nobody else gets your data. We don’t sell
          it, share it with advertisers or use it for anything outside this app. (The “selling this data” line on the
          rating page is a joke.)
        </li>
      </ul>

      <h2>Where it’s kept</h2>
      <p>
        The app runs on Vercel and the data is stored in a MongoDB Atlas database. Data is sent over HTTPS.
      </p>

      <h2>Deleting your data</h2>
      <p>
        You can leave or decline a group before reviews start, and a group’s creator can delete it. To have your
        account, ratings or anything else removed, contact <Contact /> and we’ll delete it.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, we’ll update this page and the date above.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use">
      <p>
        Rate My Groupmates is a student project for INF 151 at UC Irvine, provided as-is for coursework and demos. By
        using it you agree to the following.
      </p>
      <ul>
        <li>Be honest and respectful. Ratings are opinions about teamwork, not a place for harassment or personal attacks.</li>
        <li>Don’t try to access groups you weren’t invited to, or to break or overload the app.</li>
        <li>Ratings and awards are just for fun and feedback. They aren’t official grades or evaluations.</li>
        <li>
          The app may change, have bugs or be taken down at any time, and data may be reset. Don’t rely on it as the only
          copy of anything important.
        </li>
        <li>
          We may remove content or accounts that break these terms. Questions: <Contact />.
        </li>
      </ul>
      <p>
        See also the <Link to="/privacy">privacy policy</Link>.
      </p>
    </LegalLayout>
  );
}
