/*
 * Turns a picked/dropped image file into a small square JPEG data URL for a profile picture.
 * Center-crops to a square, scales to AVATAR_SIZE, and lowers quality until it fits.
 */

export const AVATAR_SIZE = 256;
/** Keep in sync with MAX_AVATAR_CHARS in backend/src/config/constants.ts. */
export const MAX_AVATAR_CHARS = 90_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Couldn’t read that image. Try a JPEG or PNG'));
    };
    img.src = url;
  });
}

export async function toAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t an image. Choose a JPEG, PNG, WebP or GIF');
  if (file.size > MAX_FILE_BYTES) throw new Error('That image is over 15 MB. Choose a smaller one');

  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new Error('Couldn’t read that image. Try a JPEG or PNG');

  for (const size of [AVATAR_SIZE, 192, 128]) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser couldn’t process the image');
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_AVATAR_CHARS) return dataUrl;
    }
  }
  throw new Error('Couldn’t shrink that image enough. Try a different one');
}
