import type { Team, TeamMember, User } from '../types';

/** The signed-in user's entry in a group: by account once accepted, by email while invited. */
export function viewerOf(team: Team, user: User): TeamMember | undefined {
  return team.members.find((m) => m.userId === user.id) ?? team.members.find((m) => m.email === user.email);
}

export const ownerOf = (team: Team) => team.members.find((m) => m.userId === team.owner);

export const acceptedCount = (team: Team) => team.members.filter((m) => m.status === 'accepted').length;

/** Invited people show a grey avatar until they join. */
export const PENDING_COLOR = '#b8bdd0';

export const groupPath = (teamId: string) => `/groups/${teamId}`;
export const joinPath = (teamId: string) => `/join/${teamId}`;
export const joinUrl = (teamId: string) => `${window.location.origin}${joinPath(teamId)}`;
