import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** First name: what groups and the rating screens show. */
    name: { type: String, required: true, trim: true },
    fullName: { type: String, default: '', trim: true },
    googleId: { type: String, unique: true, sparse: true },
    color: { type: String, default: '#5762c6' },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.googleId;
    return ret;
  },
});

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
