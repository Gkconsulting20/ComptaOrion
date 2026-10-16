import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeContext } from '../runtime-context.js';

const localRoot = process.env.RUNTIME_CLOUDFLARE === 'true' ? null :
  fileURLToPath(new URL('../../uploads/', import.meta.url));

export function validateLogoKey(key) {
  return /^logos\/entreprise-\d+-logo-[a-f0-9-]+\.(png|jpg|jpeg|gif)$/.test(key);
}

export async function putFile(key, buffer, contentType) {
  if (!validateLogoKey(key)) throw new Error('Nom de fichier invalide');
  const bucket = runtimeContext.getStore()?.uploads;
  if (bucket) {
    await bucket.put(key, buffer, { httpMetadata: { contentType } });
  } else {
    if (!localRoot) throw new Error('Le binding R2 UPLOADS est requis');
    const file = path.join(localRoot, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer);
  }
}

export async function deleteFile(url) {
  const key = url?.startsWith('/uploads/') ? url.slice('/uploads/'.length) : '';
  if (!validateLogoKey(key)) return; // Never delete an arbitrary path from the database.
  const bucket = runtimeContext.getStore()?.uploads;
  if (bucket) await bucket.delete(key);
  else if (localRoot) await fs.rm(path.join(localRoot, key), { force: true });
}
