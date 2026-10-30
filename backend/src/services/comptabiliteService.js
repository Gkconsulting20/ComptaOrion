import { db } from '../db.js';
import { journaux, ecritures, lignesEcritures, comptesComptables, comptesBancaires, parametresComptables } from '../schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { formatJournalEntryNumber } from './sequentialNumbering.js';

const JOURNAL_CODES = {
  ACHATS: 'AC',
  VENTES: 'VT',
  BANQUE: 'BQ',
  CAISSE: 'CA',
  OD: 'OD'
};

const COMPTES_SYSCOHADA = {
  STOCK_MARCHANDISES: '31',
  FOURNISSEURS: '401',
  FOURNISSEURS_FACTURES_NON_PARVENUES: '408',
  CLIENTS: '411',
  PERSONNEL_AVANCES: '421',
  ETAT_TVA_DUE: '4434',
  ETAT_IMPOTS: '44',
  BANQUE: '52',
  CAISSE: '57',
  ACHATS_MARCHANDISES: '601',
  COUT_VENTES_MARCHANDISES: '603',
  ACHATS_SERVICES: '61',
  AUTRES_CHARGES_EXTERNES: '62',
  CHARGES_PERSONNEL: '64',
  IMPOTS_TAXES: '64',
  VENTES_MARCHANDISES: '701',
  TVA_DEDUCTIBLE: '445',
  TVA_COLLECTEE: '443',
  ECARTS_PRIX: '603'
};

export async function getOrCreateJournal(entrepriseId, code, nom, type, executor = db) {
  let journal = await executor.select().from(journaux)
    .where(and(eq(journaux.entrepriseId, entrepriseId), eq(journaux.code, code)))
    .limit(1);
  
  if (journal.length === 0) {
    const [newJournal] = await executor.insert(journaux).values({
      entrepriseId,
      code,
      nom,
      type,
      actif: true
    }).returning();
    return newJournal;
  }
  return journal[0];
}

export async function getCompteByNumero(entrepriseId, numero, executor = db) {
  const comptes = await executor.select().from(comptesComptables)
    .where(and(
      eq(comptesComptables.entrepriseId, entrepriseId),
      sql`${comptesComptables.numero} LIKE ${numero + '%'}`
    ))
    .limit(1);
  return comptes[0] || null;
}

export async function getCompteById(compteId, executor = db) {
  const [compte] = await executor.select().from(comptesComptables)
    .where(eq(comptesComptables.id, compteId));
  return compte;
}

async function getCompteTresorerie(entrepriseId, modePaiement, compteBancaireId, executor = db) {
  if (modePaiement === 'especes') {
    return getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.CAISSE, executor);
  }

  if (!compteBancaireId) {
    return getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.BANQUE, executor);
  }

  const [bankAccount] = await executor.select({
    compteComptableId: comptesBancaires.compteComptableId,
  }).from(comptesBancaires).where(and(
    eq(comptesBancaires.id, Number(compteBancaireId)),
    eq(comptesBancaires.entrepriseId, Number(entrepriseId)),
    eq(comptesBancaires.actif, true),
  )).limit(1);

  if (!bankAccount?.compteComptableId) {
    throw new Error('Le compte de trésorerie sélectionné ne possède pas de compte comptable associé.');
  }

  const [account] = await executor.select().from(comptesComptables).where(and(
    eq(comptesComptables.id, bankAccount.compteComptableId),
    eq(comptesComptables.entrepriseId, Number(entrepriseId)),
  )).limit(1);

  if (!account) {
    throw new Error('Le compte comptable du compte de trésorerie est introuvable pour cette entreprise.');
  }

  return account;
}

