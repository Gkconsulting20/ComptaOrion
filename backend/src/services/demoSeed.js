// Seed de l'entreprise de démonstration publique — ComptaOrion.
// Étude : ~/workspace/demo-mode-design-2026-11-27.md (§4.2, §4.5).
//
// Règles :
// - dates relatives à `now` (30 derniers jours glissants), jamais de dates fixes ;
// - montants FCFA réalistes, noms fictifs togolais, adresses marquées « (démo) » ;
// - tous les numéros via documentNumbering.js / les helpers du projet ;
// - identifiants globalement uniques préfixés DEMO-<entrepriseId>-… ;
// - chaque document passe par les services métier (écritures automatiques),
//   jamais d'insert direct dans `factures`/`ecritures` sans l'écriture ;
// - ne pas clôturer l'exercice ; TVA 18 % ; plan SYSCOHADA complet.
//
// L'exercice est équilibré par construction : chaque écriture est créée par
// createEcritureComptable, qui refuse une écriture déséquilibrée.
import { db } from '../db.js';
import { and, desc, eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { withTenantTransaction } from '../utils/rlsPolicies.js';
import {
  entreprises, users, saasClients, abonnements, plansAbonnement,
  clients, fournisseurs, produits, entrepots, stockParEntrepot, mouvementsStock,
  comptesComptables, comptesAutomatiques, comptesBancaires, transactionsTresorerie,
  rapprochementsBancaires, devis, devisItems, factures, factureItems, paiements,
  notesCredit, notesCreditItems, bonsLivraison, bonLivraisonItems,
  commandesAchat, commandesAchatItems, bonsReception, lignesReception,
  facturesAchat, factureAchatItems, paiementsFournisseurs,
  categoriesDepenses, depenses, approvalsDepenses, remboursementsEmployes,
  employes, declarationsFiscales, parametresFiscaux,
  inventairesTournants, lignInventairesTournants,
} from '../schema.js';
import { initializeSyscohadaForEnterprise } from './syscohadaService.js';
import { ACCOUNTING_ACCOUNT_ROLES } from './accountingAccountMappings.js';
import {
  nextDevisNumber, nextCommandeAchatNumber, nextBonLivraisonNumber,
} from './documentNumbering.js';
import { getNextPurchaseInvoiceNumber } from './purchaseInvoiceNumber.js';
import {
  createEcritureComptable, createEcritureFactureVente, createEcriturePaiementClient,
  createEcritureFactureAchat, createEcriturePaiementFournisseur, createEcritureCoutVente,
  createEcritureOuvertureStock, createEcritureReception, createEcritureAvoirClient,
  createEcritureChargeNoteFrais, createEcritureDepense, createEcriturePaiementImpot,
} from './comptabiliteService.js';
import {
  ensureOpeningValuationLayer, createStockValuationLayer, consumeStockValuation,
  updateProductAverageCost,
} from './stockValuation.js';
import { generateCreditNoteNumber } from './creditNoteNumbering.js';
import { DEMO_SUBSCRIPTION_NOTE } from './demoGuard.js';
import { deleteEnterpriseData } from './trialLifecycle.js';

export const DEMO_COMPANY_NAME = 'Entreprise de démonstration';
export const DEMO_TVA_RATE = 18;

// ---------------------------------------------------------------------------
// Utilitaires de dates / montants
// ---------------------------------------------------------------------------

function isoDaysAgo(daysAgo) {
  const date = new Date(Date.now() - Number(daysAgo) * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousMonthRange() {
  const now = new Date();
  const firstThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const firstPrevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    debut: firstPrevMonth.toISOString().slice(0, 10),
    fin: new Date(firstThisMonth.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    periode: `${firstPrevMonth.getUTCFullYear()}-${String(firstPrevMonth.getUTCMonth() + 1).padStart(2, '0')}`,
  };
}

const fmt2 = (value) => Number(value).toFixed(2);
const tvaOf = (ht) => Math.round(Number(ht) * DEMO_TVA_RATE) / 100;

// ---------------------------------------------------------------------------
// Numérotation (mêmes règles que les routes)
// ---------------------------------------------------------------------------

async function nextFactureNumber(tx, entrepriseId) {
  const annee = new Date().getFullYear();
  const [last] = await tx.select({ numeroFacture: factures.numeroFacture })
    .from(factures)
    .where(and(
      eq(factures.entrepriseId, entrepriseId),
      sql`EXTRACT(YEAR FROM ${factures.dateFacture}::date) = ${annee}`,
    ))
    .orderBy(desc(factures.id))
    .limit(1);
  let numero = 1;
  if (last?.numeroFacture) {
    const match = last.numeroFacture.match(/FACT-(\d{4})-(?:\d+-)?(\d+)$/);
    if (match) numero = parseInt(match[2], 10) + 1;
  }
  return `FACT-${annee}-${entrepriseId}-${String(numero).padStart(4, '0')}`;
}

async function nextDevis(tx, entrepriseId) {
  const annee = new Date().getFullYear();
  const [last] = await tx.select({ numeroDevis: devis.numeroDevis })
    .from(devis)
    .where(eq(devis.entrepriseId, entrepriseId))
    .orderBy(desc(devis.id))
    .limit(1);
  return nextDevisNumber(entrepriseId, last?.numeroDevis, annee);
}

async function nextCommandeAchat(tx, entrepriseId) {
  const annee = new Date().getFullYear();
  const [last] = await tx.select({ numeroCommande: commandesAchat.numeroCommande })
    .from(commandesAchat)
    .where(eq(commandesAchat.entrepriseId, entrepriseId))
    .orderBy(desc(commandesAchat.id))
    .limit(1);
  return nextCommandeAchatNumber(entrepriseId, last?.numeroCommande, annee);
}

async function nextFactureAchat(tx, entrepriseId) {
  const annee = new Date().getFullYear();
  const rows = await tx.select({ numeroFacture: facturesAchat.numeroFacture })
    .from(facturesAchat)
    .where(eq(facturesAchat.entrepriseId, entrepriseId));
  return getNextPurchaseInvoiceNumber(annee, entrepriseId, rows.map((r) => r.numeroFacture));
}

async function nextBonLivraison(tx, entrepriseId) {
  const [last] = await tx.select({ numeroBL: bonsLivraison.numeroBL })
    .from(bonsLivraison)
    .where(eq(bonsLivraison.entrepriseId, entrepriseId))
    .orderBy(desc(bonsLivraison.id))
    .limit(1);
  return nextBonLivraisonNumber(entrepriseId, last?.numeroBL);
}

// ---------------------------------------------------------------------------
// Comptes / trésorerie
// ---------------------------------------------------------------------------

async function getCompteId(tx, entrepriseId, numero) {
  const [compte] = await tx.select({ id: comptesComptables.id })
    .from(comptesComptables)
    .where(and(
      eq(comptesComptables.entrepriseId, entrepriseId),
      eq(comptesComptables.numero, numero),
    ))
    .limit(1);
  if (!compte) throw new Error(`Compte SYSCOHADA ${numero} introuvable pour l'entreprise ${entrepriseId}.`);
  return compte.id;
}

async function configureComptesAutomatiques(tx, entrepriseId) {
  // Les 23 rôles de accountingAccountMappings.js ne sont pas tous couverts
  // par le plan SYSCOHADA : 673 (escomptes accordés) et 773 (escomptes
  // obtenus) n'existent pas dans le plan — ils ne servent que pour les plans
  // personnalisés. On configure les rôles couverts et on ignore les autres
  // (le plan SYSCOHADA, lui, ne doit jamais être modifié).
  const configured = [];
  for (const role of ACCOUNTING_ACCOUNT_ROLES) {
    const [compte] = await tx.select({ id: comptesComptables.id })
      .from(comptesComptables)
      .where(and(
        eq(comptesComptables.entrepriseId, entrepriseId),
        eq(comptesComptables.numero, role.defaultNumber),
      ))
      .limit(1);
    if (!compte) {
      console.warn(`Compte automatique ${role.key} (${role.defaultNumber}) absent du plan SYSCOHADA — rôle ignoré pour la démo ${entrepriseId}.`);
      continue;
    }
    await tx.insert(comptesAutomatiques).values({
      entrepriseId, roleKey: role.key, compteComptableId: compte.id,
    }).onConflictDoNothing();
    configured.push(role.key);
  }
  return configured;
}

async function addTresorerie(tx, entrepriseId, {
  compteBancaireId, type, montant, dateTransaction, categorie, description,
  tiersNom = null, numeroPiece = null, modePaiement = null, userId = null,
  rapprochementId = null,
}) {
  const [row] = await tx.insert(transactionsTresorerie).values({
    entrepriseId, compteBancaireId, type, montant: fmt2(montant),
    dateTransaction, categorie, description, tiersNom, numeroPiece, modePaiement,
    rapproche: Boolean(rapprochementId), rapprochementId, userId,
  }).returning();
  const delta = type === 'encaissement' ? Number(montant) : -Number(montant);
  await tx.update(comptesBancaires).set({
    soldeActuel: sql`${comptesBancaires.soldeActuel} + ${delta}`,
    updatedAt: new Date(),
  }).where(eq(comptesBancaires.id, compteBancaireId));
  return row;
}

// ---------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------

async function createInvoice(tx, entrepriseId, userId, {
  client, dateFacture, items, statut = 'brouillon', notes = null,
}) {
  const totalHT = items.reduce((sum, item) =>
    sum + Number(item.quantite) * Number(item.prixUnitaire) * (1 - Number(item.remise || 0) / 100), 0);
  const totalTVA = tvaOf(totalHT);
  const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;
  const numeroFacture = await nextFactureNumber(tx, entrepriseId);
  const [facture] = await tx.insert(factures).values({
    entrepriseId, numeroFacture, clientId: client.id, statut,
    dateFacture, dateEcheance: addDays(dateFacture, client.delaiPaiement ?? 30),
    totalHT: fmt2(totalHT), totalTVA: fmt2(totalTVA), totalTTC: fmt2(totalTTC),
    montantPaye: '0', soldeRestant: fmt2(totalTTC), notes, userId,
  }).returning();
  await tx.insert(factureItems).values(items.map((item) => ({
    entrepriseId, factureId: facture.id, produitId: item.produitId || null,
    description: item.description, quantite: String(item.quantite),
    prixUnitaire: fmt2(item.prixUnitaire), remise: fmt2(item.remise || 0),
    totalLigne: fmt2(Number(item.quantite) * Number(item.prixUnitaire) * (1 - Number(item.remise || 0) / 100)),
  })));
  // Comme la route POST /api/factures : l'écriture de vente est passée dès la
  // création, même en brouillon (une annulation la contre-passe ensuite).
  const ecriture = await createEcritureFactureVente({
    entrepriseId, clientId: client.id, numeroFacture, dateFacture,
    clientNom: client.nom, totalHT, totalTVA, totalTTC, executor: tx,
  });
  if (!ecriture) throw new Error('Écriture de facture de vente impossible (comptes collectifs manquants).');
  return { ...facture, totalHT, totalTVA, totalTTC };
}

/** Transition brouillon → envoyée : sortie de stock + CMUP (comme PUT /factures). */
async function fulfillInvoice(tx, entrepriseId, userId, facture) {
  const items = await tx.select().from(factureItems)
    .where(and(eq(factureItems.factureId, facture.id), eq(factureItems.entrepriseId, entrepriseId)));
  let totalCMV = 0;
  for (const item of items.filter((i) => i.produitId).sort((a, b) => a.produitId - b.produitId)) {
    const quantity = Number(item.quantite);
    const [product] = await tx.select().from(produits)
      .where(and(eq(produits.id, item.produitId), eq(produits.entrepriseId, entrepriseId)))
      .for('update').limit(1);
    if (!product) throw new Error(`Produit ${item.produitId} introuvable.`);
    if (Number(product.quantite || 0) + 0.001 < quantity) {
      throw new Error(`Stock insuffisant pour ${product.nom} (démo).`);
    }
    const costing = await consumeStockValuation(tx, {
      entrepriseId, produitId: item.produitId, quantity,
    });
    if (costing.untrackedQuantity > 0.001) {
      throw new Error(`CMV non établissable pour ${product.nom} (démo).`);
    }
    totalCMV += costing.coutConsomme;
    await tx.update(factureItems).set({
      coutUnitaireCMV: quantity > 0 ? (costing.coutConsomme / quantity).toFixed(4) : '0.0000',
    }).where(eq(factureItems.id, item.id));
    await tx.insert(mouvementsStock).values({
      entrepriseId, produitId: item.produitId, type: 'sortie', quantite: quantity,
      prixUnitaire: Number(item.prixUnitaire), reference: `Facture ${facture.numeroFacture}`,
      notes: `Vente client - Facture ${facture.numeroFacture}`, userId,
    });
    await tx.update(produits).set({
      quantite: sql`${produits.quantite} - ${quantity}`, updatedAt: new Date(),
    }).where(and(eq(produits.id, item.produitId), eq(produits.entrepriseId, entrepriseId)));
  }
  await createEcritureCoutVente({
    entrepriseId, numeroFacture: facture.numeroFacture, dateFacture: facture.dateFacture,
    montantCMV: totalCMV, executor: tx,
  });
  const [updated] = await tx.update(factures).set({ statut: 'envoyee', updatedAt: new Date() })
    .where(eq(factures.id, facture.id)).returning();
  return { ...updated, totalCMV };
}

async function payInvoice(tx, entrepriseId, userId, facture, client, {
  montant, modePaiement, reference, datePaiement, compteBancaireId = null,
}) {
  const [paiement] = await tx.insert(paiements).values({
    entrepriseId, factureId: facture.id, clientId: client.id, montant: fmt2(montant),
    modePaiement, reference, datePaiement, userId,
    compteBancaireId: compteBancaireId || null,
  }).returning();
  const nouveauMontantPaye = Number(facture.montantPaye || 0) + Number(montant);
  const nouveauSolde = Number(facture.totalTTC) - nouveauMontantPaye;
  const nouveauStatut = nouveauSolde <= 0.01 ? 'payee' : 'envoyee';
  await tx.update(factures).set({
    montantPaye: fmt2(nouveauMontantPaye), soldeRestant: fmt2(Math.max(0, nouveauSolde)),
    statut: nouveauStatut, updatedAt: new Date(),
  }).where(eq(factures.id, facture.id));
  if (compteBancaireId) {
    await addTresorerie(tx, entrepriseId, {
      compteBancaireId, type: 'encaissement', montant, dateTransaction: datePaiement,
      categorie: 'Vente', description: `Paiement facture ${facture.numeroFacture}`,
      numeroPiece: reference || `PAI-${paiement.id}`, modePaiement, userId,
    });
  }
  const ecriture = await createEcriturePaiementClient({
    entrepriseId, clientId: client.id, reference: reference || `PAI-${paiement.id}`,
    datePaiement, clientNom: client.nom, montant,
    modePaiement: modePaiement === 'especes' ? 'especes' : 'banque',
    compteBancaireId: compteBancaireId || null, executor: tx,
  });
  if (!ecriture) throw new Error('Écriture d’encaissement client impossible (démo).');
  return { ...facture, montantPaye: nouveauMontantPaye, soldeRestant: Math.max(0, nouveauSolde), statut: nouveauStatut };
}

// ---------------------------------------------------------------------------
// Achats
// ---------------------------------------------------------------------------

async function createPurchaseInvoice(tx, entrepriseId, userId, {
  fournisseur, numeroFactureFournisseur = null, commandeId = null, dateFacture,
  items, notes = null,
}) {
  const totalHT = items.reduce((sum, item) =>
    sum + Number(item.quantite) * Number(item.prixUnitaire) * (1 - Number(item.remise || 0) / 100), 0);
  const totalTVA = tvaOf(totalHT);
  const totalTTC = Math.round((totalHT + totalTVA) * 100) / 100;
  const numeroFacture = await nextFactureAchat(tx, entrepriseId);
  const [facture] = await tx.insert(facturesAchat).values({
    entrepriseId, numeroFacture, numeroFactureFournisseur, fournisseurId: fournisseur.id,
    commandeId, statut: 'brouillon', dateFacture,
    dateEcheance: addDays(dateFacture, fournisseur.delaiPaiement ?? 30),
    totalHT: fmt2(totalHT), totalTVA: fmt2(totalTVA), totalTTC: fmt2(totalTTC),
    montantPaye: '0', soldeRestant: fmt2(totalTTC), notes, userId,
  }).returning();
  await tx.insert(factureAchatItems).values(items.map((item) => ({
    entrepriseId, factureId: facture.id, produitId: item.produitId || null,
    description: item.description, quantite: String(item.quantite),
    quantiteSaisie: String(item.quantite), uniteSaisie: item.uniteMesure || 'pièce',
    prixUnitaire: fmt2(item.prixUnitaire), prixUnitaireSaisi: fmt2(item.prixUnitaire),
    remise: fmt2(item.remise || 0),
    totalLigne: fmt2(Number(item.quantite) * Number(item.prixUnitaire) * (1 - Number(item.remise || 0) / 100)),
  })));
  return { ...facture, totalHT, totalTVA, totalTTC };
}

/**
 * Validation d'une facture fournisseur (réplique de PUT /achats/factures/:id/valider
 * pour le cas sans réception rapprochée, et du cas « réception déjà enregistrée »
 * avec montantPending pour solder le 408). L'écriture est passée, le stock est
 * entré une seule fois, le solde fournisseur est mis à jour.
 */
async function validatePurchaseInvoice(tx, entrepriseId, userId, facture, fournisseur, {
  montantStockDirect = 0, montantPending = 0, withStockEntry = false,
} = {}) {
  const items = await tx.select().from(factureAchatItems)
    .where(and(eq(factureAchatItems.factureId, facture.id), eq(factureAchatItems.entrepriseId, entrepriseId)));
  if (withStockEntry) {
    for (const item of items.filter((i) => i.produitId)) {
      const [product] = await tx.select().from(produits)
        .where(and(eq(produits.id, item.produitId), eq(produits.entrepriseId, entrepriseId)))
        .for('update').limit(1);
      await ensureOpeningValuationLayer(tx, {
        entrepriseId, produitId: product.id, productSnapshot: product,
      });
      const [movement] = await tx.insert(mouvementsStock).values({
        entrepriseId, produitId: product.id, type: 'entree', quantite: item.quantite,
        prixUnitaire: item.prixUnitaire, reference: `Facture ${facture.numeroFacture}`,
        notes: `Réception depuis facture fournisseur ${facture.numeroFactureFournisseur || facture.numeroFacture}`,
        userId,
      }).returning();
      const itemCost = Math.max(0, Number(item.totalLigne) || 0);
      await createStockValuationLayer(tx, {
        entrepriseId, produitId: product.id, mouvementId: movement.id,
        quantity: item.quantite, totalCost: itemCost,
        unitCost: Number(item.quantite) > 0 ? itemCost / Number(item.quantite) : Number(item.prixUnitaire),
        productSnapshot: product, ensureOpening: false,
      });
      await tx.update(factureAchatItems).set({
        coutUnitaireFinal: Number(item.quantite) > 0 ? (itemCost / Number(item.quantite)).toFixed(4) : '0.0000',
        mouvementStockId: movement.id,
      }).where(eq(factureAchatItems.id, item.id));
      await tx.update(produits).set({
        quantite: sql`${produits.quantite} + ${item.quantite}`, updatedAt: new Date(),
      }).where(and(eq(produits.id, product.id), eq(produits.entrepriseId, entrepriseId)));
    }
  }
  const ecriture = await createEcritureFactureAchat({
    entrepriseId, numeroFacture: facture.numeroFacture, dateFacture: facture.dateFacture,
    fournisseurNom: fournisseur.raisonSociale, totalHT: facture.totalHT,
    totalTVA: facture.totalTVA, totalTTC: facture.totalTTC,
    montantStockDirect, montantPending, executor: tx,
  });
  if (!ecriture) throw new Error('Écriture de facture fournisseur impossible (démo).');
  const [updated] = await tx.update(facturesAchat).set({
    statut: 'validee', ecritureComptableId: ecriture.id, updatedAt: new Date(),
  }).where(eq(facturesAchat.id, facture.id)).returning();
  await tx.update(fournisseurs).set({
    soldeDu: sql`${fournisseurs.soldeDu} + ${Number(facture.totalTTC)}`, updatedAt: new Date(),
  }).where(eq(fournisseurs.id, fournisseur.id));
  return updated;
}

async function paySupplier(tx, entrepriseId, userId, facture, fournisseur, {
  montant, modePaiement, reference, datePaiement, compteBancaireId = null,
}) {
  const [paiement] = await tx.insert(paiementsFournisseurs).values({
    entrepriseId, factureId: facture.id, fournisseurId: fournisseur.id,
    montant: fmt2(montant), modePaiement, reference, datePaiement, userId,
  }).returning();
  const nouveauMontantPaye = Number(facture.montantPaye || 0) + Number(montant);
  const nouveauSolde = Number(facture.totalTTC) - nouveauMontantPaye;
  const nouveauStatut = nouveauSolde <= 0.01 ? 'payee' : 'partiellement_payee';
  await tx.update(facturesAchat).set({
    montantPaye: fmt2(nouveauMontantPaye), soldeRestant: fmt2(Math.max(0, nouveauSolde)),
    statut: nouveauStatut, updatedAt: new Date(),
  }).where(eq(facturesAchat.id, facture.id));
  await tx.update(fournisseurs).set({
    soldeDu: sql`${fournisseurs.soldeDu} - ${Number(montant)}`, updatedAt: new Date(),
  }).where(eq(fournisseurs.id, fournisseur.id));
  if (compteBancaireId) {
    await addTresorerie(tx, entrepriseId, {
      compteBancaireId, type: 'decaissement', montant, dateTransaction: datePaiement,
      categorie: 'Achat', description: `Paiement facture ${facture.numeroFacture}`,
      tiersNom: fournisseur.raisonSociale, numeroPiece: reference || `PAI-FOU-${paiement.id}`,
      modePaiement, userId,
    });
  }
  const ecriture = await createEcriturePaiementFournisseur({
    entrepriseId, reference: reference || `PAI-FOU-${paiement.id}`, datePaiement,
    fournisseurNom: fournisseur.raisonSociale, montant,
    modePaiement: modePaiement === 'especes' ? 'especes' : 'virement',
    compteBancaireId: compteBancaireId || null, executor: tx,
  });
  if (!ecriture) throw new Error('Écriture de paiement fournisseur impossible (démo).');
  return { ...facture, montantPaye: nouveauMontantPaye, soldeRestant: Math.max(0, nouveauSolde), statut: nouveauStatut };
}

// ---------------------------------------------------------------------------
// Dépenses / notes de frais
// ---------------------------------------------------------------------------

async function createExpenseCategory(tx, entrepriseId, nom, numeroCompte) {
  const compteId = await getCompteId(tx, entrepriseId, numeroCompte);
  const [categorie] = await tx.insert(categoriesDepenses).values({
    entrepriseId, compteComptableId: compteId, nom,
    description: `Catégorie de démonstration — ${nom}`,
  }).returning();
  return categorie;
}

async function createExpense(tx, entrepriseId, userId, { categorie, montant, dateDepense, description }) {
  const [depense] = await tx.insert(depenses).values({
    entrepriseId, employeId: userId, categorieId: categorie.id, montant: fmt2(montant),
    dateDepense, description, statut: 'en_attente', montantApprouve: '0',
  }).returning();
  await tx.insert(approvalsDepenses).values({
    entrepriseId, depenseId: depense.id, etape: 'manager', statut: 'en_attente',
  });
  return depense;
}

/** Approbation manager puis comptable (réplique de POST /depenses/approve/…). */
async function approveExpense(tx, entrepriseId, userId, depense, categorie) {
  for (const etape of ['manager', 'comptable']) {
    const [pending] = await tx.select().from(approvalsDepenses)
      .where(and(
        eq(approvalsDepenses.depenseId, depense.id),
        eq(approvalsDepenses.entrepriseId, entrepriseId),
        eq(approvalsDepenses.etape, etape),
        eq(approvalsDepenses.statut, 'en_attente'),
      )).limit(1);
    if (!pending) throw new Error(`Étape d’approbation ${etape} introuvable (démo).`);
    await tx.update(approvalsDepenses).set({
      statut: 'approuvée', dateApprobation: new Date(), approbateurId: userId,
    }).where(eq(approvalsDepenses.id, pending.id));
    if (etape === 'manager') {
      await tx.insert(approvalsDepenses).values({
        entrepriseId, depenseId: depense.id, etape: 'comptable', statut: 'en_attente',
      });
    }
  }
  const montantApprouve = Number(depense.montant);
  const charge = await createEcritureChargeNoteFrais({
    entrepriseId, depenseId: depense.id, dateDepense: depense.dateDepense,
    description: depense.description, montant: montantApprouve,
    compteChargeId: categorie.compteComptableId, executor: tx,
  });
  const [updated] = await tx.update(depenses).set({
    statut: 'approuvée', montantApprouve: fmt2(montantApprouve), updatedAt: new Date(),
  }).where(eq(depenses.id, depense.id)).returning();
  return { ...updated, ecritureId: charge.ecriture.id };
}

async function reimburseExpense(tx, entrepriseId, userId, depense, {
  montant, dateRemboursement, methodePaiement, compteBancaireId = null,
}) {
  const [remboursement] = await tx.insert(remboursementsEmployes).values({
    entrepriseId, depenseId: depense.id, montantRembourse: fmt2(montant),
    dateRemboursement, methodePaiement, statut: 'complété',
  }).returning();
  await tx.update(depenses).set({
    montantRembourse: fmt2(montant), statut: 'remboursée', updatedAt: new Date(),
  }).where(eq(depenses.id, depense.id));
  const ecriture = await createEcritureDepense({
    entrepriseId, reference: `RMB-${remboursement.id}`, dateRemboursement,
    employeNom: 'Aya Kouassi', description: depense.description, montant: fmt2(montant),
    modePaiement: methodePaiement === 'especes' ? 'especes' : 'virement',
    compteBancaireId: compteBancaireId || null, executor: tx,
  });
  if (!ecriture) throw new Error('Écriture de remboursement impossible (démo).');
  if (compteBancaireId) {
    await addTresorerie(tx, entrepriseId, {
      compteBancaireId, type: 'decaissement', montant, dateTransaction: dateRemboursement,
      categorie: 'Dépense', description: `Remboursement ${depense.description}`,
      tiersNom: 'Aya Kouassi', numeroPiece: `RMB-${remboursement.id}`,
      modePaiement: methodePaiement, userId,
    });
  }
  return remboursement;
}

// ---------------------------------------------------------------------------
// TVA (mêmes filtres que calculerTva dans routes/impots.js)
// ---------------------------------------------------------------------------

async function calculerTvaSeed(tx, entrepriseId, dateDebut, dateFin) {
  const collectee = await tx.execute(sql`
    SELECT COALESCE(SUM(le.credit), 0) - COALESCE(SUM(le.debit), 0) AS montant
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId} AND e.valide = true
      AND cc.numero LIKE '443%' AND cc.numero NOT LIKE '4434%'
      AND e.date_ecriture >= ${dateDebut} AND e.date_ecriture <= ${dateFin}
  `);
  const deductible = await tx.execute(sql`
    SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS montant
    FROM lignes_ecriture le
    JOIN ecritures e ON le.ecriture_id = e.id
    JOIN comptes_comptables cc ON le.compte_comptable_id = cc.id
    WHERE e.entreprise_id = ${entrepriseId} AND e.valide = true
      AND cc.numero LIKE '445%'
      AND e.date_ecriture >= ${dateDebut} AND e.date_ecriture <= ${dateFin}
  `);
  const tvaCollectee = Number(collectee.rows?.[0]?.montant || 0);
  const tvaDeductible = Number(deductible.rows?.[0]?.montant || 0);
  return { tvaCollectee, tvaDeductible, tvaADecaisser: tvaCollectee - tvaDeductible };
}

// ---------------------------------------------------------------------------
// Seed principal
// ---------------------------------------------------------------------------

/**
 * Remplit une entreprise démo (déjà créée, plan SYSCOHADA initialisé) avec
 * des données cohérentes. Tout se passe dans une seule transaction tenant :
 * en cas d'échec, rien n'est persisté.
 */
export async function seedDemoEnterprise(entrepriseId, demoUserId) {
  const eid = Number(entrepriseId);
  const p = `DEMO-${eid}`;
  const prev = previousMonthRange();
  return withTenantTransaction(eid, async (tx) => {
    await configureComptesAutomatiques(tx, eid);

    // --- Trésorerie ---------------------------------------------------------
    const compteBanque = await getCompteId(tx, eid, '521');
    const compteCaisse = await getCompteId(tx, eid, '571');
    const [banque] = await tx.insert(comptesBancaires).values({
      entrepriseId: eid, nomCompte: 'Banque principale — Démo', numeroCompte: 'TG-ECB-0001-DEMO',
      banque: 'Ecobank Togo (démo)', soldeInitial: '500000.00', soldeActuel: '500000.00',
      type: 'banque', compteComptableId: compteBanque,
    }).returning();
    const [caisse] = await tx.insert(comptesBancaires).values({
      entrepriseId: eid, nomCompte: 'Caisse — Démo', numeroCompte: 'CAISSE-DEMO',
      banque: 'Caisse (démo)', soldeInitial: '150000.00', soldeActuel: '150000.00',
      type: 'caisse', compteComptableId: compteCaisse,
    }).returning();

    // --- Tiers ---------------------------------------------------------------
    const [cliAgriSud] = await tx.insert(clients).values({
      entrepriseId: eid, numeroClient: `${p}-CLI-001`, nom: 'Coopérative Agri-Sud — Kpalimé (démo)',
      type: 'entreprise', email: 'contact-agrisud@demo.invalid', telephone: '+228 90 11 22 33',
      adresse: 'Quartier Avédji, Kpalimé (démo)', ville: 'Kpalimé', pays: 'Togo', delaiPaiement: 30,
    }).returning();
    const [cliPlateaux] = await tx.insert(clients).values({
      entrepriseId: eid, numeroClient: `${p}-CLI-002`, nom: 'Ferme des Plateaux — Atakpamé (démo)',
      type: 'entreprise', email: 'contact-plateaux@demo.invalid', telephone: '+228 91 22 33 44',
      adresse: 'Route de Sokodé, Atakpamé (démo)', ville: 'Atakpamé', pays: 'Togo', delaiPaiement: 30,
    }).returning();
    const [cliAmeyo] = await tx.insert(clients).values({
      entrepriseId: eid, numeroClient: `${p}-CLI-003`, nom: 'Établissements Améyo — Lomé (démo)',
      type: 'entreprise', email: 'contact-ameyo@demo.invalid', telephone: '+228 92 33 44 55',
      adresse: 'Hédzranawoé, Lomé (démo)', ville: 'Lomé', pays: 'Togo', delaiPaiement: 7,
    }).returning();
    const [cliQuincaillerie] = await tx.insert(clients).values({
      entrepriseId: eid, numeroClient: `${p}-CLI-004`, nom: 'Quincaillerie Moderne — Sokodé (démo)',
      type: 'entreprise', email: 'contact-quincaillerie@demo.invalid', telephone: '+228 93 44 55 66',
      adresse: 'Centre-ville, Sokodé (démo)', ville: 'Sokodé', pays: 'Togo', delaiPaiement: 30,
    }).returning();

    const [fouAgroParts] = await tx.insert(fournisseurs).values({
      entrepriseId: eid, numeroFournisseur: `${p}-FOU-001`, raisonSociale: 'AgroParts Import (démo)',
      contactPrincipal: 'M. Kossi Agbeko', email: 'contact-agroparts@demo.invalid',
      telephone: '+228 96 11 22 33', adresse: 'Zone portuaire, Lomé (démo)', delaiPaiement: 30,
    }).returning();
    const [fouTransport] = await tx.insert(fournisseurs).values({
      entrepriseId: eid, numeroFournisseur: `${p}-FOU-002`, raisonSociale: 'Transport Horizon (démo)',
      contactPrincipal: 'Mme Afi Lawson', email: 'contact-horizon@demo.invalid',
      telephone: '+228 97 22 33 44', adresse: 'Bè, Lomé (démo)', delaiPaiement: 15,
    }).returning();
    const [fouEmballages] = await tx.insert(fournisseurs).values({
      entrepriseId: eid, numeroFournisseur: `${p}-FOU-003`, raisonSociale: 'Emballages du Golfe (démo)',
      contactPrincipal: 'M. Yao Mensah', email: 'contact-emballages@demo.invalid',
      telephone: '+228 98 33 44 55', adresse: 'Agoè, Lomé (démo)', delaiPaiement: 30,
    }).returning();

    const [entrepot] = await tx.insert(entrepots).values({
      entrepriseId: eid, nom: 'Entrepôt principal (démo)', adresse: 'Agoè, Lomé (démo)',
      responsable: 'Aya Kouassi', telephone: '+228 90 55 66 77',
    }).returning();

    // --- Produits ------------------------------------------------------------
    // Marchandises avec stock (le CMUP est le circuit à démontrer).
    const marchandises = [
      { reference: `${p}-PRD-RIZ`, nom: 'Riz 50 kg', cout: 18000, prix: 25000, stock: 40, unite: 'sac' },
      { reference: `${p}-PRD-HUILE`, nom: 'Huile 5 L', cout: 6500, prix: 9000, stock: 60, unite: 'bidon' },
      { reference: `${p}-PRD-CIMENT`, nom: 'Ciment 50 kg', cout: 3800, prix: 5000, stock: 100, unite: 'sac' },
    ];
    const produitsMarchandises = {};
    for (const m of marchandises) {
      const [produit] = await tx.insert(produits).values({
        entrepriseId: eid, reference: m.reference, nom: m.nom, uniteMesure: m.unite,
        quantite: String(m.stock), prixAchat: fmt2(m.cout), prixVente: fmt2(m.prix),
        coutMoyen: fmt2(m.cout), valorisationMethod: 'CMP', fournisseurId: fouAgroParts.id,
      }).returning();
      produitsMarchandises[m.nom] = produit;
      await tx.insert(stockParEntrepot).values({
        entrepriseId: eid, produitId: produit.id, entrepotId: entrepot.id,
        quantitePresente: String(m.stock), quantiteReservee: '0', quantiteDisponible: String(m.stock),
        emplacement: `A-${m.nom.slice(0, 3).toUpperCase()}`,
      });
      await tx.insert(mouvementsStock).values({
        entrepriseId: eid, produitId: produit.id, type: 'entree', quantite: String(m.stock),
        prixUnitaire: fmt2(m.cout), reference: 'Stock initial (démo)',
        notes: 'Stock d’ouverture de la démonstration', userId: demoUserId,
      });
      await createEcritureOuvertureStock({
        entrepriseId: eid, produitId: produit.id, produitNom: produit.nom,
        reference: produit.reference, montant: m.stock * m.cout, executor: tx,
      });
      await ensureOpeningValuationLayer(tx, {
        entrepriseId: eid, produitId: produit.id, productSnapshot: produit, force: true,
      });
    }
    const riz = produitsMarchandises['Riz 50 kg'];
    const huile = produitsMarchandises['Huile 5 L'];
    const ciment = produitsMarchandises['Ciment 50 kg'];

    const updateStockEntrepot = async (produitId, delta) => {
      await tx.update(stockParEntrepot).set({
        quantitePresente: sql`${stockParEntrepot.quantitePresente} + ${delta}`,
        quantiteDisponible: sql`${stockParEntrepot.quantiteDisponible} + ${delta}`,
        updatedAt: new Date(),
      }).where(and(
        eq(stockParEntrepot.produitId, produitId),
        eq(stockParEntrepot.entrepotId, entrepot.id),
      ));
    };

    // --- Commandes d'achat ----------------------------------------------------
    const [cmd1] = await tx.insert(commandesAchat).values({
      entrepriseId: eid, numeroCommande: await nextCommandeAchat(tx, eid),
      fournisseurId: fouAgroParts.id, statut: 'confirmee', dateCommande: isoDaysAgo(10),
      dateLivraisonPrevue: isoDaysAgo(9), totalHT: '360000.00', totalTVA: '64800.00',
      totalTTC: '424800.00', notes: 'Commande de démonstration — Riz 50 kg', userId: demoUserId,
    }).returning();
    await tx.insert(commandesAchatItems).values({
      entrepriseId: eid, commandeId: cmd1.id, produitId: riz.id, description: 'Riz 50 kg',
      quantite: '20', prixUnitaire: '18000.00', totalLigne: '360000.00',
    });
    const [cmd2] = await tx.insert(commandesAchat).values({
      entrepriseId: eid, numeroCommande: await nextCommandeAchat(tx, eid),
      fournisseurId: fouTransport.id, statut: 'livree', dateCommande: isoDaysAgo(8),
      dateLivraisonPrevue: isoDaysAgo(7), totalHT: '120000.00', totalTVA: '21600.00',
      totalTTC: '141600.00', notes: 'Commande de démonstration — transport livré', userId: demoUserId,
    }).returning();
    await tx.insert(commandesAchatItems).values({
      entrepriseId: eid, commandeId: cmd2.id, produitId: null, description: 'Transport Lomé–Kpalimé',
      quantite: '1', prixUnitaire: '120000.00', totalLigne: '120000.00',
    });

    // --- Bon de réception CMD1 (le stock entre UNE fois, ici) -----------------
    const [bonReception] = await tx.insert(bonsReception).values({
      entrepriseId: eid, numero: `BR-${eid}-000001`, fournisseurId: fouAgroParts.id,
      dateReception: isoDaysAgo(9), statut: 'validee', entrepotId: entrepot.id,
      commandeAchatId: cmd1.id, totalHT: '360000.00',
      notes: 'Réception de démonstration — Riz 50 kg', userId: demoUserId,
    }).returning();
    const [ligneReception] = await tx.insert(lignesReception).values({
      entrepriseId: eid, bonReceptionId: bonReception.id, produitId: riz.id,
      quantiteCommandee: '20', quantiteRecue: '20', prixUnitaireEstime: '18000.00',
    }).returning();
    const [mouvementReception] = await tx.insert(mouvementsStock).values({
      entrepriseId: eid, produitId: riz.id, type: 'entree', quantite: '20',
      prixUnitaire: '18000.00', reference: bonReception.numero,
      notes: 'Réception commande Riz 50 kg (démo)', userId: demoUserId,
    }).returning();
    await tx.update(lignesReception).set({ mouvementStockId: mouvementReception.id })
      .where(eq(lignesReception.id, ligneReception.id));
    await tx.update(produits).set({
      quantite: sql`${produits.quantite} + 20`, updatedAt: new Date(),
    }).where(eq(produits.id, riz.id));
    await updateStockEntrepot(riz.id, 20);
    await createStockValuationLayer(tx, {
      entrepriseId: eid, produitId: riz.id, mouvementId: mouvementReception.id,
      quantity: 20, totalCost: 360000, unitCost: 18000, productSnapshot: riz,
    });
    const ecritureReception = await createEcritureReception({
      entrepriseId: eid, receptionNumero: bonReception.numero, dateReception: isoDaysAgo(9),
      fournisseurNom: fouAgroParts.raisonSociale, totalHT: 360000, executor: tx,
    });
    await tx.update(bonsReception).set({ ecritureStockId: ecritureReception?.id || null })
      .where(eq(bonsReception.id, bonReception.id));

    // --- Factures fournisseurs -------------------------------------------------
    // FA-A0 (octobre, payée) : transport, TVA déductible du mois précédent.
    let fa0 = await createPurchaseInvoice(tx, eid, demoUserId, {
      fournisseur: fouTransport, numeroFactureFournisseur: 'TH-2026-1042',
      dateFacture: isoDaysAgo(27),
      items: [{ description: 'Transport marchandises — octobre (démo)', quantite: 1, prixUnitaire: 60000 }],
      notes: 'Facture fournisseur de démonstration (mois précédent)',
    });
    fa0 = await validatePurchaseInvoice(tx, eid, demoUserId, fa0, fouTransport, {});
    fa0 = await paySupplier(tx, eid, demoUserId, fa0, fouTransport, {
      montant: 70800, modePaiement: 'especes', reference: 'ESP-FA0-DEMO',
      datePaiement: isoDaysAgo(27), compteBancaireId: caisse.id,
    });

    // FA-A1 : Riz 20 — la réception BR1 a déjà entré le stock, la facture
    // solde donc le 408 (montantPending), sans deuxième entrée de stock.
    let fa1 = await createPurchaseInvoice(tx, eid, demoUserId, {
      fournisseur: fouAgroParts, numeroFactureFournisseur: 'API-2026-0871',
      commandeId: cmd1.id, dateFacture: isoDaysAgo(9),
      items: [{ produitId: riz.id, description: 'Riz 50 kg', quantite: 20, prixUnitaire: 18000, uniteMesure: 'sac' }],
      notes: 'Facture fournisseur de démonstration — rapprochée de la réception BR',
    });
    fa1 = await validatePurchaseInvoice(tx, eid, demoUserId, fa1, fouAgroParts, { montantPending: 360000 });
    fa1 = await paySupplier(tx, eid, demoUserId, fa1, fouAgroParts, {
      montant: 200000, modePaiement: 'virement', reference: 'VIR-FA1-DEMO',
      datePaiement: isoDaysAgo(6), compteBancaireId: banque.id,
    });

    // FA-A2 : emballages (service), à payer.
    let fa2 = await createPurchaseInvoice(tx, eid, demoUserId, {
      fournisseur: fouEmballages, numeroFactureFournisseur: 'EG-2026-0315',
      dateFacture: isoDaysAgo(5),
      items: [{ description: 'Emballages et fournitures (démo)', quantite: 1, prixUnitaire: 85000 }],
      notes: 'Facture fournisseur de démonstration — à payer',
    });
    fa2 = await validatePurchaseInvoice(tx, eid, demoUserId, fa2, fouEmballages, {});

    // --- Devis ------------------------------------------------------------------
    const [devis1] = await tx.insert(devis).values({
      entrepriseId: eid, numeroDevis: await nextDevis(tx, eid), clientId: cliAmeyo.id,
      statut: 'brouillon', dateDevis: isoDaysAgo(4), dateExpiration: addDays(isoDaysAgo(4), 30),
      totalHT: '100000.00', totalTVA: '18000.00', totalTTC: '118000.00',
      notes: 'Devis de démonstration — brouillon', userId: demoUserId,
    }).returning();
    await tx.insert(devisItems).values([
      { entrepriseId: eid, devisId: devis1.id, produitId: null, description: 'Tenue de comptabilité mensuelle', quantite: '1', prixUnitaire: '75000.00', totalLigne: '75000.00' },
      { entrepriseId: eid, devisId: devis1.id, produitId: null, description: 'Déclaration TVA mensuelle', quantite: '1', prixUnitaire: '25000.00', totalLigne: '25000.00' },
    ]);
    const [devis2] = await tx.insert(devis).values({
      entrepriseId: eid, numeroDevis: await nextDevis(tx, eid), clientId: cliPlateaux.id,
      statut: 'acceptee', dateDevis: isoDaysAgo(12), dateExpiration: addDays(isoDaysAgo(12), 30),
      totalHT: '150000.00', totalTVA: '27000.00', totalTTC: '177000.00',
      notes: 'Devis de démonstration — accepté puis facturé', userId: demoUserId,
    }).returning();
    await tx.insert(devisItems).values({
      entrepriseId: eid, devisId: devis2.id, produitId: null,
      description: 'Établissement des états financiers', quantite: '1', prixUnitaire: '150000.00', totalLigne: '150000.00',
    });

    // --- Factures clients ---------------------------------------------------------
    // F5 (octobre, payée) — alimente la TVA du mois précédent.
    let f5 = await createInvoice(tx, eid, demoUserId, {
      client: cliAgriSud, dateFacture: isoDaysAgo(28),
      items: [{ produitId: riz.id, description: 'Riz 50 kg', quantite: 5, prixUnitaire: 25000 }],
      notes: 'Facture de démonstration (mois précédent)',
    });
    await fulfillInvoice(tx, eid, demoUserId, f5);
    f5 = await payInvoice(tx, eid, demoUserId, f5, cliAgriSud, {
      montant: 147500, modePaiement: 'tmoney', reference: 'TM-F5-DEMO',
      datePaiement: isoDaysAgo(27), compteBancaireId: banque.id,
    });
    await updateStockEntrepot(riz.id, -5);

    // F1 (payée intégralement) : Riz 10 + prestation.
    let f1 = await createInvoice(tx, eid, demoUserId, {
      client: cliAgriSud, dateFacture: isoDaysAgo(8),
      items: [
        { produitId: riz.id, description: 'Riz 50 kg', quantite: 10, prixUnitaire: 25000 },
        { description: 'Tenue de comptabilité mensuelle', quantite: 1, prixUnitaire: 75000 },
      ],
    });
    await fulfillInvoice(tx, eid, demoUserId, f1);
    f1 = await payInvoice(tx, eid, demoUserId, f1, cliAgriSud, {
      montant: 383500, modePaiement: 'virement', reference: 'VIR-F1-DEMO',
      datePaiement: isoDaysAgo(6), compteBancaireId: banque.id,
    });
    await updateStockEntrepot(riz.id, -10);

    // F2 (devis accepté, partiellement payée) : prestation seule.
    let f2 = await createInvoice(tx, eid, demoUserId, {
      client: cliPlateaux, dateFacture: isoDaysAgo(12),
      items: [{ description: 'Établissement des états financiers', quantite: 1, prixUnitaire: 150000 }],
      notes: `Converti du devis ${devis2.numeroDevis} (démo)`,
    });
    await fulfillInvoice(tx, eid, demoUserId, f2);
    f2 = await payInvoice(tx, eid, demoUserId, f2, cliPlateaux, {
      montant: 100000, modePaiement: 'especes', reference: 'ESP-F2-DEMO',
      datePaiement: isoDaysAgo(10), compteBancaireId: caisse.id,
    });

    // F3 (envoyée, échéance dépassée — délai 7 j) : Huile 20.
    let f3 = await createInvoice(tx, eid, demoUserId, {
      client: cliAmeyo, dateFacture: isoDaysAgo(20),
      items: [{ produitId: huile.id, description: 'Huile 5 L', quantite: 20, prixUnitaire: 9000 }],
      notes: 'Facture de démonstration — à relancer (échéance dépassée)',
    });
    await fulfillInvoice(tx, eid, demoUserId, f3);
    await updateStockEntrepot(huile.id, -20);

    // F4 (brouillon) : Ciment 30 + conseil — écriture créée, pas de sortie stock.
    const f4 = await createInvoice(tx, eid, demoUserId, {
      client: cliQuincaillerie, dateFacture: isoDaysAgo(2),
      items: [
        { produitId: ciment.id, description: 'Ciment 50 kg', quantite: 30, prixUnitaire: 5000 },
        { description: 'Conseil fiscal — heure', quantite: 2, prixUnitaire: 20000 },
      ],
      notes: 'Facture de démonstration — brouillon',
    });

    // --- Avoir client sur F1 (retour de 2 sacs de riz) ---------------------------
    const f1Items = await tx.select().from(factureItems)
      .where(and(eq(factureItems.factureId, f1.id), eq(factureItems.entrepriseId, eid)));
    const f1RizItem = f1Items.find((i) => i.produitId === riz.id);
    const avoirHT = 50000;
    const avoirTVA = Math.round((avoirHT / Number(f1.totalHT)) * Number(f1.totalTVA));
    const avoirTTC = avoirHT + avoirTVA;
    const coutStockAvoir = 2 * Number(f1RizItem.coutUnitaireCMV || 18000);
    const numeroAvoir = await generateCreditNoteNumber(tx, {
      entrepriseId: eid, type: 'client', dateAvoir: isoDaysAgo(4),
    });
    const [noteCredit] = await tx.insert(notesCredit).values({
      entrepriseId: eid, type: 'client', ...numeroAvoir, clientId: cliAgriSud.id,
      factureId: f1.id, dateAvoir: isoDaysAgo(4), montantHT: fmt2(avoirHT),
      montantTVA: fmt2(avoirTVA), montantTTC: fmt2(avoirTTC), soldeRestant: fmt2(avoirTTC),
      motif: 'Retour de 2 sacs de riz — démonstration', statut: 'validee', userId: demoUserId,
    }).returning();
    const [mouvementRetour] = await tx.insert(mouvementsStock).values({
      entrepriseId: eid, produitId: riz.id, type: 'entree', quantite: '2',
      prixUnitaire: (coutStockAvoir / 2).toFixed(4), reference: noteCredit.numero,
      notes: `Retour client lié à la facture ${f1.numeroFacture}`, userId: demoUserId,
    }).returning();
    await createStockValuationLayer(tx, {
      entrepriseId: eid, produitId: riz.id, mouvementId: mouvementRetour.id,
      quantity: 2, totalCost: coutStockAvoir, unitCost: coutStockAvoir / 2, productSnapshot: riz,
    });
    await tx.update(produits).set({
      quantite: sql`${produits.quantite} + 2`, updatedAt: new Date(),
    }).where(eq(produits.id, riz.id));
    await updateStockEntrepot(riz.id, 2);
    await updateProductAverageCost(tx, eid, riz.id);
    await tx.insert(notesCreditItems).values({
      entrepriseId: eid, noteCreditId: noteCredit.id, factureItemId: f1RizItem.id,
      produitId: riz.id, description: 'Riz 50 kg', quantite: '2',
      prixUnitaire: '25000.0000', totalHT: fmt2(avoirHT), montantTVA: fmt2(avoirTVA),
      coutStock: fmt2(coutStockAvoir), mouvementStockId: mouvementRetour.id,
    });
    await tx.update(factures).set({
      soldeRestant: fmt2(Math.max(0, Number(f1.soldeRestant || 0) - avoirTTC)),
      updatedAt: new Date(),
    }).where(eq(factures.id, f1.id));
    await tx.update(clients).set({
      soldeDu: sql`${clients.soldeDu} - ${avoirTTC}`, updatedAt: new Date(),
    }).where(eq(clients.id, cliAgriSud.id));
    await createEcritureAvoirClient({
      entrepriseId: eid, clientId: cliAgriSud.id, numeroAvoir: noteCredit.numero,
      dateAvoir: isoDaysAgo(4), clientNom: cliAgriSud.nom, totalHT: avoirHT,
      totalTVA: avoirTVA, totalTTC: avoirTTC, coutStock: coutStockAvoir,
      sourceId: noteCredit.id, executor: tx,
    });

    // --- Bon de livraison F1 -------------------------------------------------------
    const [bonLivraison] = await tx.insert(bonsLivraison).values({
      entrepriseId: eid, numeroBL: await nextBonLivraison(tx, eid), clientId: cliAgriSud.id,
      dateLivraison: isoDaysAgo(8), notes: 'Bon de livraison de démonstration — facture payée', userId: demoUserId,
    }).returning();
    await tx.insert(bonLivraisonItems).values({
      entrepriseId: eid, bonLivraisonId: bonLivraison.id, produitId: riz.id, quantite: '10',
    });

    // --- Dépenses / notes de frais --------------------------------------------------
    const [employe] = await tx.insert(employes).values({
      entrepriseId: eid, userId: demoUserId, matricule: `${p}-EMP-01`,
      nom: 'Kouassi', prenom: 'Aya', telephone: '+228 90 55 66 77',
      email: 'aya-kouassi@demo.invalid', poste: 'Assistante administrative',
      departement: 'Administration', typeContrat: 'CDI', dateEmbauche: isoDaysAgo(28),
    }).returning();
    const catLoyer = await createExpenseCategory(tx, eid, 'Loyer', '622');
    const catElectricite = await createExpenseCategory(tx, eid, 'Électricité', '605');
    const catConsommables = await createExpenseCategory(tx, eid, 'Consommables', '604');
    const catTransport = await createExpenseCategory(tx, eid, 'Transport', '625');
    const depLoyer = await createExpense(tx, eid, demoUserId, {
      categorie: catLoyer, montant: 180000, dateDepense: isoDaysAgo(15), description: 'Loyer boutique — novembre (démo)',
    });
    await approveExpense(tx, eid, demoUserId, depLoyer, catLoyer);
    const depElectricite = await createExpense(tx, eid, demoUserId, {
      categorie: catElectricite, montant: 45000, dateDepense: isoDaysAgo(12), description: 'Électricité — octobre (démo)',
    });
    await approveExpense(tx, eid, demoUserId, depElectricite, catElectricite);
    const depConsommables = await createExpense(tx, eid, demoUserId, {
      categorie: catConsommables, montant: 32000, dateDepense: isoDaysAgo(6), description: 'Consommables de bureau (démo)',
    });
    await approveExpense(tx, eid, demoUserId, depConsommables, catConsommables);
    const depTransport = await createExpense(tx, eid, demoUserId, {
      categorie: catTransport, montant: 25000, dateDepense: isoDaysAgo(4), description: 'Transport et carburant (démo)',
    });
    await approveExpense(tx, eid, demoUserId, depTransport, catTransport);
    await reimburseExpense(tx, eid, demoUserId, depTransport, {
      montant: 25000, dateRemboursement: isoDaysAgo(3), methodePaiement: 'virement',
      compteBancaireId: banque.id,
    });

    // --- TVA : déclaration du mois précédent, déclarée et payée ----------------------
    const tvaPrev = await calculerTvaSeed(tx, eid, prev.debut, prev.fin);
    const [declaration] = await tx.insert(declarationsFiscales).values({
      entrepriseId: eid, type: 'tva', periode: `${prev.debut}..${prev.fin}`,
      montant: fmt2(tvaPrev.tvaADecaisser), statut: 'payée',
      numeroDeclaration: `DEMO-OTR-${prev.periode}-001`, dateDeclaration: isoDaysAgo(20),
      dateSoumission: new Date(`${isoDaysAgo(20)}T09:00:00.000Z`),
      datePaiement: new Date(`${isoDaysAgo(20)}T09:30:00.000Z`),
      referencePaiement: `DEMO-PAIEMENT-TVA-${prev.periode}`,
      notes: JSON.stringify({
        version: 1, pays: 'togo', dateDebut: prev.debut, dateFin: prev.fin,
        source: 'écritures comptables validées (démo)',
        tvaCollectee: tvaPrev.tvaCollectee, tvaDeductible: tvaPrev.tvaDeductible,
        tvaADecaisser: tvaPrev.tvaADecaisser,
      }),
    }).returning();
    await createEcriturePaiementImpot({
      entrepriseId: eid, reference: declaration.referencePaiement,
      datePaiement: isoDaysAgo(20), typeImpot: 'tva', montant: tvaPrev.tvaADecaisser,
      periode: prev.periode, modePaiement: 'virement', compteBancaireId: banque.id, executor: tx,
    });
    const tvaPaiementTx = await addTresorerie(tx, eid, {
      compteBancaireId: banque.id, type: 'decaissement', montant: tvaPrev.tvaADecaisser,
      dateTransaction: isoDaysAgo(20), categorie: 'Impôt',
      description: `Paiement TVA ${prev.periode} (démo)`, tiersNom: 'OTR Togo',
      numeroPiece: declaration.referencePaiement, modePaiement: 'virement', userId: demoUserId,
    });

    // --- Rapprochement bancaire partiel (relevé jusqu'à J-10) -------------------------
    const dateFinRapprochement = isoDaysAgo(10);
    // Solde comptable au J-10 : initial + encaissement F5 − paiement TVA.
    const soldeRapprochement = 500000 + 147500 - Number(tvaPrev.tvaADecaisser);
    const [rapprochement] = await tx.insert(rapprochementsBancaires).values({
      entrepriseId: eid, compteBancaireId: banque.id, dateRapprochement: isoDaysAgo(9),
      dateDebut: prev.debut, dateFin: dateFinRapprochement,
      soldeReleve: fmt2(soldeRapprochement), soldeComptable: fmt2(soldeRapprochement),
      ecart: '0', statut: 'en_cours', notes: 'Rapprochement partiel de démonstration', userId: demoUserId,
    }).returning();
    // Marquer les 2 mouvements du relevé comme rapprochés (F5 + paiement TVA).
    const txsArapprocher = await tx.select({ id: transactionsTresorerie.id })
      .from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.entrepriseId, eid),
        eq(transactionsTresorerie.compteBancaireId, banque.id),
        sql`${transactionsTresorerie.dateTransaction} <= ${dateFinRapprochement}`,
      ));
    for (const row of txsArapprocher) {
      await tx.update(transactionsTresorerie).set({
        rapproche: true, rapprochementId: rapprochement.id,
      }).where(eq(transactionsTresorerie.id, row.id));
    }

    // --- Écritures OD manuelles ---------------------------------------------------------
    // Comptes résolus par numéro exact (getCompteByNumero travaille par préfixe
    // et pourrait retourner un sous-compte, ex. 6811 au lieu de 681).
    const compte681 = await getCompteId(tx, eid, '681');
    const compte190 = await getCompteId(tx, eid, '190');
    const compte471 = await getCompteId(tx, eid, '471');
    const compte758 = await getCompteId(tx, eid, '758');
    await createEcritureComptable({
      entrepriseId: eid, journalCode: 'OD', journalNom: 'Journal des Opérations Diverses',
      journalType: 'od', dateEcriture: isoDaysAgo(3),
      libelle: 'Dotation aux provisions pour charges (démo)', numeroPiece: 'OD-PROV-DEMO',
      lignes: [
        { compteComptableId: compte681, debit: 20000, credit: 0, libelle: 'Dotation aux provisions (démo)' },
        { compteComptableId: compte190, debit: 0, credit: 20000, libelle: 'Provision pour charges (démo)' },
      ],
      executor: tx,
    });
    await createEcritureComptable({
      entrepriseId: eid, journalCode: 'OD', journalNom: 'Journal des Opérations Diverses',
      journalType: 'od', dateEcriture: isoDaysAgo(2),
      libelle: 'Régularisation divers (démo)', numeroPiece: 'OD-REGUL-DEMO',
      lignes: [
        { compteComptableId: compte471, debit: 5000, credit: 0, libelle: 'Régularisation débiteurs divers (démo)' },
        { compteComptableId: compte758, debit: 0, credit: 5000, libelle: 'Régularisation produits divers (démo)' },
      ],
      executor: tx,
    });

    // --- Inventaire tournant en brouillon + paramètres fiscaux ------------------------------
    const [inventaire] = await tx.insert(inventairesTournants).values({
      entrepriseId: eid, entrepotId: entrepot.id, numero: `${p}-INV-001`,
      dateDebut: isoDaysAgo(2), statut: 'en_cours', userId: demoUserId,
    }).returning();
    const stocksFinaux = await tx.select().from(produits)
      .where(eq(produits.entrepriseId, eid));
    await tx.insert(lignInventairesTournants).values(
      stocksFinaux.map((produit) => ({
        inventaireId: inventaire.id, produitId: produit.id,
        quantiteSysteme: produit.quantite, quantiteComptee: produit.quantite, ecart: '0',
      })),
    );
    await tx.insert(parametresFiscaux).values({
      entrepriseId: eid, pays: 'togo', administrationNom: 'OTR',
      regimeImposition: 'reel-simplifie', centreImpots: 'Lomé (démo)',
    });

    return {
      entrepriseId: eid,
      banqueId: banque.id,
      caisseId: caisse.id,
      clients: { cliAgriSud, cliPlateaux, cliAmeyo, cliQuincaillerie },
      fournisseurs: { fouAgroParts, fouTransport, fouEmballages },
      factures: { f1, f2, f3, f4, f5 },
      facturesAchat: { fa0, fa1, fa2 },
      tvaPrecedente: tvaPrev,
      tvaPaiementTransactionId: tvaPaiementTx.id,
      rapprochementId: rapprochement.id,
      employeId: employe.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Création complète d'une entreprise démo
// ---------------------------------------------------------------------------

/**
 * Crée une entreprise démo : entreprise + utilisateur admin + client SaaS +
 * abonnement démo (plan d'essai prix 0, sans expiration d'essai) + plan
 * SYSCOHADA + comptes automatiques + seed métier. En cas d'échec, tout ce
 * qui a été créé est supprimé (nettoyage compensatoire, sans journal).
 */
export async function createDemoEnterprise({ ipAddress = null, userAgent = null } = {}) {
  const h = crypto.randomBytes(6).toString('hex');
  const demoEmail = `demo-${h}@demo.comptaorion.com`;
  const now = new Date();
  const fiscalYear = now.getFullYear();
  const expiration = new Date(now);
  expiration.setFullYear(expiration.getFullYear() + 10);

  // Plan d'essai existant (prix 0) — jamais un plan payant. La fusion des
  // plans (en attente de validation par Cap) ne change rien ici.
  const [plan] = await db.select().from(plansAbonnement)
    .where(and(eq(plansAbonnement.actif, true), sql`${plansAbonnement.prix} = 0`))
    .orderBy(plansAbonnement.id)
    .limit(1);
  if (!plan) throw new Error('Le forfait gratuit de démonstration est indisponible.');

  const [entreprise] = await db.insert(entreprises).values({
    nom: DEMO_COMPANY_NAME,
    email: demoEmail,
    telephone: '+228 90 00 00 00',
    adresse: 'Agoè, Lomé (démo)',
    ville: 'Lomé',
    pays: 'Togo',
    devise: 'XOF',
    tauxTva: '18.00',
    systemeComptable: 'SYSCOHADA',
    debutAnneeFiscale: `${fiscalYear}-01-01`,
    finAnneeFiscale: `${fiscalYear}-12-31`,
    actif: true,
    isDemo: true,
  }).returning();

  try {
    const { user } = await withTenantTransaction(entreprise.id, async () => {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const [createdUser] = await db.insert(users).values({
        nom: 'Démonstration',
        email: demoEmail,
        username: `demo_${h}`,
        passwordHash,
        entrepriseId: entreprise.id,
        role: 'admin',
        actif: true,
      }).returning();
      await db.insert(saasClients).values({
        entrepriseId: entreprise.id,
        statut: 'actif',
        source: 'demo',
        notes: 'Démonstration publique — entreprise jetable, purge automatique.',
      });
      // Abonnement démo (§4.4) : plan d'essai prix 0, statut actif, expiration
      // à +10 ans (sentinelle technique, la purge supprime bien avant), remarque
      // DIFFÉRENTE de TRIAL_SUBSCRIPTION_NOTE → getTrialAccess() retourne null,
      // aucun trialExpiresAt dans le JWT, isTrial=true donc CMUP automatique.
      // Aucune saasVentes, aucune commission.
      await db.insert(abonnements).values({
        entrepriseId: entreprise.id,
        planId: plan.id,
        statut: 'actif',
        dateDebut: now,
        dateExpiration: expiration,
        montantMensuel: '0.00',
        modeRenouvellement: 'manuel',
        moisGratuits: 0,
        remarques: DEMO_SUBSCRIPTION_NOTE,
        createdAt: now,
      });
      return { user: createdUser };
    });

    await withTenantTransaction(entreprise.id, () =>
      initializeSyscohadaForEnterprise(entreprise.id),
    );
    const seed = await seedDemoEnterprise(entreprise.id, user.id);
    return { entreprise, user, seed };
  } catch (error) {
    try {
      await deleteEnterpriseData(entreprise.id, {
        motif: 'demo_creation_echec', supprimePar: 'systeme:demo', journal: false,
      });
    } catch (cleanupError) {
      console.error('Nettoyage incomplet après échec de création démo:', cleanupError);
    }
    throw error;
  }
}
