import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const photoDirectory = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'), 'incubatee-photos');
const supportedTypes = new Map([
  ['image/jpeg', { extension: 'jpg', signature: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff }],
  ['image/png', { extension: 'png', signature: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ['image/webp', { extension: 'webp', signature: (buffer: Buffer) => buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP' }],
]);

export const validatePhoto = (type: string, bytes: Buffer) => {
  const image = supportedTypes.get(type);
  return !!image && image.signature(bytes) ? image.extension : null;
};

const resolvePhotoPath = (key: string) => {
  if (!/^photos\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(key)) throw new Error('Invalid photo path.');
  const target = path.resolve(photoDirectory, path.basename(key));
  if (!target.startsWith(`${photoDirectory}${path.sep}`)) throw new Error('Invalid photo path.');
  return target;
};

export const savePhoto = async (bytes: Buffer, extension: string) => {
  await mkdir(photoDirectory, { recursive: true });
  const key = `photos/${randomUUID()}.${extension}`;
  await writeFile(resolvePhotoPath(key), bytes, { flag: 'wx' });
  return key;
};

export const readPhoto = async (key: string) => readFile(resolvePhotoPath(key));

export const removePhoto = async (key: string) => {
  await rm(resolvePhotoPath(key), { force: true });
};

export const getPhotoContentType = (key: string) => {
  const extension = path.extname(key).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
};
