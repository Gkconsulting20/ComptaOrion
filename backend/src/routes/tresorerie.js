import { Router } from 'express';
import { db } from '../db.js';
import { transactionsTresorerie, comptesBancaires, factures, facturesAchat, employes, comptesComptables, rapprochementsBancaires } from '../schema.js';
import { eq, and, like, inArray, or, ne, notInArray, between, sql } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = Router();

// GET solde caisse + banque avec solde initial
router.get('/comptes', async (req, res) => {
  try {
    const comptes = await db.select().from(comptesBancaires)
      .where(eq(comptesBancaires.entrepriseId, req.entrepriseId));
    
    const comptesAvecMouvements = await Promise.all(comptes.map(async (compte) => {
      const mouvements = await db.select().from(transactionsTresorerie)
        .where(and(
          eq(transactionsTresorerie.compteBancaireId, compte.id),
          eq(transactionsTresorerie.entrepriseId, req.entrepriseId)
        ));
      
      let soldeCalcule = parseFloat(compte.soldeInitial || 0);
      mouvements.forEach(m => {
        if (m.type === 'encaissement') {
          soldeCalcule += parseFloat(m.montant || 0);
        } else if (m.type === 'decaissement') {
          soldeCalcule -= parseFloat(m.montant || 0);
        }
      });
      
      return {
        ...compte,
        soldeInitial: parseFloat(compte.soldeInitial || 0),
        soldeActuel: soldeCalcule,
        mouvementsCount: mouvements.length
      };
    }));
    
    res.json(comptesAvecMouvements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET mouvements trésorerie par catégorie
router.get('/mouvements', async (req, res) => {
  try {
    const mouvements = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.entrepriseId, req.entrepriseId));
    res.json(mouvements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET encaissements
router.get('/encaissements', async (req, res) => {
  try {
    const encaissements = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        eq(transactionsTresorerie.type, 'encaissement')
      ));
    
    const total = encaissements.reduce((sum, e) => sum + parseFloat(e.montant || 0), 0);
    res.json({ encaissements, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET décaissements
router.get('/decaissements', async (req, res) => {
  try {
    const decaissements = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        eq(transactionsTresorerie.type, 'decaissement')
      ));
    
    const total = decaissements.reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
    res.json({ decaissements, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET catégories de flux
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 1, nom: 'Ventes', icon: '💰', color: '#28a745' },
      { id: 2, nom: 'Charges', icon: '💸', color: '#dc3545' },
      { id: 3, nom: 'Salaires', icon: '👨‍💼', color: '#007bff' },
      { id: 4, nom: 'Taxes', icon: '🏛️', color: '#ffc107' },
      { id: 5, nom: 'Investissements', icon: '🏗️', color: '#6f42c1' },
      { id: 6, nom: 'Financement', icon: '🏦', color: '#17a2b8' }
    ];
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET prévisions: flux futurs, échéances fournisseur, factures à venir
router.get('/previsions', async (req, res) => {
  try {
    const { periode } = req.query;
    
    const joursProj = parseInt(periode) || 30;
    const dateAujourdhui = new Date();
    dateAujourdhui.setHours(0, 0, 0, 0);
    const dateLimite = new Date(dateAujourdhui);
    dateLimite.setDate(dateLimite.getDate() + joursProj);
    
    const comptesData = await db.select().from(comptesBancaires)
      .where(and(
        eq(comptesBancaires.entrepriseId, req.entrepriseId),
        eq(comptesBancaires.actif, true)
      ));
    
    const mouvementsData = await db.select().from(transactionsTresorerie)
      .where(eq(transactionsTresorerie.entrepriseId, req.entrepriseId));
    
    let soldeActuel = 0;
    comptesData.forEach(compte => {
      const mouvements = mouvementsData.filter(m => m.compteBancaireId === compte.id);
      let soldeCompte = parseFloat(compte.soldeInitial || 0);
      mouvements.forEach(m => {
        if (m.type === 'encaissement') {
          soldeCompte += parseFloat(m.montant || 0);
        } else if (m.type === 'decaissement') {
          soldeCompte -= parseFloat(m.montant || 0);
        }
      });
      soldeActuel += soldeCompte;
    });
    
    const facturesClients = await db.select().from(factures)
      .where(and(
        eq(factures.entrepriseId, req.entrepriseId),
        notInArray(factures.statut, ['payee', 'annulee', 'brouillon'])
      ));
    
    const totalCreances = facturesClients.reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
    
    const facturesFournisseurs = await db.select().from(facturesAchat)
      .where(and(
        eq(facturesAchat.entrepriseId, req.entrepriseId),
        notInArray(facturesAchat.statut, ['payee', 'annulee', 'brouillon'])
      ));
    
    const totalDettes = facturesFournisseurs.reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
    
    const soldePrevu = soldeActuel + totalCreances - totalDettes;
    
    const projectionParSemaine = [];
    const nbSemaines = Math.ceil(joursProj / 7);
    
    for (let semaine = 1; semaine <= nbSemaines; semaine++) {
      const debutSemaine = new Date(dateAujourdhui);
      debutSemaine.setDate(debutSemaine.getDate() + (semaine - 1) * 7);
      const finSemaine = new Date(debutSemaine);
      finSemaine.setDate(finSemaine.getDate() + 6);
      
      const encaissementsSemaine = facturesClients
        .filter(f => {
          if (!f.dateEcheance) return false;
          const echeance = new Date(f.dateEcheance);
          return echeance >= debutSemaine && echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const decaissementsSemaine = facturesFournisseurs
        .filter(f => {
          if (!f.dateEcheance) return false;
          const echeance = new Date(f.dateEcheance);
          return echeance >= debutSemaine && echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const encaissementsCumules = facturesClients
        .filter(f => {
          if (!f.dateEcheance) return true;
          const echeance = new Date(f.dateEcheance);
          return echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const decaissementsCumules = facturesFournisseurs
        .filter(f => {
          if (!f.dateEcheance) return true;
          const echeance = new Date(f.dateEcheance);
          return echeance <= finSemaine;
        })
        .reduce((sum, f) => sum + parseFloat(f.montantTTC || 0), 0);
      
      const soldeSemaine = soldeActuel + encaissementsCumules - decaissementsCumules;
      
      projectionParSemaine.push({
        semaine,
        periode: `Semaine ${semaine} (${debutSemaine.toLocaleDateString('fr-FR')} - ${finSemaine.toLocaleDateString('fr-FR')})`,
        encaissements: encaissementsSemaine,
        decaissements: decaissementsSemaine,
        soldePrevu: soldeSemaine
      });
    }
    
    res.json({
      soldeActuel,
      soldePrevu,
      periode: joursProj,
      creances: {
        total: totalCreances,
        count: facturesClients.length,
        factures: facturesClients.map(f => ({
          id: f.id,
          numero: f.numeroFacture,
          montant: parseFloat(f.montantTTC || 0),
          dateEcheance: f.dateEcheance,
          clientId: f.clientId
        }))
      },
      dettes: {
        total: totalDettes,
        count: facturesFournisseurs.length,
        factures: facturesFournisseurs.map(f => ({
          id: f.id,
          numero: f.numeroFacture,
          montant: parseFloat(f.montantTTC || 0),
          dateEcheance: f.dateEcheance,
          fournisseurId: f.fournisseurId
        }))
      },
      projection: projectionParSemaine,
      variation: soldePrevu - soldeActuel
    });
  } catch (err) {
    console.error('Erreur prévisions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST créer un compte bancaire
router.post('/comptes/create', async (req, res) => {
  try {
    const { nomCompte, numeroCompte, banque, soldeInitial, type, compteComptableId } = req.body;

    if (compteComptableId) {
      const compteExists = await db.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, parseInt(compteComptableId)),
          eq(comptesComptables.entrepriseId, req.entrepriseId)
        ))
        .limit(1);
      
      if (compteExists.length === 0) {
        return res.status(400).json({ 
          error: 'Le compte comptable sélectionné n\'appartient pas à votre entreprise' 
        });
      }
    }

    const newCompte = await db.transaction(async (tx) => {
      const [created] = await tx.insert(comptesBancaires).values({
        entrepriseId: req.entrepriseId,
        nomCompte,
        numeroCompte,
        banque,
        soldeInitial: soldeInitial || '0',
        soldeActuel: soldeInitial || '0',
        type: type || 'banque',
        compteComptableId: compteComptableId ? parseInt(compteComptableId) : null,
        actif: true
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'comptes_bancaires',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Compte de trésorerie créé: ${created.nomCompte}`,
        executor: tx,
        required: true
      });
      return created;
    });

    res.status(201).json(newCompte);
  } catch (err) {
    console.error('Erreur création compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier un compte bancaire
router.put('/comptes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nomCompte, numeroCompte, banque, type, compteComptableId, actif } = req.body;

    if (compteComptableId) {
      const compteExists = await db.select().from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, parseInt(compteComptableId)),
          eq(comptesComptables.entrepriseId, req.entrepriseId)
        ))
        .limit(1);
      
      if (compteExists.length === 0) {
        return res.status(400).json({ 
          error: 'Le compte comptable sélectionné n\'appartient pas à votre entreprise' 
        });
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(comptesBancaires).where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!previous) return null;
      const [current] = await tx.update(comptesBancaires).set({
        nomCompte,
        numeroCompte,
        banque,
        type,
        compteComptableId: compteComptableId ? parseInt(compteComptableId) : null,
        actif,
        updatedAt: new Date()
      }).where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'comptes_bancaires',
        recordId: current.id,
        ancienneValeur: previous,
        nouvelleValeur: current,
        description: `Compte de trésorerie modifié: ${current.nomCompte}`,
        executor: tx,
        required: true
      });
      return current;
    });

    if (!updated) return res.status(404).json({ error: 'Compte bancaire introuvable ou non autorisé' });
    res.json(updated);
  } catch (err) {
    console.error('Erreur modification compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer un compte bancaire
router.delete('/comptes/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.transaction(async (tx) => {
      const [account] = await tx.select().from(comptesBancaires).where(and(
        eq(comptesBancaires.id, parseInt(id)),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!account) return { status: 404, error: 'Compte bancaire introuvable ou non autorisé' };

      const [transaction] = await tx.select({ id: transactionsTresorerie.id }).from(transactionsTresorerie)
        .where(and(
          eq(transactionsTresorerie.compteBancaireId, parseInt(id)),
          eq(transactionsTresorerie.entrepriseId, req.entrepriseId)
        )).limit(1);
      if (transaction) {
        return { status: 400, error: 'Impossible de supprimer ce compte car il contient des transactions. Désactivez-le plutôt.' };
      }

      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'comptes_bancaires',
        recordId: account.id,
        ancienneValeur: account,
        description: `Compte de trésorerie supprimé: ${account.nomCompte}`,
        executor: tx,
        required: true
      });
      await tx.delete(comptesBancaires).where(and(
        eq(comptesBancaires.id, account.id),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      ));
      return { status: 200 };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (err) {
    console.error('Erreur suppression compte bancaire:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET comptes comptables classe 5 (trésorerie)
router.get('/comptes-comptables', async (req, res) => {
  try {
    const comptes = await db.select().from(comptesComptables)
      .where(and(
        eq(comptesComptables.entrepriseId, req.entrepriseId),
        like(comptesComptables.numero, '5%')
      ));
    
    res.json(comptes);
  } catch (err) {
    console.error('Erreur récupération comptes comptables:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// RAPPROCHEMENTS BANCAIRES
// ==========================================

// GET prévisualisation des opérations pour un rapprochement (avant création)
router.get('/rapprochements/preview', async (req, res) => {
  try {
    const { compteBancaireId, dateDebut, dateFin } = req.query;

    if (!compteBancaireId || !dateDebut || !dateFin) {
      return res.status(400).json({ error: 'compteBancaireId, dateDebut et dateFin sont requis' });
    }

    const compte = await db.select().from(comptesBancaires)
      .where(and(
        eq(comptesBancaires.id, parseInt(compteBancaireId)),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (compte.length === 0) {
      return res.status(404).json({ error: 'Compte bancaire non trouvé' });
    }

    const transactions = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.compteBancaireId, parseInt(compteBancaireId)),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        between(transactionsTresorerie.dateTransaction, dateDebut, dateFin)
      ))
      .orderBy(transactionsTresorerie.dateTransaction);

    let soldeComptable = parseFloat(compte[0].soldeInitial || 0);
    const toutesTransactions = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.compteBancaireId, parseInt(compteBancaireId)),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        sql`${transactionsTresorerie.dateTransaction} <= ${dateFin}`
      ));

    toutesTransactions.forEach(t => {
      if (t.type === 'encaissement') {
        soldeComptable += parseFloat(t.montant || 0);
      } else if (t.type === 'decaissement') {
        soldeComptable -= parseFloat(t.montant || 0);
      }
    });

    res.json({
      compte: compte[0],
      soldeComptable,
      transactionsCount: transactions.length,
      transactions: transactions.map(t => ({
        ...t,
        montant: parseFloat(t.montant || 0),
        type: t.type
      }))
    });
  } catch (err) {
    console.error('Erreur preview rapprochement:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET tous les rapprochements bancaires
router.get('/rapprochements', async (req, res) => {
  try {
    const rapprochements = await db
      .select({
        id: rapprochementsBancaires.id,
        compteBancaireId: rapprochementsBancaires.compteBancaireId,
        nomCompte: comptesBancaires.nomCompte,
        banque: comptesBancaires.banque,
        dateRapprochement: rapprochementsBancaires.dateRapprochement,
        dateDebut: rapprochementsBancaires.dateDebut,
        dateFin: rapprochementsBancaires.dateFin,
        soldeReleve: rapprochementsBancaires.soldeReleve,
        soldeComptable: rapprochementsBancaires.soldeComptable,
        ecart: rapprochementsBancaires.ecart,
        statut: rapprochementsBancaires.statut,
        notes: rapprochementsBancaires.notes,
        createdAt: rapprochementsBancaires.createdAt,
      })
      .from(rapprochementsBancaires)
      .leftJoin(comptesBancaires, eq(rapprochementsBancaires.compteBancaireId, comptesBancaires.id))
      .where(eq(rapprochementsBancaires.entrepriseId, req.entrepriseId))
      .orderBy(rapprochementsBancaires.createdAt);

    res.json(rapprochements);
  } catch (err) {
    console.error('Erreur récupération rapprochements:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST créer un nouveau rapprochement bancaire
router.post('/rapprochements', async (req, res) => {
  try {
    const { compteBancaireId, dateDebut, dateFin, soldeReleve, notes } = req.body;

    const created = await db.transaction(async (tx) => {
      const [account] = await tx.select().from(comptesBancaires).where(and(
        eq(comptesBancaires.id, parseInt(compteBancaireId)),
        eq(comptesBancaires.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!account) return { status: 404, error: 'Compte bancaire non trouvé' };

      const transactions = await tx.select().from(transactionsTresorerie).where(and(
        eq(transactionsTresorerie.compteBancaireId, parseInt(compteBancaireId)),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        between(transactionsTresorerie.dateTransaction, dateDebut, dateFin)
      ));
      let soldeComptable = parseFloat(account.soldeInitial || 0);
      const toutesTransactions = await tx.select().from(transactionsTresorerie).where(and(
        eq(transactionsTresorerie.compteBancaireId, parseInt(compteBancaireId)),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        sql`${transactionsTresorerie.dateTransaction} <= ${dateFin}`
      ));
      toutesTransactions.forEach((transaction) => {
        soldeComptable += transaction.type === 'encaissement'
          ? parseFloat(transaction.montant || 0)
          : -parseFloat(transaction.montant || 0);
      });

      const ecart = parseFloat(soldeReleve) - soldeComptable;
      const [rapprochement] = await tx.insert(rapprochementsBancaires).values({
        entrepriseId: req.entrepriseId,
        compteBancaireId: parseInt(compteBancaireId),
        dateDebut,
        dateFin,
        soldeReleve: soldeReleve.toString(),
        soldeComptable: soldeComptable.toString(),
        ecart: ecart.toString(),
        statut: Math.abs(ecart) < 0.01 ? 'valide' : 'en_cours',
        notes,
        userId: req.user?.id || req.userId || null,
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'rapprochements_bancaires',
        recordId: rapprochement.id,
        nouvelleValeur: rapprochement,
        description: `Rapprochement bancaire créé: compte ${account.nomCompte}`,
        executor: tx,
        required: true
      });
      return { rapprochement, transactionsCount: transactions.length };
    });

    if (created.status) return res.status(created.status).json({ error: created.error });
    res.status(201).json({ success: true, ...created });
  } catch (err) {
    console.error('Erreur création rapprochement:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET un rapprochement avec ses transactions
router.get('/rapprochements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [rapprochement] = await db
      .select()
      .from(rapprochementsBancaires)
      .where(and(
        eq(rapprochementsBancaires.id, parseInt(id)),
        eq(rapprochementsBancaires.entrepriseId, req.entrepriseId)
      ));

    if (!rapprochement) {
      return res.status(404).json({ error: 'Rapprochement non trouvé' });
    }

    // Récupérer toutes les transactions de la période
    const transactions = await db.select().from(transactionsTresorerie)
      .where(and(
        eq(transactionsTresorerie.compteBancaireId, rapprochement.compteBancaireId),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        between(transactionsTresorerie.dateTransaction, rapprochement.dateDebut, rapprochement.dateFin)
      ))
      .orderBy(transactionsTresorerie.dateTransaction);

    res.json({
      rapprochement,
      transactions: transactions.map(t => ({
        ...t,
        montant: parseFloat(t.montant || 0),
        rapproche: t.rapproche || false,
      }))
    });
  } catch (err) {
    console.error('Erreur récupération rapprochement:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT marquer une transaction comme rapprochée
router.put('/rapprochements/:id/transactions/:transactionId', async (req, res) => {
  try {
    const { id, transactionId } = req.params;
    const { rapproche } = req.body;
    if (typeof rapproche !== 'boolean') return res.status(400).json({ error: 'Le statut de rapprochement doit être booléen.' });
    const result = await db.transaction(async (tx) => {
      const [reconciliation] = await tx.select().from(rapprochementsBancaires).where(and(
        eq(rapprochementsBancaires.id, parseInt(id)),
        eq(rapprochementsBancaires.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!reconciliation) return { status: 404, error: 'Rapprochement non trouvé.' };

      const [previous] = await tx.select().from(transactionsTresorerie).where(and(
        eq(transactionsTresorerie.id, parseInt(transactionId)),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId),
        eq(transactionsTresorerie.compteBancaireId, reconciliation.compteBancaireId)
      )).for('update').limit(1);
      if (!previous) return { status: 404, error: 'Transaction non trouvée dans ce compte.' };

      const [updated] = await tx.update(transactionsTresorerie).set({
        rapproche,
        rapprochementId: rapproche ? parseInt(id) : null
      }).where(and(
        eq(transactionsTresorerie.id, previous.id),
        eq(transactionsTresorerie.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'transactions_tresorerie',
        recordId: updated.id,
        ancienneValeur: previous,
        nouvelleValeur: updated,
        description: `Transaction ${rapproche ? 'rapprochée' : 'déréconciliée'}`,
        executor: tx,
        required: true
      });
      return { status: 200 };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur mise à jour transaction:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT valider un rapprochement
router.put('/rapprochements/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(rapprochementsBancaires).where(and(
        eq(rapprochementsBancaires.id, parseInt(id)),
        eq(rapprochementsBancaires.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!previous) return null;
      const [current] = await tx.update(rapprochementsBancaires).set({
        statut: 'valide',
        updatedAt: new Date()
      }).where(and(
        eq(rapprochementsBancaires.id, previous.id),
        eq(rapprochementsBancaires.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'rapprochements_bancaires',
        recordId: current.id,
        ancienneValeur: previous,
        nouvelleValeur: current,
        description: `Rapprochement bancaire validé: ${current.id}`,
        executor: tx,
        required: true
      });
      return current;
    });
    if (!updated) return res.status(404).json({ error: 'Rapprochement non trouvé.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur validation rapprochement:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
