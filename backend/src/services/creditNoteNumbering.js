import { sql } from 'drizzle-orm';

export async function generateCreditNoteNumber(executor, { entrepriseId, type, dateAvoir, operation = 'avoir' }) {
  if (!executor?.execute) throw new Error('La numérotation des avoirs exige une transaction.');
  if (!['client', 'fournisseur'].includes(type)) throw new Error('Type d’avoir invalide.');
  if (!['avoir', 'debit'].includes(operation) || (operation === 'debit' && type !== 'client')) {
    throw new Error('Type d’ajustement de tiers invalide.');
  }
  const date = String(dateAvoir || '');
  const year = Number(date.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(year)) {
    throw new Error('La date de l’avoir est invalide.');
  }

  const lockKey = `comptaorion:notes-credit:${entrepriseId}:${type}:${year}`;
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);
  const result = await executor.execute(sql`
    SELECT COALESCE(MAX(sequence), 0)::integer AS last_sequence
    FROM notes_credit
    WHERE entreprise_id = ${entrepriseId} AND type = ${type} AND annee = ${year}
  `);
  const sequence = Number(result.rows?.[0]?.last_sequence || 0) + 1;
  const prefix = operation === 'debit' ? 'NDC' : type === 'client' ? 'AVC' : 'AVF';
  const digits = type === 'client' ? 8 : 6;
  return {
    annee: year,
    sequence,
    numero: `${prefix}-${year}-${String(sequence).padStart(digits, '0')}`,
  };
}
