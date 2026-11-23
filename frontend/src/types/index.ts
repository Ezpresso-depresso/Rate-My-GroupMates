export type CategoryKey = 'participation' | 'communication' | 'quality';

export type Tone =
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'mint'
  | 'lilac'
  | 'peach'
  | 'pink'
  // Achievement tiers only (see TIERS in lib/ratingCore.ts)
  | 'unranked'
  | 'burger'
  | 'platinum'
  | 'grandmaster'
  | 'pope';

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
  /** Overall star rating across all their groups (group members only); drives the rank tag and the Pope glow. */
  rating?: { average: number | null; count: number };
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
  /** Optional note from the creator for the people they invite ('' if none). */
  message?: string;
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
  /** Id of the signature award picked for this teammate (see funnyAwards); null until picked. */
  award: string | null;
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
  /** The signature award the reviewer picked (null on older reviews). */
  award: string | null;
  /** null when the review is anonymous. */
  reviewerName: string | null;
  submittedAt: string;
}

/** A class on someone's profile: from their groups, added by them, or both. */
export interface ProfileClass {
  code: string;
  title: string;
  /** Names of their groups for this class (empty if they only added it). */
  groups: string[];
  added: boolean;
}

export interface ProfileData {
  /** The classes they're in / have taken (see ProfileClass). */
  classes: ProfileClass[];
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

/** A UCI course a group can be for. Groups store its `code`, e.g. "COMPSCI 161". */
export interface Course {
  code: string;
  department: string;
  departmentName: string;
  number: string;
  title: string;
}

export interface Department {
  code: string;
  name: string;
  courseCount: number;
  /** ICS departments, listed first. */
  featured: boolean;
}

/** What a profile search matches: `all` = name or email. */
export type SearchField = 'all' | 'name' | 'email' | 'class';

/** A Find Groupmates result: the person plus their overall star rating (same rule as their profile). */
export interface SearchResult extends PublicUser {
  rating: { average: number | null; count: number };
}

/** GET /users/:id/profile: who they are, plus the same data as your own profile. */
export interface UserProfileData extends ProfileData {
  user: PublicUser;
}

export interface CategoryScore extends Category {
  value: number | null;
  count: number;
}

export interface Summary {
  average: number | null;
  count: number;
  scores: CategoryScore[];
  top: CategoryScore | null;
  /** The signature award picked most often by teammates (null until anyone picks one). */
  award: FunnyAward | null;
}

/** A signature award: picked for each teammate by the people reviewing them. */
export interface FunnyAward {
  id: string;
  title: string;
  /** A single plain character, coloured by `tone` (like the rank symbols). */
  icon: string;
  tone: Tone;
  desc: string;
}

export interface Medal {
  name: string;
  tone: Tone;
  symbol: string;
}
