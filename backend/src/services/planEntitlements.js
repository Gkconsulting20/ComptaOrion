import { and, eq, sql } from 'drizzle-orm';
import { abonnements, plansAbonnement } from '../schema.js';

const PLAN_FEATURE_CACHE_TTL_MS = 5000;
let planFeatureCache = new WeakMap();

export function clearPlanCapabilitiesCache() {
  planFeatureCache = new WeakMap();
}

function normalizePlanName(name) {
  return String(name || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Premium et l’essai gratuit de 30 jours activent les fonctions Premium
 * (calcul automatique du coût, lecture OCR des factures fournisseurs,
 * comptabilité associative) pour que les prospects puissent les tester.
 * Les autres forfaits restent en saisie manuelle, sans OCR ni projets
 * associatifs.
 */
export async function getPlanCapabilities(executor, entrepriseId, { cache = true } = {}) {
  if (!Number.isSafeInteger(Number(entrepriseId)) || Number(entrepriseId) <= 0) {
    return { planName: null, automaticCosting: false, ocr: false, associationAccounting: false, isTrial: false };
  }

  const cacheKey = String(entrepriseId);
  let companyCache;
  if (cache) {
    companyCache = planFeatureCache.get(executor);
    if (!companyCache) {
      companyCache = new Map();
      planFeatureCache.set(executor, companyCache);
    }
    const cached = companyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
  }

  const [plan] = await executor.select({
    name: plansAbonnement.nom,
    price: plansAbonnement.prix,
  }).from(abonnements)
    .innerJoin(plansAbonnement, eq(abonnements.planId, plansAbonnement.id))
    .where(and(
      eq(abonnements.entrepriseId, Number(entrepriseId)),
      eq(abonnements.statut, 'actif'),
      eq(plansAbonnement.actif, true),
      sql`${abonnements.dateExpiration} >= CURRENT_DATE`,
    ))
    .limit(1);

  const normalizedName = normalizePlanName(plan?.name);
  const isTrial = Number(plan?.price) === 0 &&
    /essai|trial|demo|test/.test(normalizedName);
  const isPremium = normalizedName.includes('premium') || isTrial;
  const value = {
    planName: plan?.name || null,
    automaticCosting: isPremium,
    ocr: isPremium,
    associationAccounting: isPremium,
    isTrial,
  };

  if (cache) {
    companyCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + PLAN_FEATURE_CACHE_TTL_MS,
    });
  }
  return value;
}