export async function generateNumeroEcriture(entrepriseId, journal, dateEcriture, executor) {
  if (!executor) {
    throw new Error('La numérotation des écritures doit être exécutée dans une transaction.');
  }

  const journalInfo = typeof journal === 'string'
    ? (await executor.select().from(journaux).where(and(
        eq(journaux.entrepriseId, entrepriseId),
        eq(journaux.code, journal)
      )).limit(1))[0]
    : journal;
  if (!journalInfo?.id || !journalInfo.code) {
    throw new Error('Journal introuvable pour attribuer un numéro d’écriture.');
  }

  const rawDate = dateEcriture instanceof Date
    ? dateEcriture.toISOString()
    : String(dateEcriture || '');
  const dateValue = rawDate.slice(0, 10);
  const year = Number(dateValue.slice(0, 4));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !Number.isInteger(year)) {
    throw new Error('Une date d’écriture valide est requise pour la numérotation.');
  }

  // The lock is scoped to tenant + journal + fiscal year and lives until the
  // surrounding transaction commits or rolls back.
  const lockKey = `comptaorion:ecritures:${entrepriseId}:${journalInfo.id}:${year}`;
  await executor.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
  `);

  const sequenceResult = await executor.execute(sql`
    INSERT INTO ecriture_sequences
      (entreprise_id, journal_id, exercice, derniere_sequence, updated_at)
    SELECT
      ${entrepriseId},
      ${journalInfo.id},
      ${year},
      COALESCE(MAX((regexp_match(numero_ecriture, '-([0-9]+)$'))[1]::integer), 0) + 1,
      NOW()
    FROM ecritures
    WHERE entreprise_id = ${entrepriseId}
      AND journal_id = ${journalInfo.id}
      AND date_ecriture >= ${`${year}-01-01`}
      AND date_ecriture < ${`${year + 1}-01-01`}
      AND numero_ecriture ~ '-[0-9]+$'
    ON CONFLICT (entreprise_id, journal_id, exercice)
    DO UPDATE SET
      derniere_sequence = GREATEST(
        ecriture_sequences.derniere_sequence,
        EXCLUDED.derniere_sequence - 1
      ) + 1,
      updated_at = NOW()
    RETURNING derniere_sequence
  `);
  const nextSequence = Number(sequenceResult.rows?.[0]?.derniere_sequence);
  if (!Number.isSafeInteger(nextSequence) || nextSequence <= 0) {
    throw new Error('La séquence comptable n’a pas pu être réservée.');
  }
  return formatJournalEntryNumber(journalInfo.code, year, nextSequence, journalInfo.type);
}

export async function createEcritureComptable(params) {
  const requestedExecutor = params.executor;
  if (!requestedExecutor || requestedExecutor === db) {
    return db.transaction((tx) => createEcritureComptable({ ...params, executor: tx }));
  }

  const {
    entrepriseId,
    journalCode,
    journalNom,
    journalType,
    dateEcriture,
    libelle,
    numeroPiece,
    lignes,
    valide = false,
    sourceType = null,
    sourceId = null,
    executor = requestedExecutor
  } = params;

  const journal = await getOrCreateJournal(entrepriseId, journalCode, journalNom, journalType, executor);
  const numeroEcriture = await generateNumeroEcriture(entrepriseId, journal, dateEcriture, executor);

  const totalDebit = lignes.reduce((sum, l) => sum + parseFloat(l.debit || 0), 0);
  const totalCredit = lignes.reduce((sum, l) => sum + parseFloat(l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture non équilibrée: Débit=${totalDebit}, Crédit=${totalCredit}`);
  }

  const [ecriture] = await executor.insert(ecritures).values({
    entrepriseId,
    journalId: journal.id,
    numeroEcriture,
    dateEcriture,
    libelle,
    numeroPiece,
    valide,
    totalDebit: totalDebit.toFixed(2),
    totalCredit: totalCredit.toFixed(2)
  }).returning();

  for (const ligne of lignes) {
    let compteId = ligne.compteComptableId;
    
    if (!compteId && ligne.numeroCompte) {
      const compte = await getCompteByNumero(entrepriseId, ligne.numeroCompte, executor);
      if (!compte) {
        console.warn(`Compte ${ligne.numeroCompte} non trouvé pour entreprise ${entrepriseId}`);
        continue;
      }
      compteId = compte.id;
    }

    if (compteId) {
      await executor.insert(lignesEcritures).values({
        ecritureId: ecriture.id,
        compteComptableId: compteId,
        debit: (parseFloat(ligne.debit) || 0).toFixed(2),
        credit: (parseFloat(ligne.credit) || 0).toFixed(2),
        libelle: ligne.libelle || libelle,
        entrepriseId
      });
    }
  }

  return ecriture;
}

