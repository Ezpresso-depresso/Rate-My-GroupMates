/* Mirrors backend/src/lib/password.ts so the form catches problems before submitting. */
export const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;

export function passwordProblem(password: string, email: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES)
    return `Password must be at most ${PASSWORD_MAX_BYTES} characters`;
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return 'Your password can’t be your email';
  return null;
}
