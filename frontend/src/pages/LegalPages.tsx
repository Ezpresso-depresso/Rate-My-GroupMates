/* Privacy policy + terms. Public (no sign-in) because Google's consent screen links to them. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../config';
import '../components/layout/Layout.css';
import './LegalPages.css';

const UPDATED = 'November 22, 2026';

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
        after a project, and helps students find groupmates by class. This page explains what it stores, who can see
        it, and why.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your name and email. If you sign in with Google, also Google’s ID for your
          account (so you get the same account every time); we don’t get your Google password or access to Gmail, Drive
          or anything else. If you sign up with a password, we store only a one-way hash of it, never the password
          itself, plus a count of recent wrong passwords (10 within 15 minutes locks sign-in for 15 minutes).
        </li>
        <li>
          <strong>Your profile:</strong> anything you add: a nickname, profile picture, short bio, preset background,
          the classes you list, and the comments and awards you pin.
        </li>
        <li>
          <strong>Classes:</strong> your profile lists the course of every group you’ve joined, plus classes you add
          yourself, minus ones you remove. The course list itself is public UCI catalogue data.
        </li>
        <li>
          <strong>Groups:</strong> group names, courses, and the emails of the people invited to each group.
        </li>
        <li>
          <strong>Ratings:</strong> the stars, scores and comments you give teammates, and whether you marked a review
          anonymous.
        </li>
        <li>
          <strong>In your browser only:</strong> your sign-in token, ratings you haven’t submitted yet, your progress
          in the guided tour, and your last Find Groupmates search (cleared when you close the tab). Signing out
          removes the token.
        </li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>
          <strong>Anyone signed in to the app</strong> can find you in Find Groupmates by name, email or class, and
          can see your name, email, profile picture, bio, background, classes and overall star rating. Your profile
          page also shows them the ratings, comments and awards you’ve received.
        </li>
        <li>
          Ratings only count toward your profile from groups where you’ve submitted your own reviews. Comments show
          who wrote them unless the reviewer marked them anonymous; for anonymous reviews nobody else sees the
          author (the app still stores it, so the author can edit their review).
        </li>
        <li>
          <strong>People in a group</strong> also see the emails of everyone invited to it, and the ratings given
          inside it.
        </li>
        <li>
          <strong>Profile pictures</strong> are served from a public link so they load in the app; anyone with that
          link can view the image.
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

      <h2>Changing or deleting your data</h2>
      <p>
        You can change or remove your nickname, picture, bio, background, classes and pins from your profile at any
        time, and leave or decline a group before reviews start (a group’s creator can delete it). There’s no button
        to delete your whole account yet: to have your account, ratings or anything else removed, contact{' '}
        <Contact /> and we’ll delete it.
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
