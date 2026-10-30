/* Thin client for the backend REST API. Mirrors backend/src/routes. */
import { API_URL } from '../config';
import type { Member, Review, ReviewDraft, Team } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? `Request failed with ${res.status}`);
  return body as T;
}

export interface SubmitReviewsPayload {
  reviewerId: string;
  reviews: (ReviewDraft & { targetId: string })[];
}

export const api = {
  health: () => request<{ status: string; db: string }>('/health'),

  getTeams: () => request<Team[]>('/teams'),
  getTeam: (teamId: string) => request<Team>(`/teams/${teamId}`),
  createTeam: (team: Omit<Team, 'id'>) =>
    request<Team>('/teams', { method: 'POST', body: JSON.stringify(team) }),
  /** PLAYTEST ONLY: adds a new member to the team. Remove with the backend joinTeam route. */
  joinTeam: (teamId: string, name: string) =>
    request<Member>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ name }) }),

  /** `viewerId` gets your own anonymous reviews back with their reviewerId intact. */
  getReviews: (teamId: string, viewerId?: string) =>
    request<Review[]>(`/teams/${teamId}/reviews${viewerId ? `?viewerId=${encodeURIComponent(viewerId)}` : ''}`),
  submitReviews: (teamId: string, payload: SubmitReviewsPayload) =>
    request<Review[]>(`/teams/${teamId}/reviews`, { method: 'POST', body: JSON.stringify(payload) }),
};
