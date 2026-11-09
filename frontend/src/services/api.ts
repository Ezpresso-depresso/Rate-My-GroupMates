/* Thin client for the backend REST API. Mirrors backend/src/routes. */
import { API_URL } from '../config';
import type { AuthConfig, ProfileData, Review, ReviewDraft, Session, Team, User } from '../types';
import { getToken } from './session';

/** `status` is the HTTP status, or 0 when the server couldn't be reached at all. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (message: string) => void = () => {};
/** Called when a signed-in request comes back 401 (expired or revoked session). */
export function setUnauthorizedHandler(handler: (message: string) => void) {
  onUnauthorized = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Couldn’t reach the server. Check your connection and try again');
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof body?.message === 'string'
        ? body.message
        : res.status >= 500
          ? 'The server ran into a problem. Try again in a moment'
          : `Request failed (${res.status})`;
    if (res.status === 401 && token) onUnauthorized(message);
    throw new ApiError(res.status, message);
  }
  if (body === null) throw new ApiError(res.status, 'The server sent an unexpected response');
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export interface SubmitReviewsPayload {
  reviews: (ReviewDraft & { targetId: string })[];
}

export interface NewTeam {
  name: string;
  course: string;
  emails: string[];
}

export const api = {
  health: () => request<{ status: string; db: string }>('/health'),

  // Auth
  authConfig: () => request<AuthConfig>('/auth/config'),
  googleLogin: (credential: string) => post<Session>('/auth/google', { credential }),
  register: (name: string, email: string, password: string) => post<Session>('/auth/register', { name, email, password }),
  login: (email: string, password: string) => post<Session>('/auth/login', { email, password }),
  /** Signs out your other sessions; returns a fresh one for this browser. */
  changePassword: (currentPassword: string, newPassword: string) =>
    post<Session>('/auth/password', { currentPassword, newPassword }),
  me: () => request<User>('/auth/me'),
  /** Full name; groups show the first word of it. */
  setName: (name: string) => request<User>('/auth/name', { method: 'PUT', body: JSON.stringify({ name }) }),
  /** `image` is a data URL from lib/image.ts. */
  setAvatar: (image: string) => request<User>('/auth/avatar', { method: 'PUT', body: JSON.stringify({ image }) }),
  removeAvatar: () => request<User>('/auth/avatar', { method: 'DELETE' }),

  // Profile
  getProfile: () => request<ProfileData>('/profile'),
  /** Replaces whichever list is sent (up to 3 each). */
  setPins: (pins: { comments?: string[]; awards?: string[] }) =>
    request<Pick<ProfileData, 'pinnedComments' | 'pinnedAwards'>>('/profile/pins', {
      method: 'PUT',
      body: JSON.stringify(pins),
    }),

  // Groups
  getTeams: () => request<Team[]>('/teams'),
  getTeam: (teamId: string) => request<Team>(`/teams/${teamId}`),
  createTeam: (team: NewTeam) => post<Team>('/teams', team),
  deleteTeam: (teamId: string) => request<void>(`/teams/${teamId}`, { method: 'DELETE' }),
  acceptInvite: (teamId: string, code: string) => post<Team>(`/teams/${teamId}/accept`, { code }),
  /** Declines an invitation, or leaves a group that hasn't started reviews. */
  leaveTeam: (teamId: string) => post<void>(`/teams/${teamId}/leave`),
  addInvites: (teamId: string, emails: string[]) => post<Team>(`/teams/${teamId}/invites`, { emails }),
  cancelInvite: (teamId: string, memberId: string) =>
    request<Team>(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE' }),
  regenerateCode: (teamId: string) => post<Team>(`/teams/${teamId}/code`),

  // Reviews (the reviewer is whoever is signed in)
  getReviews: (teamId: string) => request<Review[]>(`/teams/${teamId}/reviews`),
  submitReviews: (teamId: string, payload: SubmitReviewsPayload) =>
    post<Review[]>(`/teams/${teamId}/reviews`, payload),
};
