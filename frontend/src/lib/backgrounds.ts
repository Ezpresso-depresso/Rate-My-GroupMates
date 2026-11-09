/*
 * Preset profile backgrounds. The images live in public/backgrounds; the database only stores
 * the id. Keep ids in sync with PROFILE_BACKGROUNDS in backend/src/config/constants.ts.
 */

export interface ProfileBackground {
  id: string;
  label: string;
  src: string;
  /** Overrides BACKGROUND_OPACITY for this one image. */
  opacity?: number;
}

export const PROFILE_BACKGROUNDS: ProfileBackground[] = [
  { id: 'goku', label: 'Super Saiyan', src: '/backgrounds/goku.png', opacity: 1 },
  { id: 'misty-field', label: 'Misty field', src: '/backgrounds/misty-field.jpg' },
  { id: 'blossoms', label: 'Blossoms', src: '/backgrounds/blossoms.jpg' },
  { id: 'blossom-path', label: 'Blossom path', src: '/backgrounds/blossom-path.jpg' },
];

/** Backgrounds are kept faint so the profile stays readable (unless a preset sets its own). */
export const BACKGROUND_OPACITY = 0.3;

export const backgroundById = (id?: string) => PROFILE_BACKGROUNDS.find((b) => b.id === id);
