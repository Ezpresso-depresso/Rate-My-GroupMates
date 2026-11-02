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
}

export interface User extends Member {
  email: string;
  fullName: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface AuthConfig {
  googleClientId: string | null;
  devLogin: boolean;
}

export interface TeamMember extends Member {
  email: string;
  /** null until the invite is accepted. */
  userId: string | null;
  status: 'invited' | 'accepted';
  joinedAt: string | null;
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
