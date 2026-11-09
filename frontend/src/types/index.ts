export type CategoryKey = 'participation' | 'communication' | 'quality';

export type Tone = 'gold' | 'silver' | 'bronze' | 'mint' | 'lilac' | 'peach' | 'pink';

export interface Category {
  key: CategoryKey;
  name: string;
  hint: string;
}

/** Anything with an avatar: a group member or the signed-in user. */
export interface Member {
  id: string;
  name: string;
  color: string;
  /**
   * Profile picture: a data URL (your own account) or an API path like "/users/<id>/avatar?v=…"
   * (group members). Initials are shown when empty or missing.
   */
  avatar?: string;
}

export interface User extends Member {
  email: string;
  fullName: string;
  /** A preset id from lib/backgrounds.ts, or '' for none. */
  profileBackground?: string;
  /** Short profile bio (≤ 100 characters), '' for none. */
  bio?: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface AuthConfig {
  /** null when Google sign-in is switched off on the server. */
  googleClientId: string | null;
}

export interface TeamMember extends Member {
  email: string;
  /** null until the invite is accepted. */
  userId: string | null;
  status: 'invited' | 'accepted';
  joinedAt: string | null;
  /** Invitees who already have an account: that account's username (until then `name` is a placeholder). */
  accountName?: string;
}

export interface Team {
  id: string;
  name: string;
  course: string;
  /** User id of the creator. */
  owner: string;
  /** "pending" until everyone has accepted; then reviews are open and membership is locked. */
  status: 'pending' | 'reviewing';
  reviewsStartedAt: string | null;
  members: TeamMember[];
  /** Only sent to members who have accepted. */
  inviteCode?: string;
  /** Only on the group list: what the signed-in user should do next. */
  todo?: 'accept' | 'review' | null;
}

export type Scores = Partial<Record<CategoryKey, number>>;

/** A review the current user is still editing. */
export interface ReviewDraft {
  rating: number;
  scores: Scores;
  text: string;
  anonymous: boolean;
}

/** A submitted review, shaped like the backend `Review` document. */
export interface Review extends ReviewDraft {
  id: string;
  teamId: string;
  /** Omitted by the API on anonymous reviews written by someone else. */
  reviewerId?: string;
  targetId: string;
  submittedAt: string;
}

/** A review someone wrote about you, as GET /profile returns it. */
export interface ReceivedReview {
  id: string;
  teamId: string;
  rating: number;
  scores: Scores;
  text: string;
  anonymous: boolean;
  /** null when the review is anonymous. */
  reviewerName: string | null;
  submittedAt: string;
}

export interface ProfileData {
  /** Groups that count toward your profile (ones where you've submitted your own reviews). */
  groups: { id: string; name: string; course: string }[];
  /** Newest first. */
  reviews: ReceivedReview[];
  pinnedComments: string[];
  pinnedAwards: string[];
}

/** Someone else's account, as search results and other people's profiles show it. */
export interface PublicUser extends Member {
  email: string;
  fullName: string;
  profileBackground: string;
  bio: string;
}

/** GET /users/:id/profile: who they are, plus the same data as your own profile. */
export interface UserProfileData extends ProfileData {
  user: PublicUser;
}

export interface CategoryScore extends Category {
  value: number | null;
  count: number;
}

export interface Badge {
  name: string;
  icon: string;
  reason: string;
}

export interface Summary {
  average: number | null;
  count: number;
  scores: CategoryScore[];
  awards: Badge[];
  top: CategoryScore | null;
}

export interface FunnyAward {
  id: string;
  title: string;
  trait: string;
  icon: string;
  tone: Tone;
  desc: string;
  rule: string;
}

export interface Medal {
  name: string;
  tone: Tone;
  symbol: string;
}
