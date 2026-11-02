import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { MIN_GROUP_SIZE } from '../config/constants';

/*
 * A member is an invited email until that person signs in with it, enters the
 * group's code and accepts; then `user` points at their account.
 * Reviews reference a member by its `_id`, so it never changes once created.
 */
const memberSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#5762c6' },
    status: { type: String, enum: ['invited', 'accepted'], default: 'invited', required: true },
    joinedAt: { type: Date, default: null },
  },
  { _id: true },
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviteCode: { type: String, required: true },
    members: {
      type: [memberSchema],
      validate: {
        validator: (m: unknown[]) => m.length >= MIN_GROUP_SIZE,
        message: `A group needs at least ${MIN_GROUP_SIZE} people.`,
      },
    },
    /** Set once every member has accepted. From then on membership is locked and reviews are open. */
    reviewsStartedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

teamSchema.index({ 'members.email': 1 });
teamSchema.index({ 'members.user': 1 });

// `inviteCode` is stripped here; controllers add it back for accepted members only.
teamSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    ret.owner = String(ret.owner);
    ret.status = ret.reviewsStartedAt ? 'reviewing' : 'pending';
    ret.members = ret.members?.map(({ _id, user, ...m }: Record<string, any>) => ({
      id: String(_id),
      userId: user ? String(user) : null,
      ...m,
    }));
    delete ret._id;
    delete ret.inviteCode;
    return ret;
  },
});

export type TeamDoc = HydratedDocument<InferSchemaType<typeof teamSchema>>;
export type MemberDoc = TeamDoc['members'][number];
export const Team = model('Team', teamSchema);
