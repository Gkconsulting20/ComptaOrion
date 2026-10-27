import { db } from '../db.js';
import { auditLogs } from '../schema.js';

/**
 * Enregistre une action dans le journal d'audit
 * @param {Object} params - Paramètres de l'audit
 * @param {number} params.entrepriseId - ID de l'entreprise
 * @param {number} params.userId - ID de l'utilisateur
 * @param {string} params.action - Action effectuée (CREATE, UPDATE, DELETE, etc.)
 * @param {string} params.table - Nom de la table modifiée
 * @param {number} params.recordId - ID de l'enregistrement modifié
 * @param {Object} params.ancienneValeur - Ancienne valeur (pour UPDATE/DELETE)
 * @param {Object} params.nouvelleValeur - Nouvelle valeur (pour CREATE/UPDATE)
 * @param {string} params.description - Description de l'action
 * @param {string} params.ipAddress - Adresse IP de l'utilisateur
 * @param {string} params.userAgent - User agent du navigateur
 */
export async function logAudit({
  entrepriseId,
  userId = null,
  action,
  table,
  recordId,
  ancienneValeur = null,
  nouvelleValeur = null,
  oldValues = null,
  newValues = null,
  description,
  ipAddress = null,
  userAgent = null,
  executor = db,
  required = false
}) {
  try {
    const tenantId = Number(entrepriseId);
    if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
      throw new Error('Entreprise manquante pour écrire la piste d’audit.');
    }

    const actorId = userId ? Number(userId) : null;
    const previousValue = ancienneValeur ?? oldValues;
    const nextValue = nouvelleValeur ?? newValues;
    const [entry] = await executor.insert(auditLogs).values({
      entrepriseId: tenantId,
      userId: Number.isSafeInteger(actorId) && actorId > 0 ? actorId : null,
      action,
      tableName: table,
      recordId: recordId ? Number(recordId) : null,
      ancienneValeur: previousValue == null ? null : JSON.stringify(previousValue),
      nouvelleValeur: nextValue == null ? null : JSON.stringify(nextValue),
      description,
      ipAddress,
      userAgent
    }).returning();
    return entry;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'audit:', error);
    if (required) throw error;
    return null;
  }
}

/**
 * Extrait les informations de la requête pour l'audit
 * @param {Object} req - Objet requête Express
 * @returns {Object} Informations pour l'audit
 */
export function extractAuditInfo(req) {
  return {
    entrepriseId: req.entrepriseId,
    userId: req.user?.id || req.userId || null,
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null
  };
}
