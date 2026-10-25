import { Schema, model, type InferSchemaType } from 'mongoose';

const memberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#5762c6' },
  },
  { _id: true },
);

const teamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    members: {
      type: [memberSchema],
      validate: { validator: (m: unknown[]) => m.length >= 2, message: 'A team needs at least two members.' },
    },
  },
  { timestamps: true },
);

// Expose `id` instead of `_id` so responses match the frontend `Team` type.
teamSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, any>) => {
    delete ret._id;
    ret.members = ret.members?.map(({ _id, ...m }: Record<string, any>) => ({ id: String(_id), ...m }));
    return ret;
  },
});

export type TeamDoc = InferSchemaType<typeof teamSchema>;
export const Team = model('Team', teamSchema);
