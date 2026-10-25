export type CategoryKey = 'participation' | 'communication' | 'quality';

export type Tone = 'gold' | 'silver' | 'bronze' | 'mint' | 'lilac' | 'peach' | 'pink';

export interface Category {
  key: CategoryKey;
  name: string;
  hint: string;
}

export interface Member {
  id: string;
  name: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  course: string;
  members: Member[];
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
  teamId: string;
  reviewerId: string;
  targetId: string;
  submittedAt?: string;
  sample?: boolean;
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