export async function createEcritureReception(params) {
  const {
    entrepriseId,
    receptionNumero,
    dateReception,
    fournisseurNom,
    totalHT,
    executor = db
  } = params;

  const compteStock = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.STOCK_MARCHANDISES, executor);
  const compte408 = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.FOURNISSEURS_FACTURES_NON_PARVENUES, executor);

  if (!compteStock || !compte408) {
    console.warn('Comptes comptables (31x ou 408) non configurés pour entreprise', entrepriseId);
    return null;
  }

  const ecrituresLignes = [
    {
      compteComptableId: compteStock.id,
      debit: totalHT,
      credit: 0,
      libelle: `Stock réceptionné - ${receptionNumero}`
    },
    {
      compteComptableId: compte408.id,
      debit: 0,
      credit: totalHT,
      libelle: `Fournisseur facture non parvenue - ${fournisseurNom}`
    }
  ];

  return createEcritureComptable({
    entrepriseId,
    journalCode: JOURNAL_CODES.ACHATS,
    journalNom: 'Journal des Achats',
    journalType: 'achats',
    dateEcriture: dateReception,
    libelle: `Réception ${receptionNumero} - ${fournisseurNom}`,
    numeroPiece: receptionNumero,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcritureFactureAchat(params) {
  const {
    entrepriseId,
    numeroFacture,
    dateFacture,
    fournisseurNom,
    totalHT,
    totalTVA = 0,
    totalTTC,
    montantPending = 0,
    ecartPrix = 0,
    montantValorisationStock = 0,
    montantStockDirect = 0,
    executor = db
  } = params;

  const compte401 = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.FOURNISSEURS, executor);
  if (!compte401) {
    throw new Error('Le compte fournisseur collectif 401 est requis pour comptabiliser une facture fournisseur.');
  }
  const compte408 = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.FOURNISSEURS_FACTURES_NON_PARVENUES, executor);
  const compteTVA = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.TVA_DEDUCTIBLE, executor);
  const compteEcarts = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.ECARTS_PRIX, executor);
  const compteAchatsServices = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.ACHATS_SERVICES, executor);
  const compteStock = Number(montantValorisationStock) !== 0 || Number(montantStockDirect) > 0
    ? await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.STOCK_MARCHANDISES, executor)
    : null;

  const ecrituresLignes = [];

  if (montantPending > 0 && compte408) {
    ecrituresLignes.push({
      compteComptableId: compte408.id,
      debit: montantPending,
      credit: 0,
      libelle: `Régularisation facture non parvenue - ${numeroFacture}`
    });
  }

  if (Number(montantPending) <= 0 && Number(montantValorisationStock) !== 0) {
    throw new Error('Une correction de stock ne peut être passée sans réception en attente correspondante.');
  }

  const directStockAmount = Number(montantStockDirect || 0);
  if (Number(montantPending) > 0 && directStockAmount > 0) {
    throw new Error('Un achat direct ne peut pas être comptabilisé en même temps qu’une réception en attente.');
  }
  if (directStockAmount < 0 || directStockAmount > Number(totalHT) + 0.01) {
    throw new Error('Le montant de stock direct est incohérent avec le total HT de la facture.');
  }
  if (Number(montantPending) <= 0 && directStockAmount > 0) {
    if (!compteStock) {
      throw new Error('Le compte de stock (classe 31) est requis pour comptabiliser l’achat direct.');
    }
    ecrituresLignes.push({
      compteComptableId: compteStock.id,
      debit: directStockAmount,
      credit: 0,
      libelle: `Entrée de stock - ${numeroFacture}`
    });
  }

  if (Number(montantPending) > 0 && Number(montantValorisationStock) !== 0) {
    if (!compteStock) {
      throw new Error('Le compte de stock (classe 31) est requis pour comptabiliser la correction de valorisation.');
    }
    const adjustment = Number(montantValorisationStock);
    ecrituresLignes.push({
      compteComptableId: compteStock.id,
      debit: adjustment > 0 ? adjustment : 0,
      credit: adjustment < 0 ? Math.abs(adjustment) : 0,
      libelle: `Correction du coût du stock restant - ${numeroFacture}`
    });
  }

  if (Number(montantPending) > 0 && ecartPrix !== 0 && compteEcarts) {
    if (ecartPrix > 0) {
      ecrituresLignes.push({
        compteComptableId: compteEcarts.id,
        debit: Math.abs(ecartPrix),
        credit: 0,
        libelle: `Écart de prix défavorable - ${numeroFacture}`
      });
    } else {
      ecrituresLignes.push({
        compteComptableId: compteEcarts.id,
        debit: 0,
        credit: Math.abs(ecartPrix),
        libelle: `Écart de prix favorable - ${numeroFacture}`
      });
    }
  }

  if (Number(montantPending) <= 0) {
    const expenseAmount = Math.max(0, Number(totalHT) - directStockAmount);
    if (expenseAmount > 0) {
      if (!compteAchatsServices) {
        throw new Error('Le compte de transport/frais fournisseur (61) est requis pour les achats non stockés.');
      }
      ecrituresLignes.push({
        compteComptableId: compteAchatsServices.id,
        debit: expenseAmount,
        credit: 0,
        libelle: `Achats non stockés - ${numeroFacture}`
      });
    }
  }

  if (totalTVA > 0 && compteTVA) {
    ecrituresLignes.push({
      compteComptableId: compteTVA.id,
      debit: totalTVA,
      credit: 0,
      libelle: `TVA déductible - ${numeroFacture}`
    });
  }

  ecrituresLignes.push({
    compteComptableId: compte401.id,
    debit: 0,
    credit: totalTTC,
    libelle: `Fournisseur ${fournisseurNom} - ${numeroFacture}`
  });

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables configurés pour créer écriture facture achat');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode: JOURNAL_CODES.ACHATS,
    journalNom: 'Journal des Achats',
    journalType: 'achats',
    dateEcriture: dateFacture,
    libelle: `Facture ${numeroFacture} - ${fournisseurNom}`,
    numeroPiece: numeroFacture,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcritureFactureVente(params) {
  const {
    entrepriseId,
    numeroFacture,
    dateFacture,
    clientNom,
    clientCompteId,
    totalHT,
    totalTVA = 0,
    totalTTC,
    executor = db
  } = params;

  const compte411 = clientCompteId ? await getCompteById(clientCompteId, executor) : await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.CLIENTS, executor);
  const compteVentes = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.VENTES_MARCHANDISES, executor);
  const compteTVA = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.TVA_COLLECTEE, executor);

  const ecrituresLignes = [];

  if (compte411) {
    ecrituresLignes.push({
      compteComptableId: compte411.id,
      debit: totalTTC,
      credit: 0,
      libelle: `Client ${clientNom} - ${numeroFacture}`
    });
  }

  if (compteVentes) {
    ecrituresLignes.push({
      compteComptableId: compteVentes.id,
      debit: 0,
      credit: totalHT,
      libelle: `Vente marchandises - ${numeroFacture}`
    });
  }

  if (totalTVA > 0 && compteTVA) {
    ecrituresLignes.push({
      compteComptableId: compteTVA.id,
      debit: 0,
      credit: totalTVA,
      libelle: `TVA collectée - ${numeroFacture}`
    });
  }

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables configurés pour créer écriture facture vente');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode: JOURNAL_CODES.VENTES,
    journalNom: 'Journal des Ventes',
    journalType: 'ventes',
    dateEcriture: dateFacture,
    libelle: `Facture ${numeroFacture} - ${clientNom}`,
    numeroPiece: numeroFacture,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcritureCoutVente({
  entrepriseId,
  numeroFacture,
  dateFacture,
  montantCMV,
  executor = db,
}) {
  const amount = Math.round((Number(montantCMV) || 0) * 100) / 100;
  if (amount <= 0) return null;

  const compteCMV = await getCompteByNumero(
    entrepriseId,
    COMPTES_SYSCOHADA.COUT_VENTES_MARCHANDISES,
    executor
  );
  const compteStock = await getCompteByNumero(
    entrepriseId,
    COMPTES_SYSCOHADA.STOCK_MARCHANDISES,
    executor
  );
  if (!compteCMV || !compteStock) {
    throw new Error('Configurez les comptes de CMV (603) et de stock (31) avant de valider la vente.');
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode: JOURNAL_CODES.VENTES,
    journalNom: 'Journal des Ventes',
    journalType: 'ventes',
    dateEcriture: dateFacture,
    libelle: `Coût des marchandises vendues - ${numeroFacture}`,
    numeroPiece: `${numeroFacture}-CMV`,
    lignes: [
      {
        compteComptableId: compteCMV.id,
        debit: amount,
        credit: 0,
        libelle: `CMV au coût moyen pondéré - ${numeroFacture}`,
      },
      {
        compteComptableId: compteStock.id,
        debit: 0,
        credit: amount,
        libelle: `Sortie du stock - ${numeroFacture}`,
      },
    ],
    valide: false,
    executor,
  });
}

