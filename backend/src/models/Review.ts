import { Schema, model, type InferSchemaType } from 'mongoose';
import { CATEGORY_KEYS, MAX_COMMENT_LENGTH, SCORE_MAX, SCORE_MIN, STAR_MAX, STAR_MIN } from '../config/constants';

const scoreField = { type: Number, required: true, min: SCORE_MIN, max: SCORE_MAX };

const scoresSchema = new Schema(
  Object.fromEntries(CATEGORY_KEYS.map((key) => [key, scoreField])),
  { _id: false },
);

const reviewSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    reviewerId: { type: Schema.Types.ObjectId, required: true }, // Team.members[]._id
    targetId: { type: Schema.Types.ObjectId, required: true }, // Team.members[]._id
    rating: { type: Number, required: true, min: STAR_MIN, max: STAR_MAX },
    scores: { type: scoresSchema, required: true },
    text: { type: String, default: '', trim: true, maxlength: MAX_COMMENT_LENGTH },
    anonymous: { type: Boolean, default: false },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// One review per reviewer → target within a team; resubmitting overwrites it.
reviewSchema.index({ team: 1, reviewerId: 1, targetId: 1 }, { unique: true });

reviewSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    ret.teamId = String(ret.team);
    delete ret._id;
    delete ret.team;
    return ret;
  },
});

export type ReviewDoc = InferSchemaType<typeof reviewSchema>;
export const Review = model('Review', reviewSchema);
