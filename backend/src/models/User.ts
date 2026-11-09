import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** First name: what groups and the rating screens show. */
    name: { type: String, required: true, trim: true },
    fullName: { type: String, default: '', trim: true },
    googleId: { type: String, unique: true, sparse: true },
    color: { type: String, default: '#5762c6' },
    /** Profile picture as a data URL (image/jpeg|png|webp, ≤ MAX_AVATAR_CHARS); '' = show initials. */
    avatar: { type: String, default: '' },
    /** Short profile bio (≤ MAX_BIO_LENGTH characters); '' for none. */
    bio: { type: String, default: '', trim: true },
    /** One of PROFILE_BACKGROUNDS, or '' for none. Just a name: the images ship with the frontend. */
    profileBackground: { type: String, default: '' },
    /** Profile pins (≤ MAX_PINS each): Review ids, and award keys like "<teamId>:funny:carry". */
    pinnedComments: { type: [String], default: [] },
    pinnedAwards: { type: [String], default: [] },
    /** bcrypt hash; never sent to clients. Empty for Google-only accounts. */
    passwordHash: { type: String, select: false },
    /** Bumped on password change; session tokens carry it, so older sessions stop working. */
    sessionVersion: { type: Number, default: 0 },
    // Wrong-password lockout (see LOCKOUT_* in constants)
    failedLogins: { type: Number, default: 0 },
    failedLoginsSince: { type: Date, default: null },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    // Pins only travel with GET /profile.
    for (const key of ['googleId', 'passwordHash', 'sessionVersion', 'failedLogins', 'failedLoginsSince', 'lockedUntil', 'pinnedComments', 'pinnedAwards'])
      delete ret[key];
    return ret;
  },
});

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
