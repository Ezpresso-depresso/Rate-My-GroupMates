// Separate Vite development entry. Not included in the production build or API-backed app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';
import { ReviewContext } from '../src/context/reviewContext';
import { emptyDraft } from '../src/lib/ratingCore';
import { AwardsPage } from '../src/pages/AwardsPage';
import { Layout } from '../src/components/layout/Layout';
import '../src/index.css';

export function Preview() {
  const requested = Number(new URLSearchParams(window.location.search).get('members'));
  const count = Number.isInteger(requested) && requested >= 2 && requested <= 24 ? requested : 4;
  const team = { id: 'local-preview', name: 'The Night Shift', course: 'LOCAL PREVIEW', members: Array.from({ length: count }, (_, i) => ({ id: `preview-${i}`, name: ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan'][i] ?? `Teammate ${i + 1}`, color: '#aabbcc' })) };
  const scores = [{ participation: 9, communication: 9, quality: 9 }, { participation: 7, communication: 9, quality: 6 }, { participation: 6, communication: 7, quality: 9 }, { participation: 8, communication: 9, quality: 7 }];
  const reviews = team.members.map((member, i) => ({ id: `sample-${i}`, teamId: team.id, reviewerId: team.members[(i + 1) % count].id, targetId: member.id, rating: 4, scores: scores[i % scores.length], text: '', anonymous: false, submittedAt: '' }));
  return <><div style={{ padding: '10px 20px', background: '#f6d782', color: '#29253a', fontSize: 12, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
    <strong>LOCAL PREVIEW · Original awards page + optional afterparty below · Fictional data · No database connection</strong></div>
    <ReviewContext.Provider key={count} value={{ team, currentUser: team.members[0], teammates: team.members.slice(1), reviews, hasSubmitted: true, draftFor: emptyDraft, updateDraft: () => {}, submitAll: async () => null, switchMember: () => {} }}>
      <MemoryRouter initialEntries={['/awards']}><Routes><Route element={<Layout />}>
        <Route path="/awards" element={<AwardsPage />} />
        <Route path="/" element={<section className="card" style={{ padding: 24 }}><h2>Local preview only</h2><p>This preview does not replace the rating or member-selection pages. Open the regular app with a working test backend to use those pages.</p><Link className="btn" to="/awards">Back to awards</Link></section>} />
      </Route></Routes></MemoryRouter>
    </ReviewContext.Provider>
  </>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Preview /></StrictMode>);