export async function createEcriturePaiementFournisseur(params) {
  const {
    entrepriseId,
    reference,
    datePaiement,
    fournisseurNom,
    montant,
    modePaiement,
    compteBancaireId,
    executor = db
  } = params;

  const journalCode = modePaiement === 'especes' ? JOURNAL_CODES.CAISSE : JOURNAL_CODES.BANQUE;
  const journalNom = modePaiement === 'especes' ? 'Journal de Caisse' : 'Journal de Banque';
  
  const compte401 = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.FOURNISSEURS, executor);
  if (!compte401) {
    throw new Error('Le compte fournisseur collectif 401 est requis pour comptabiliser un paiement fournisseur.');
  }
  const compteTresorerie = await getCompteTresorerie(entrepriseId, modePaiement, compteBancaireId, executor);

  const ecrituresLignes = [];

  ecrituresLignes.push({
    compteComptableId: compte401.id,
    debit: montant,
    credit: 0,
    libelle: `Règlement ${fournisseurNom}`
  });

  if (compteTresorerie) {
    ecrituresLignes.push({
      compteComptableId: compteTresorerie.id,
      debit: 0,
      credit: montant,
      libelle: `Décaissement ${modePaiement} - ${reference}`
    });
  }

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables pour créer écriture paiement fournisseur');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode,
    journalNom,
    journalType: modePaiement === 'especes' ? 'caisse' : 'banque',
    dateEcriture: datePaiement,
    libelle: `Paiement ${fournisseurNom} - ${reference}`,
    numeroPiece: reference,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcriturePaiementClient(params) {
  const {
    entrepriseId,
    reference,
    datePaiement,
    clientNom,
    clientCompteId,
    montant,
    modePaiement,
    compteBancaireId,
    executor = db
  } = params;

  const journalCode = modePaiement === 'especes' ? JOURNAL_CODES.CAISSE : JOURNAL_CODES.BANQUE;
  const journalNom = modePaiement === 'especes' ? 'Journal de Caisse' : 'Journal de Banque';

  const compte411 = clientCompteId ? await getCompteById(clientCompteId, executor) : await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.CLIENTS, executor);
  const compteTresorerie = await getCompteTresorerie(entrepriseId, modePaiement, compteBancaireId, executor);

  const ecrituresLignes = [];

  if (compteTresorerie) {
    ecrituresLignes.push({
      compteComptableId: compteTresorerie.id,
      debit: montant,
      credit: 0,
      libelle: `Encaissement ${modePaiement} - ${reference}`
    });
  }

  if (compte411) {
    ecrituresLignes.push({
      compteComptableId: compte411.id,
      debit: 0,
      credit: montant,
      libelle: `Règlement ${clientNom}`
    });
  }

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables pour créer écriture paiement client');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode,
    journalNom,
    journalType: modePaiement === 'especes' ? 'caisse' : 'banque',
    dateEcriture: datePaiement,
    libelle: `Encaissement ${clientNom} - ${reference}`,
    numeroPiece: reference,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcritureChargeNoteFrais({
  entrepriseId,
  depenseId,
  dateDepense,
  description,
  montant,
  compteChargeId,
  executor = db,
}) {
  const tenantId = Number(entrepriseId);
  const [chargeAccount] = await executor.select().from(comptesComptables).where(and(
    eq(comptesComptables.id, Number(compteChargeId)),
    eq(comptesComptables.entrepriseId, tenantId),
    eq(comptesComptables.actif, true),
  )).limit(1);
  // Les notes de frais d’un salarié sont une dette envers le personnel; les factures fournisseurs utilisent le compte collectif 401.
  const [employeeAdvanceAccount] = await executor.select().from(comptesComptables).where(and(
    eq(comptesComptables.entrepriseId, tenantId),
    eq(comptesComptables.numero, COMPTES_SYSCOHADA.PERSONNEL_AVANCES),
    eq(comptesComptables.actif, true),
  )).limit(1);

  if (!chargeAccount || !String(chargeAccount.numero).startsWith('6')) {
    throw Object.assign(new Error('La catégorie doit être liée à un compte de charge actif de classe 6.'), { status: 400 });
  }
  if (!employeeAdvanceAccount) {
    throw Object.assign(new Error('Le compte d’avances au personnel (421) est requis pour comptabiliser cette dépense.'), { status: 400 });
  }

  const reference = `DEP-${Number(depenseId)}`;
  const [existing] = await executor.select().from(ecritures).where(and(
    eq(ecritures.entrepriseId, tenantId),
    eq(ecritures.numeroPiece, reference),
  )).limit(1);
  if (existing) {
    throw Object.assign(new Error('Une écriture existe déjà pour cette dépense; vérifiez son historique avant de poursuivre.'), { status: 409 });
  }

  const amount = Number(montant);
  const lignes = [
    {
      compteComptableId: chargeAccount.id,
      debit: amount,
      credit: 0,
      libelle: description,
    },
    {
      compteComptableId: employeeAdvanceAccount.id,
      debit: 0,
      credit: amount,
      libelle: 'Dette envers l’employé pour dépense approuvée',
    },
  ];
  const ecriture = await createEcritureComptable({
    entrepriseId: tenantId,
    journalCode: JOURNAL_CODES.OD,
    journalNom: 'Journal des opérations diverses',
    journalType: 'OD',
    dateEcriture: new Date(dateDepense),
    libelle: `Charge approuvée - ${description}`,
    numeroPiece: reference,
    lignes,
    valide: true,
    executor,
  });

  return { ecriture, lignes };
}

