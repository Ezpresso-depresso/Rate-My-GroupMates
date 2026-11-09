import type { ReactNode } from 'react';
import { PENDING_COLOR } from '../../lib/teams';
import type { TeamMember } from '../../types';
import { Avatar } from '../common/Avatar';

export function MemberRow({ member, tags, action }: { member: TeamMember; tags?: ReactNode; action?: ReactNode }) {
  const joined = member.status === 'accepted';
  // Joined members and invitees who already have an account show their username, email underneath;
  // invitees without an account only have the email.
  const name = joined ? member.name : member.accountName;
  return (
    <li className="member-row">
      <Avatar member={joined ? member : { ...member, color: PENDING_COLOR }} size={36} />
      <div className="member-row-text">
        <strong>
          {name ?? member.email}
          {tags}
        </strong>
        {name && <span className="muted small">{member.email}</span>}
      </div>
      <span className={joined ? 'pill-status ok' : 'pill-status'}>{joined ? 'Joined' : 'Invited'}</span>
      {action}
    </li>
  );
}
