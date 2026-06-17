/**
 * Short-lived HMAC tokens for photo proxy URLs.
 *
 * Why: Supabase signed URLs are publicly accessible to anyone who has the URL.
 * Instead of embedding them in the browser we return proxy URLs of the form:
 *   /api/admin/incubatees/photo?path=photos/xxx.jpg&token=<hmac>&exp=<ts>
 *
 * The proxy verifies the HMAC and expiry server-side, then streams the image.
 * The Supabase signed URL is never sent to the browser.
 *
 * SERVER-SIDE ONLY.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_SECONDS = 3600; // 1 hour — matches the admin session lifetime

const getSecret = (): string => {
  const secret = (process.env.PHOTO_TOKEN_SECRET || '').trim();
  if (!secret) throw new Error('PHOTO_TOKEN_SECRET env variable is not set.');
  return secret;
};

const sign = (message: string): string =>
  createHmac('sha256', getSecret()).update(message).digest('hex');

/**
 * Create a signed proxy URL for a storage path.
 * Returns a relative URL safe to embed in <img src>.
 */
export const signPhotoUrl = (
  storagePath: string,
  baseRoute: '/api/admin/incubatees/photo' | '/api/company/incubatees/photo'
): string => {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const message = `${storagePath}:${exp}`;
  const token = sign(message);
  return `${baseRoute}?path=${encodeURIComponent(storagePath)}&exp=${exp}&token=${token}`;
};

/**
 * Verify a token from query params. Returns true if valid and not expired.
 */
export const verifyPhotoToken = (
  storagePath: string,
  exp: string | null,
  token: string | null
): boolean => {
  if (!exp || !token) return false;

  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum <= Math.floor(Date.now() / 1000)) return false;

  const expected = sign(`${storagePath}:${exp}`);
  try {
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
};
