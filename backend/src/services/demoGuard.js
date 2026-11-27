import { db } from '../db.js';
import { entreprises } from '../schema.js';
import { eq } from 'drizzle-orm';

export const DEMO_BLOCKED_MESSAGE = 'Cette action est indisponible en démonstration.';
export const DEMO_SUBSCRIPTION_NOTE = 'Démonstration — sans expiration d’essai';

/** Une entreprise démo est-elle concernée ? Lecture directe, sans RLS. */
export async function isDemoEntreprise(entrepriseId, executor = db) {
  const id = Number(entrepriseId);
  if (!Number.isSafeInteger(id) || id <= 0) return false;
  const [row] = await executor.select({ isDemo: entreprises.isDemo })
    .from(entreprises)
    .where(eq(entreprises.id, id))
    .limit(1);
  return row?.isDemo === true;
}

/** Lève une erreur 403 si l'entreprise est une démo. */
export async function assertNotDemoEntreprise(entrepriseId, executor = db) {
  if (await isDemoEntreprise(entrepriseId, executor)) {
    throw Object.assign(new Error(DEMO_BLOCKED_MESSAGE), { status: 403 });
  }
}

/** Adresses factices : aucun e-mail ne doit jamais leur être envoyé (R8). */
export function isDemoEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value.endsWith('@demo.comptaorion.com') || value.endsWith('.demo.invalid');
}
