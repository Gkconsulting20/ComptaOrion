import express from 'express';
import { db } from '../db.js';
import { 
  ecrituresRecurrentes, 
  histoGeneration, 
  parametresComptables,
  journaux,
  comptesComptables,
  ecritures,
  lignesEcritures
} from '../schema.js';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { generateNumeroEcriture } from '../services/comptabiliteService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const recurrentes = await db.select({
      ecriture: ecrituresRecurrentes,
      journal: journaux
    })
    .from(ecrituresRecurrentes)
    .leftJoin(journaux, eq(ecrituresRecurrentes.journalId, journaux.id))
    .where(eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId))
    .orderBy(sql`${ecrituresRecurrentes.nom} ASC`);

    res.json(recurrentes.map(r => ({
      ...r.ecriture,
      journal: r.journal
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [recurrente] = await db.select()
      .from(ecrituresRecurrentes)
      .where(and(
        eq(ecrituresRecurrentes.id, parseInt(req.params.id)),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!recurrente) {
      return res.status(404).json({ error: 'Écriture récurrente introuvable' });
    }

    res.json(recurrente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calculerProchaineDateGeneration(dateDebut, frequence, jourDuMois, moisDebut) {
  const now = new Date();
  let prochaine = new Date(dateDebut);

  while (prochaine <= now) {
    switch (frequence) {
      case 'mensuel':
        prochaine.setMonth(prochaine.getMonth() + 1);
        break;
      case 'trimestriel':
        prochaine.setMonth(prochaine.getMonth() + 3);
        break;
      case 'semestriel':
        prochaine.setMonth(prochaine.getMonth() + 6);
        break;
      case 'annuel':
        prochaine.setFullYear(prochaine.getFullYear() + 1);
        break;
    }
  }

  prochaine.setDate(jourDuMois || 1);
  return prochaine.toISOString().split('T')[0];
}

router.post('/', async (req, res) => {
  try {
    const {
      journalId,
      nom,
      description,
      frequence,
      jourDuMois,
      moisDebut,
      dateDebut,
      dateFin,
      montantReference,
      lignesModele
    } = req.body;

    if (!nom || !journalId || !frequence || !dateDebut || !lignesModele || lignesModele.length === 0) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }

    let totalDebit = 0;
    let totalCredit = 0;
    lignesModele.forEach(ligne => {
      const montant = parseFloat(ligne.montant);
      if (ligne.type === 'debit') {
        totalDebit += montant;
      } else {
        totalCredit += montant;
      }
    });

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ 
        error: 'Les lignes doivent être équilibrées (total débit = total crédit)' 
      });
    }

    const prochaineDateGeneration = calculerProchaineDateGeneration(
      dateDebut, frequence, jourDuMois, moisDebut
    );

    const nouvelleRecurrente = await db.transaction(async (tx) => {
      const [created] = await tx.insert(ecrituresRecurrentes).values({
        entrepriseId: req.entrepriseId,
        journalId,
        nom,
        description,
        frequence,
        jourDuMois: jourDuMois || 1,
        moisDebut: moisDebut || 1,
        dateDebut,
        dateFin,
        montantReference,
        lignesModele: JSON.stringify(lignesModele),
        prochaineDateGeneration,
        actif: true
      }).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'ecritures_recurrentes',
        recordId: created.id,
        nouvelleValeur: created,
        description: `Modèle d’écriture récurrente créé: ${created.nom}`,
        executor: tx,
        required: true
      });
      return created;
    });

    res.json(nouvelleRecurrente);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      journalId,
      nom,
      description,
      frequence,
      jourDuMois,
      moisDebut,
      dateDebut,
      dateFin,
      montantReference,
      lignesModele,
      actif
    } = req.body;

    if (lignesModele && lignesModele.length > 0) {
      let totalDebit = 0;
      let totalCredit = 0;
      lignesModele.forEach(ligne => {
        const montant = parseFloat(ligne.montant);
        if (ligne.type === 'debit') {
          totalDebit += montant;
        } else {
          totalCredit += montant;
        }
      });

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ 
          error: 'Les lignes doivent être équilibrées (total débit = total crédit)' 
        });
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [existe] = await tx.select().from(ecrituresRecurrentes).where(and(
        eq(ecrituresRecurrentes.id, parseInt(id)),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!existe) return null;
      const [current] = await tx.update(ecrituresRecurrentes).set({
        journalId,
        nom,
        description,
        frequence,
        jourDuMois,
        moisDebut,
        dateDebut,
        dateFin,
        montantReference,
        lignesModele: lignesModele ? JSON.stringify(lignesModele) : undefined,
        actif,
        updatedAt: new Date()
      }).where(and(
        eq(ecrituresRecurrentes.id, existe.id),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'ecritures_recurrentes',
        recordId: current.id,
        ancienneValeur: existe,
        nouvelleValeur: current,
        description: `Modèle d’écriture récurrente modifié: ${current.nom}`,
        executor: tx,
        required: true
      });
      return current;
    });
    if (!updated) return res.status(404).json({ error: 'Écriture récurrente introuvable' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await db.transaction(async (tx) => {
      const [existe] = await tx.select().from(ecrituresRecurrentes).where(and(
        eq(ecrituresRecurrentes.id, parseInt(id)),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!existe) return false;
      await logAudit({
        ...extractAuditInfo(req),
        action: 'DELETE',
        table: 'ecritures_recurrentes',
        recordId: existe.id,
        ancienneValeur: existe,
        description: `Modèle d’écriture récurrente supprimé: ${existe.nom}`,
        executor: tx,
        required: true
      });
      await tx.delete(ecrituresRecurrentes).where(and(
        eq(ecrituresRecurrentes.id, existe.id),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      ));
      return true;
    });
    if (!deleted) return res.status(404).json({ error: 'Écriture récurrente introuvable' });

    res.json({ message: 'Écriture récurrente supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/generer', async (req, res) => {
  try {
    const { id } = req.params;
    const { dateEcriture } = req.body;

    const [recurrente] = await db.select()
      .from(ecrituresRecurrentes)
      .where(and(
        eq(ecrituresRecurrentes.id, parseInt(id)),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      ))
      .limit(1);

    if (!recurrente) {
      return res.status(404).json({ error: 'Écriture récurrente introuvable' });
    }

    if (!recurrente.actif) {
      return res.status(400).json({ error: 'Écriture récurrente inactive' });
    }

    const lignes = typeof recurrente.lignesModele === 'string' 
      ? JSON.parse(recurrente.lignesModele) 
      : recurrente.lignesModele;

    for (const ligne of lignes) {
      const [compte] = await db.select()
        .from(comptesComptables)
        .where(and(
          eq(comptesComptables.id, ligne.compteId),
          eq(comptesComptables.entrepriseId, req.entrepriseId)
        ))
        .limit(1);
      
      if (!compte) {
        return res.status(400).json({ 
          error: `Le compte ${ligne.compteId} n'appartient pas à cette entreprise` 
        });
      }
    }

    let totalDebit = 0;
    let totalCredit = 0;
    lignes.forEach(ligne => {
      const montant = parseFloat(ligne.montant);
      if (ligne.type === 'debit') {
        totalDebit += montant;
      } else {
        totalCredit += montant;
      }
    });

    const dateGeneration = dateEcriture || new Date().toISOString().split('T')[0];
    const generation = await db.transaction(async (tx) => {
      const [lockedRecurrence] = await tx.select().from(ecrituresRecurrentes).where(and(
        eq(ecrituresRecurrentes.id, recurrente.id),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      )).for('update').limit(1);
      if (!lockedRecurrence || !lockedRecurrence.actif) {
        throw Object.assign(new Error('Écriture récurrente introuvable ou inactive'), { status: 409 });
      }
      const [journal] = await tx.select().from(journaux).where(and(
        eq(journaux.id, lockedRecurrence.journalId),
        eq(journaux.entrepriseId, req.entrepriseId)
      )).limit(1);
      if (!journal) throw Object.assign(new Error('Journal récurrent introuvable'), { status: 400 });
      const numeroEcriture = await generateNumeroEcriture(
        req.entrepriseId,
        journal,
        dateGeneration,
        tx
      );
      const [nouvelleEcriture] = await tx.insert(ecritures).values({
        entrepriseId: req.entrepriseId,
        journalId: lockedRecurrence.journalId,
        numeroEcriture,
        dateEcriture: dateGeneration,
        reference: `REC-${lockedRecurrence.id}-${Date.now()}`,
        description: `${lockedRecurrence.nom} - ${lockedRecurrence.description || ''}`,
        statut: 'brouillon',
        totalDebit: totalDebit.toString(),
        totalCredit: totalCredit.toString()
      }).returning();

      const insertedLines = [];
    for (const ligne of lignes) {
        const [inserted] = await tx.insert(lignesEcritures)
        .values({
          entrepriseId: req.entrepriseId,
          ecritureId: nouvelleEcriture.id,
          compteId: ligne.compteId,
          montant: ligne.montant.toString(),
          type: ligne.type,
          description: ligne.description
        }).returning();
        insertedLines.push(inserted);
      }

      const [history] = await tx.insert(histoGeneration)
      .values({
        entrepriseId: req.entrepriseId,
        ecritureRecurrenteId: lockedRecurrence.id,
        ecritureId: nouvelleEcriture.id,
        dateEcriture: dateGeneration,
        statut: 'generee'
      }).returning();

      const prochaineDateGeneration = calculerProchaineDateGeneration(
        dateGeneration,
        lockedRecurrence.frequence,
        lockedRecurrence.jourDuMois,
        lockedRecurrence.moisDebut
      );

      const [updatedRecurrence] = await tx.update(ecrituresRecurrentes)
      .set({
        derniereDateGeneration: dateGeneration,
        prochaineDateGeneration,
        updatedAt: new Date()
      })
      .where(and(
        eq(ecrituresRecurrentes.id, lockedRecurrence.id),
        eq(ecrituresRecurrentes.entrepriseId, req.entrepriseId)
      )).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'CREATE',
        table: 'ecritures',
        recordId: nouvelleEcriture.id,
        nouvelleValeur: { ecriture: nouvelleEcriture, lignes: insertedLines, modeleId: lockedRecurrence.id, generation: history },
        description: `Écriture générée depuis le modèle récurrent ${lockedRecurrence.nom}`,
        executor: tx,
        required: true
      });
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'ecritures_recurrentes',
        recordId: updatedRecurrence.id,
        ancienneValeur: lockedRecurrence,
        nouvelleValeur: updatedRecurrence,
        description: `Prochaine date de génération mise à jour pour ${lockedRecurrence.nom}`,
        executor: tx,
        required: true
      });
      return nouvelleEcriture;
    });

    res.json({ 
      message: 'Écriture générée avec succès',
      ecriture: generation
    });
  } catch (err) {
    await db.insert(histoGeneration)
      .values({
        entrepriseId: req.entrepriseId,
        ecritureRecurrenteId: parseInt(req.params.id),
        dateEcriture: req.body.dateEcriture || new Date().toISOString().split('T')[0],
        statut: 'echouee',
        messageErreur: err.message
      })
      .catch(() => {});
    
    res.status(500).json({ error: err.message });
  }
});

