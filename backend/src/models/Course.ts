import { Schema, model, type InferSchemaType } from 'mongoose';

/*
 * A UCI course a group can be for, e.g. { department: 'COMPSCI', number: '161', code: 'COMPSCI 161' }.
 * Filled from data/uciCourses.json (see lib/courses.ts); groups store the `code`.
 */
const courseSchema = new Schema(
  {
    /** "COMPSCI 161": department + space + number. What groups store and show. */
    code: { type: String, required: true, unique: true },
    department: { type: String, required: true },
    departmentName: { type: String, required: true },
    number: { type: String, required: true },
    title: { type: String, required: true },
  },
  { versionKey: false },
);

courseSchema.index({ department: 1 });

export type CourseRow = InferSchemaType<typeof courseSchema>;
export const Course = model('Course', courseSchema);