export async function createEcritureDepense(params) {
  const {
    entrepriseId,
    reference,
    dateRemboursement,
    employeNom,
    description,
    montant,
    modePaiement,
    categorieCompte,
    executor = db
  } = params;

  const journalCode = modePaiement === 'especes' ? JOURNAL_CODES.CAISSE : JOURNAL_CODES.BANQUE;
  const journalNom = modePaiement === 'especes' ? 'Journal de Caisse' : 'Journal de Banque';

  // Pour le remboursement d'une dépense employé:
  // - On débite le compte Personnel - Avances (421) pour solder l'avance faite par l'employé
  // - On crédite la trésorerie (52 ou 57) pour le décaissement
  // Note: La charge a déjà été comptabilisée lors de l'approbation de la dépense
  const compteAvance = await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.PERSONNEL_AVANCES, executor);
  const compteTresorerie = modePaiement === 'especes' 
    ? await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.CAISSE, executor)
    : await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.BANQUE, executor);

  const ecrituresLignes = [];

  if (compteAvance) {
    ecrituresLignes.push({
      compteComptableId: compteAvance.id,
      debit: montant,
      credit: 0,
      libelle: `Remboursement avance ${employeNom}`
    });
  }

  if (compteTresorerie) {
    ecrituresLignes.push({
      compteComptableId: compteTresorerie.id,
      debit: 0,
      credit: montant,
      libelle: `Décaissement remboursement ${employeNom}`
    });
  }

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables pour créer écriture dépense');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode,
    journalNom,
    journalType: modePaiement === 'especes' ? 'caisse' : 'banque',
    dateEcriture: dateRemboursement,
    libelle: `Remboursement dépense ${employeNom} - ${description}`,
    numeroPiece: reference,
    lignes: ecrituresLignes,
    valide: false,
    executor
  });
}

