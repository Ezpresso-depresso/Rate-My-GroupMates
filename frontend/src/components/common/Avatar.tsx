import { initials } from '../../lib/ratingCore';
import type { Member } from '../../types';
import './Common.css';

interface AvatarProps {
  member: Member;
  size?: number;
  className?: string;
}

/** Profile picture when there is one, otherwise initials on the member's color. */
export function Avatar({ member, size = 34, className = '' }: AvatarProps) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {member.avatar ? <img className="avatar-img" src={member.avatar} alt="" /> : initials(member.name)}
    </span>
  );
}
