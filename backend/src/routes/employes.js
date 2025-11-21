import express from 'express';
import db from '../db.js';
import { employes, avancesSalaire, absences, notificationsRH, documentsEmployes, auditLogs, users } from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';

const router = express.Router();

// ==========================================
// CRUD EMPLOYÉS
// ==========================================

router.post('/create', async (req, res) => {
  try {
    const { entrepriseId, nom, prenom, email, telephone, dateEmbauche, poste, departement, salaire, userId, ipAddress } = req.body;
    
    const employe = await db.insert(employes).values({
      entrepriseId: parseInt(entrepriseId),
      userId: userId ? parseInt(userId) : null,
      nom,
      prenom,
      email,
      telephone,
      dateEmbauche: new Date(dateEmbauche),
      poste,
      departement,
      salaire: parseFloat(salaire),
      statut: 'actif'
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'employes',
      recordId: employe[0].id,
      description: `Employé créé: ${prenom} ${nom}`,
      ipAddress
    });

    res.json(employe[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const employeList = await db.query.employes.findMany({
      where: eq(employes.entrepriseId, parseInt(entrepriseId))
    });
    res.json(employeList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const employe = await db.query.employes.findFirst({
      where: eq(employes.id, parseInt(id))
    });
    res.json(employe);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, poste, departement, salaire, statut, userId, ipAddress } = req.body;

    const updated = await db.update(employes).set({
      nom,
      prenom,
      email,
      poste,
      departement,
      salaire: salaire ? parseFloat(salaire) : undefined,
      statut
    }).where(eq(employes.id, parseInt(id))).returning();

    await db.insert(auditLogs).values({
      userId,
      action: 'UPDATE',
      table: 'employes',
      recordId: parseInt(id),
      description: `Employé modifié: ${prenom} ${nom}`,
      ipAddress
    });

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GESTION DES RÔLES & PERMISSIONS
// ==========================================

router.post('/:id/roles', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body; // admin, manager, accountant, employee, viewer

    const updated = await db.update(employes).set({
      role
    }).where(eq(employes.id, parseInt(id))).returning();

    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// DOCUMENTS EMPLOYÉS
// ==========================================

router.post('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { entrepriseId, type, url, description, userId } = req.body;

    const doc = await db.insert(documentsEmployes).values({
      entrepriseId: parseInt(entrepriseId),
      employeId: parseInt(id),
      type, // contrat, diplôme, bulletin, etc.
      url,
      description,
      dateUpload: new Date()
    }).returning();

    res.json(doc[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const docs = await db.query.documentsEmployes.findMany({
      where: eq(documentsEmployes.employeId, parseInt(id))
    });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// AVANCES SUR SALAIRE
// ==========================================

router.post('/avances/create', async (req, res) => {
  try {
    const { entrepriseId, employeId, montant, dateAvance, raison, userId, ipAddress } = req.body;

    const avance = await db.insert(avancesSalaire).values({
      entrepriseId: parseInt(entrepriseId),
      employeId: parseInt(employeId),
      montant: parseFloat(montant),
      dateAvance: new Date(dateAvance),
      raison,
      statut: 'en_attente',
      montantRembourse: 0
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'avances_salaire',
      recordId: avance[0].id,
      description: `Avance sur salaire: ${montant} FCFA`,
      ipAddress
    });

    res.json(avance[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/avances/list', async (req, res) => {
  try {
    const { entrepriseId, employeId } = req.query;
    const where = [eq(avancesSalaire.entrepriseId, parseInt(entrepriseId))];
    if (employeId) where.push(eq(avancesSalaire.employeId, parseInt(employeId)));

    const avancesList = await db.query.avancesSalaire.findMany({
      where: and(...where)
    });
    res.json(avancesList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/avances/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, userId } = req.body;

    const avance = await db.update(avancesSalaire).set({
      statut: approved ? 'approuvée' : 'rejetée'
    }).where(eq(avancesSalaire.id, parseInt(id))).returning();

    res.json(avance[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// ABSENCES
// ==========================================

router.post('/absences/create', async (req, res) => {
  try {
    const { entrepriseId, employeId, typeAbsence, dateDebut, dateFin, motif, userId, ipAddress } = req.body;

    const absence = await db.insert(absences).values({
      entrepriseId: parseInt(entrepriseId),
      employeId: parseInt(employeId),
      typeAbsence, // congé, maladie, absent_non_justifié, etc.
      dateDebut: new Date(dateDebut),
      dateFin: new Date(dateFin),
      motif,
      statut: 'en_attente'
    }).returning();

    await db.insert(auditLogs).values({
      entrepriseId: parseInt(entrepriseId),
      userId,
      action: 'CREATE',
      table: 'absences',
      recordId: absence[0].id,
      description: `Absence enregistrée: ${typeAbsence}`,
      ipAddress
    });

    res.json(absence[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/absences/list', async (req, res) => {
  try {
    const { entrepriseId, employeId } = req.query;
    const where = [eq(absences.entrepriseId, parseInt(entrepriseId))];
    if (employeId) where.push(eq(absences.employeId, parseInt(employeId)));

    const absencesList = await db.query.absences.findMany({
      where: and(...where),
      orderBy: desc(absences.dateDebut)
    });
    res.json(absencesList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/absences/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved } = req.body;

    const absence = await db.update(absences).set({
      statut: approved ? 'approuvée' : 'rejetée'
    }).where(eq(absences.id, parseInt(id))).returning();

    res.json(absence[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// NOTIFICATIONS RH
// ==========================================

router.post('/notifications/create', async (req, res) => {
  try {
    const { entrepriseId, employeId, type, message, userId } = req.body;

    const notif = await db.insert(notificationsRH).values({
      entrepriseId: parseInt(entrepriseId),
      employeId: employeId ? parseInt(employeId) : null,
      type, // alert_absence, anniversary, etc.
      message,
      lue: false,
      createdAt: new Date()
    }).returning();

    res.json(notif[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/notifications/list', async (req, res) => {
  try {
    const { entrepriseId } = req.query;
    const notifications = await db.query.notificationsRH.findMany({
      where: eq(notificationsRH.entrepriseId, parseInt(entrepriseId)),
      orderBy: desc(notificationsRH.createdAt)
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await db.update(notificationsRH).set({
      lue: true
    }).where(eq(notificationsRH.id, parseInt(id))).returning();

    res.json(notif[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// EXPORT
// ==========================================

router.get('/export', async (req, res) => {
  try {
    const { entrepriseId, format = 'json' } = req.query;

    const employeList = await db.query.employes.findMany({
      where: eq(employes.entrepriseId, parseInt(entrepriseId))
    });

    if (format === 'csv') {
      const headers = 'Nom,Prénom,Email,Poste,Département,Salaire,Statut\n';
      const rows = employeList.map(e =>
        `"${e.nom}","${e.prenom}","${e.email}","${e.poste}","${e.departement}","${e.salaire}","${e.statut}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="employes.csv"');
      res.send(headers + rows);
    } else {
      res.json(employeList);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
