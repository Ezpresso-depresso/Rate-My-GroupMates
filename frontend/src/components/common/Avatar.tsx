import { API_URL } from '../../config';
import { initials, tierFor } from '../../lib/ratingCore';
import type { Member } from '../../types';
import './Common.css';

interface AvatarProps {
  member: Member;
  size?: number;
  className?: string;
  /** The Pope (a perfect 5.0): a gold glow around the picture. Other ranks have no glow, just a tag.
   *  Defaults to the member's own overall rating when it's known. */
  glow?: boolean;
}

/** Group members' pictures come as API paths; your own comes as a data URL. */
const avatarSrc = (avatar: string) => (avatar.startsWith('/') ? `${API_URL}${avatar}` : avatar);

/** Profile picture when there is one, otherwise initials on the member's color. */
const isPope = (m: Member) => !!m.rating && tierFor(m.rating.average).tone === 'pope';

export function Avatar({ member, size = 34, className = '', glow }: AvatarProps) {
  return (
    <span
      className={`avatar ${(glow ?? isPope(member)) ? 'avatar-pope ' : ''}${className}`}
      style={{ background: member.color, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {member.avatar ? <img className="avatar-img" src={avatarSrc(member.avatar)} alt="" /> : initials(member.name)}
    </span>
  );
}