export async function createEcriturePaiementImpot(params) {
  const {
    entrepriseId,
    reference,
    datePaiement,
    typeImpot,
    montant,
    periode,
    modePaiement = 'virement'
  } = params;

  const journalCode = modePaiement === 'especes' ? JOURNAL_CODES.CAISSE : JOURNAL_CODES.BANQUE;
  const journalNom = modePaiement === 'especes' ? 'Journal de Caisse' : 'Journal de Banque';

  // Pour TVA: débiter le compte 4434 (TVA due à l'État) pour solder la dette fiscale
  // Pour autres impôts: débiter le compte 44 (État et collectivités)
  const compteImpot = typeImpot === 'tva' 
    ? await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.ETAT_TVA_DUE)
    : await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.ETAT_IMPOTS);
  
  const compteTresorerie = modePaiement === 'especes' 
    ? await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.CAISSE)
    : await getCompteByNumero(entrepriseId, COMPTES_SYSCOHADA.BANQUE);

  const ecrituresLignes = [];

  if (compteImpot) {
    ecrituresLignes.push({
      compteComptableId: compteImpot.id,
      debit: montant,
      credit: 0,
      libelle: `Paiement ${typeImpot.toUpperCase()} ${periode}`
    });
  }

  if (compteTresorerie) {
    ecrituresLignes.push({
      compteComptableId: compteTresorerie.id,
      debit: 0,
      credit: montant,
      libelle: `Règlement impôt ${typeImpot.toUpperCase()}`
    });
  }

  if (ecrituresLignes.length < 2) {
    console.warn('Pas assez de comptes comptables pour créer écriture paiement impôt');
    return null;
  }

  return createEcritureComptable({
    entrepriseId,
    journalCode,
    journalNom,
    journalType: modePaiement === 'especes' ? 'caisse' : 'banque',
    dateEcriture: datePaiement,
    libelle: `Paiement ${typeImpot.toUpperCase()} - ${periode}`,
    numeroPiece: reference,
    lignes: ecrituresLignes,
    valide: false
  });
}

export default {
  JOURNAL_CODES,
  COMPTES_SYSCOHADA,
  getOrCreateJournal,
  getCompteByNumero,
  createEcritureComptable,
  createEcritureReception,
  createEcritureFactureAchat,
  createEcritureFactureVente,
  createEcriturePaiementFournisseur,
  createEcriturePaiementClient,
  createEcritureDepense,
  createEcriturePaiementImpot
};