router.get('/parametres/comptables', async (req, res) => {
  try {
    const [params] = await db.select()
      .from(parametresComptables)
      .where(eq(parametresComptables.entrepriseId, req.entrepriseId))
      .limit(1);

    if (!params) {
      const nouveauParams = await db.transaction(async (tx) => {
        const [created] = await tx.insert(parametresComptables)
          .values({ entrepriseId: req.entrepriseId })
          .returning();
        await logAudit({
          ...extractAuditInfo(req),
          action: 'CREATE',
          table: 'parametres_comptables',
          recordId: created.id,
          nouvelleValeur: created,
          description: 'Paramètres comptables par défaut initialisés',
          executor: tx,
          required: true
        });
        return created;
      });
      
      return res.json(nouveauParams);
    }

    res.json(params);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/parametres/comptables', async (req, res) => {
  try {
    const {
      prefixeEcritures,
      numeroSuivantEcriture,
      formatNumeroEcriture,
      validationAutomatique,
      toleranceDesequilibre,
      bloquerSiDesequilibre,
      clotureDateLimite,
      exerciceCourant,
      afficherSoldesComptes,
      afficherCodeComplet,
      archiverApresNJours
    } = req.body;

    const result = await db.transaction(async (tx) => {
      const [existe] = await tx.select().from(parametresComptables)
        .where(eq(parametresComptables.entrepriseId, req.entrepriseId))
        .for('update').limit(1);
      const data = {
          entrepriseId: req.entrepriseId,
          prefixeEcritures,
          numeroSuivantEcriture,
          formatNumeroEcriture,
          validationAutomatique,
          toleranceDesequilibre,
          bloquerSiDesequilibre,
          clotureDateLimite,
          exerciceCourant,
          afficherSoldesComptes,
          afficherCodeComplet,
          archiverApresNJours
      };
      const [current] = existe
        ? await tx.update(parametresComptables).set({ ...data, updatedAt: new Date() })
            .where(eq(parametresComptables.entrepriseId, req.entrepriseId)).returning()
        : await tx.insert(parametresComptables).values(data).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: existe ? 'UPDATE' : 'CREATE',
        table: 'parametres_comptables',
        recordId: current.id,
        ancienneValeur: existe || undefined,
        nouvelleValeur: current,
        description: 'Paramètres comptables modifiés',
        executor: tx,
        required: true
      });
      return current;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/historique', async (req, res) => {
  try {
    const { id } = req.params;

    const historique = await db.select()
      .from(histoGeneration)
      .where(and(
        eq(histoGeneration.ecritureRecurrenteId, parseInt(id)),
        eq(histoGeneration.entrepriseId, req.entrepriseId)
      ))
      .orderBy(sql`${histoGeneration.dateGeneration} DESC`)
      .limit(50);

    res.json(historique);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
