import express from 'express';
import multer from 'multer';
import { db } from '../db.js';
import { 
  importBatches, importRecords, importMappingTemplates,
  clients, fournisseurs, comptesComptables, produits
} from '../schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';
import { formatClientNumberFromId } from '../services/clientIdentity.js';
import { formatSupplierNumberFromId } from '../services/supplierIdentity.js';
import { parseCSV, parseExcel, parseIIF, parseLocalizedNumber } from '../services/dataImportParsers.js';
import { getPlanCapabilities } from '../services/planEntitlements.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const SUPPORTED_SOURCES = [
  { id: 'quickbooks', name: 'QuickBooks', formats: ['csv', 'xlsx', 'iif'] },
  { id: 'sage100', name: 'Sage 100', formats: ['csv', 'xlsx'] },
  { id: 'excel', name: 'Excel / CSV Générique', formats: ['csv', 'xlsx'] }
];

const ENTITY_TYPES = [
  { id: 'clients', name: 'Clients', champsRequis: ['nom'], champsOptionnels: ['email', 'telephone', 'adresse', 'ville', 'pays'] },
  { id: 'fournisseurs', name: 'Fournisseurs', champsRequis: ['raisonSociale'], champsOptionnels: ['email', 'telephone', 'adresse'] },
  { id: 'plan_comptable', name: 'Plan Comptable', champsRequis: ['numeroCompte', 'libelle'], champsOptionnels: ['typeCompte', 'classe'] },
  { id: 'produits', name: 'Produits/Services', champsRequis: ['nom'], champsOptionnels: ['description', 'prixVente', 'prixAchat', 'coutMoyen', 'reference', 'uniteMesure', 'poidsParUnite', 'unitePoids'] }
];
const AUDIT_TABLE_BY_ENTITY = {
  clients: 'clients',
  fournisseurs: 'fournisseurs',
  plan_comptable: 'comptes_comptables',
  produits: 'produits',
};

function inferAccountType(accountNumber, accountClass) {
  if (accountClass === 1) return 'capitaux';
  if ([2, 3, 5].includes(accountClass)) return 'actif';
  if (accountClass === 4) {
    if (/^40/.test(accountNumber)) return 'passif';
    if (/^41/.test(accountNumber)) return 'actif';
    throw new Error('Pour un compte de classe 4, indiquez son type (actif ou passif) dans le fichier.');
  }
  if (accountClass === 6 || accountClass === 8) return 'charge';
  if (accountClass === 7) return 'produit';
  return 'passif';
}

function normalizeAccountType(value, accountNumber, accountClass) {
  const aliases = {
    actif: 'actif',
    asset: 'actif',
    passif: 'passif',
    liability: 'passif',
    produit: 'produit',
    revenue: 'produit',
    charge: 'charge',
    expense: 'charge',
    capitaux: 'capitaux',
    equity: 'capitaux',
  };
  if (!value) return inferAccountType(accountNumber, accountClass);
  const normalized = aliases[String(value).trim().toLocaleLowerCase()];
  if (!normalized) throw new Error(`Type de compte non reconnu : « ${value} »`);
  return normalized;
}

router.get('/sources', (req, res) => {
  res.json({ success: true, data: SUPPORTED_SOURCES });
});

router.get('/entity-types', (req, res) => {
  res.json({ success: true, data: ENTITY_TYPES });
});

router.get('/batches', async (req, res) => {
  try {
    const batches = await db.select()
      .from(importBatches)
      .where(eq(importBatches.entrepriseId, req.entrepriseId))
      .orderBy(desc(importBatches.createdAt))
      .limit(50);
    
    res.json({ success: true, data: batches });
  } catch (error) {
    console.error('Erreur GET /api/import/batches:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier fourni' });
    }
    
    const { sourceLogiciel, typeEntite } = req.body;
    
    if (!sourceLogiciel || !typeEntite) {
      return res.status(400).json({ success: false, error: 'Source et type d\'entité requis' });
    }

    const source = SUPPORTED_SOURCES.find(item => item.id === sourceLogiciel);
    if (!source) {
      return res.status(400).json({ success: false, error: 'Logiciel source non supporté' });
    }
    if (!ENTITY_TYPES.some(item => item.id === typeEntite)) {
      return res.status(400).json({ success: false, error: 'Ce type de données n’est pas encore pris en charge par l’import' });
    }
    
    const fileName = req.file.originalname;
    const ext = fileName.split('.').pop().toLowerCase();
    if (!source.formats.includes(ext) || ext === 'xls') {
      return res.status(400).json({
        success: false,
        error: 'Format non pris en charge pour cette source. Utilisez CSV ou XLSX; les anciens fichiers XLS doivent être convertis en XLSX.'
      });
    }
    
    let parsed;
    try {
      if (ext === 'csv') {
        const delimiter = req.body.delimiter || undefined;
        parsed = parseCSV(req.file.buffer, delimiter);
      } else if (ext === 'xlsx') {
        parsed = await parseExcel(req.file.buffer);
      } else if (ext === 'iif') {
        parsed = parseIIF(req.file.buffer, typeEntite);
      }
    } catch (parseError) {
      return res.status(400).json({ success: false, error: parseError.message });
    }
    
    if (parsed.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Le fichier est vide ou n\'a pas pu être lu' });
    }
    
    const auditInfo = extractAuditInfo(req);
    const batch = await db.transaction(async tx => {
      const [createdBatch] = await tx.insert(importBatches).values({
        entrepriseId: req.entrepriseId,
        userId: req.userId,
        sourceLogiciel,
        formatFichier: ext,
        nomFichier: fileName,
        tailleFichier: req.file.size,
        typeEntite,
        nombreLignesTotal: parsed.rows.length,
        statut: 'brouillon'
      }).returning();

      const chunkSize = 250;
      for (let start = 0; start < parsed.rows.length; start += chunkSize) {
        await tx.insert(importRecords).values(parsed.rows.slice(start, start + chunkSize).map(row => ({
          batchId: createdBatch.id,
          ligneFichier: row.ligne,
          donneesOriginales: row.data,
          statut: 'en_attente'
        })));
      }

      await logAudit({
        ...auditInfo,
        action: 'IMPORT_UPLOAD',
        table: 'import_batches',
        recordId: createdBatch.id,
        newValues: { sourceLogiciel, typeEntite, nomFichier: fileName, lignes: parsed.rows.length },
        executor: tx,
        required: true
      });
      return createdBatch;
    });
    
    res.json({ 
      success: true, 
      data: {
        batchId: batch.id,
        headers: parsed.headers,
        previewRows: parsed.rows.slice(0, 10),
        totalRows: parsed.rows.length,
        allSections: parsed.allSections
      }
    });
  } catch (error) {
    console.error('Erreur POST /api/import/upload:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batch] = await db.select()
      .from(importBatches)
      .where(and(
        eq(importBatches.id, parseInt(id)),
        eq(importBatches.entrepriseId, req.entrepriseId)
      ));
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Import non trouvé' });
    }
    
    const records = await db.select()
      .from(importRecords)
      .where(eq(importRecords.batchId, parseInt(id)))
      .orderBy(importRecords.ligneFichier);
    
    const headers = records.length > 0 ? Object.keys(records[0].donneesOriginales) : [];
    
    res.json({ 
      success: true, 
      data: { 
        batch, 
        records: records.slice(0, 100),
        totalRecords: records.length,
        headers
      }
    });
  } catch (error) {
    console.error('Erreur GET /api/import/batches/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/mapping', async (req, res) => {
  try {
    const { id } = req.params;
    const { mappingColonnes, optionsImport } = req.body;
    
    const [batch] = await db.select()
      .from(importBatches)
      .where(and(
        eq(importBatches.id, parseInt(id)),
        eq(importBatches.entrepriseId, req.entrepriseId)
      ));
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Import non trouvé' });
    }
    
    await db.update(importBatches)
      .set({ 
        mappingColonnes: JSON.stringify(mappingColonnes),
        optionsImport: JSON.stringify(optionsImport || {}),
        updatedAt: new Date()
      })
      .where(eq(importBatches.id, parseInt(id)));
    
    res.json({ success: true, message: 'Mapping enregistré' });
  } catch (error) {
    console.error('Erreur POST /api/import/batches/:id/mapping:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batch] = await db.select()
      .from(importBatches)
      .where(and(
        eq(importBatches.id, parseInt(id)),
        eq(importBatches.entrepriseId, req.entrepriseId)
      ));
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Import non trouvé' });
    }
    
    if (!batch.mappingColonnes) {
      return res.status(400).json({ success: false, error: 'Le mapping des colonnes doit être configuré avant la validation' });
    }
    
    const mapping = typeof batch.mappingColonnes === 'string' 
      ? JSON.parse(batch.mappingColonnes) 
      : batch.mappingColonnes;
    
    const entityType = ENTITY_TYPES.find(e => e.id === batch.typeEntite);
    const champsRequis = entityType?.champsRequis || [];
    
    const records = await db.select()
      .from(importRecords)
      .where(eq(importRecords.batchId, parseInt(id)));
    
    let valides = 0;
    let erreurs = 0;
    
    for (const record of records) {
      const donnees = record.donneesOriginales;
      const donneesTransformees = {};
      const erreursValidation = [];
      
      for (const [colonneSource, champDest] of Object.entries(mapping)) {
        if (champDest && donnees[colonneSource] !== undefined) {
          donneesTransformees[champDest] = donnees[colonneSource];
        }
      }
      
      for (const champ of champsRequis) {
        if (donneesTransformees[champ] === undefined ||
            donneesTransformees[champ] === null ||
            String(donneesTransformees[champ]).trim() === '') {
          erreursValidation.push({ champ, message: `Le champ "${champ}" est requis` });
        }
      }

      if (donneesTransformees.email &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(donneesTransformees.email).trim())) {
        erreursValidation.push({ champ: 'email', message: 'Adresse e-mail invalide' });
      }

      if (batch.typeEntite === 'produits') {
        for (const champ of ['prixVente', 'prixAchat', 'coutMoyen', 'poidsParUnite']) {
          if (donneesTransformees[champ] === undefined || String(donneesTransformees[champ]).trim() === '') continue;
          try {
            const valeur = parseLocalizedNumber(donneesTransformees[champ]);
            if (valeur < 0 || (champ === 'poidsParUnite' && valeur === 0)) {
              throw new Error(champ === 'poidsParUnite' ? 'Le poids par unité doit être supérieur à zéro' : 'Le montant ne peut pas être négatif');
            }
          } catch (error) {
            erreursValidation.push({ champ, message: error.message });
          }
        }
      }

      if (batch.typeEntite === 'plan_comptable') {
        try {
          const classe = donneesTransformees.classe
            ? parseLocalizedNumber(donneesTransformees.classe)
            : parseInt(String(donneesTransformees.numeroCompte || '').charAt(0), 10);
          if (!Number.isInteger(classe) || classe < 1 || classe > 9) {
            erreursValidation.push({ champ: 'classe', message: 'La classe comptable doit être un entier de 1 à 9' });
          } else {
            normalizeAccountType(donneesTransformees.typeCompte, donneesTransformees.numeroCompte, classe);
          }
        } catch (error) {
          erreursValidation.push({ champ: 'typeCompte', message: error.message });
        }
      }
      
      const estValide = erreursValidation.length === 0;
      
      await db.update(importRecords)
        .set({
          donneesTransformees: JSON.stringify(donneesTransformees),
          erreursValidation: erreursValidation.length > 0 ? JSON.stringify(erreursValidation) : null,
          estValide,
          statut: estValide ? 'valide' : 'erreur'
        })
        .where(eq(importRecords.id, record.id));
      
      if (estValide) valides++;
      else erreurs++;
    }
    
    await db.update(importBatches)
      .set({
        nombreLignesValides: valides,
        nombreLignesErreurs: erreurs,
        statut: 'validation',
        updatedAt: new Date()
      })
      .where(eq(importBatches.id, parseInt(id)));
    
    res.json({ 
      success: true, 
      data: { valides, erreurs, total: records.length }
    });
  } catch (error) {
    console.error('Erreur POST /api/import/batches/:id/validate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batches/:id/commit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batch] = await db.select()
      .from(importBatches)
      .where(and(
        eq(importBatches.id, parseInt(id)),
        eq(importBatches.entrepriseId, req.entrepriseId)
      ));
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Import non trouvé' });
    }
    
    if (batch.statut !== 'validation') {
      return res.status(400).json({ success: false, error: 'L\'import doit être validé avant le commit' });
    }
    
    await db.update(importBatches)
      .set({ statut: 'en_cours', demarreAt: new Date() })
      .where(eq(importBatches.id, parseInt(id)));
    
    const records = await db.select()
      .from(importRecords)
      .where(and(
        eq(importRecords.batchId, parseInt(id)),
        eq(importRecords.estValide, true)
      ));
    
    let importes = 0;
    const errors = [];
    const auditInfo = extractAuditInfo(req);
    
    for (const record of records) {
      try {
        const donnees = typeof record.donneesTransformees === 'string'
          ? JSON.parse(record.donneesTransformees)
          : record.donneesTransformees;
        
        const entiteCreee = await db.transaction(async tx => {
          let created;

          switch (batch.typeEntite) {
            case 'clients': {
              [created] = await tx.insert(clients).values({
                entrepriseId: req.entrepriseId,
                numeroClient: null,
                compteComptableId: null,
                nom: donnees.nom,
                email: donnees.email || null,
                telephone: donnees.telephone || null,
                adresse: donnees.adresse || null,
                ville: donnees.ville || null,
                pays: donnees.pays || null
              }).returning();

              const codeAuxiliaire = formatClientNumberFromId(created.id);
              let numeroClient = codeAuxiliaire;
              let suffix = 0;
              while (suffix <= 100) {
                const [existing] = await tx.select({ id: clients.id })
                  .from(clients)
                  .where(eq(clients.numeroClient, numeroClient))
                  .limit(1);
                if (!existing) break;
                suffix += 1;
                if (suffix > 100) throw new Error('Impossible de générer un numéro client unique.');
                numeroClient = `${codeAuxiliaire}-${suffix}`;
              }

              const [saved] = await tx.update(clients)
                .set({ codeAuxiliaire, numeroClient })
                .where(eq(clients.id, created.id))
                .returning();
              created = saved;
              break;
            }

            case 'fournisseurs': {
              [created] = await tx.insert(fournisseurs).values({
                entrepriseId: req.entrepriseId,
                numeroFournisseur: null,
                compteComptableId: null,
                raisonSociale: donnees.raisonSociale,
                email: donnees.email || null,
                telephone: donnees.telephone || null,
                adresse: donnees.adresse || null
              }).returning();

              const numeroFournisseur = formatSupplierNumberFromId(created.id);
              const [saved] = await tx.update(fournisseurs)
                .set({ codeAuxiliaire: numeroFournisseur, numeroFournisseur })
                .where(eq(fournisseurs.id, created.id))
                .returning();
              created = saved;
              break;
            }

            case 'plan_comptable':
              {
                const numero = String(donnees.numeroCompte).trim();
                const classe = donnees.classe
                  ? parseLocalizedNumber(donnees.classe)
                  : parseInt(numero.charAt(0), 10);
              [created] = await tx.insert(comptesComptables).values({
                entrepriseId: req.entrepriseId,
                numero,
                nom: donnees.libelle,
                type: normalizeAccountType(donnees.typeCompte, numero, classe),
                categorie: classe >= 6 ? 'résultat' : 'bilan'
              }).returning();
              break;
              }

            case 'produits':
              {
                const { automaticCosting } = await getPlanCapabilities(tx, req.entrepriseId);
              [created] = await tx.insert(produits).values({
                entrepriseId: req.entrepriseId,
                nom: donnees.nom,
                description: donnees.description || null,
                prixVente: automaticCosting ? 0 : (parseLocalizedNumber(donnees.prixVente) ?? 0),
                prixAchat: parseLocalizedNumber(donnees.prixAchat) ?? 0,
                coutMoyen: automaticCosting ? 0 : (parseLocalizedNumber(donnees.coutMoyen) ?? 0),
                reference: donnees.reference || null,
                uniteMesure: donnees.uniteMesure || 'pièce',
                poidsParUnite: parseLocalizedNumber(donnees.poidsParUnite),
                unitePoids: donnees.unitePoids || 'kg'
              }).returning();
              break;
              }

            default:
              throw new Error(`Type d'entité non supporté: ${batch.typeEntite}`);
          }

          await tx.update(importRecords)
            .set({
              entiteCreeeId: created.id,
              entiteCreeeType: batch.typeEntite,
              statut: 'importe'
            })
            .where(and(
              eq(importRecords.id, record.id),
              eq(importRecords.batchId, parseInt(id, 10))
            ));

          await logAudit({
            ...auditInfo,
            action: 'CREATE',
            table: AUDIT_TABLE_BY_ENTITY[batch.typeEntite],
            recordId: created.id,
            nouvelleValeur: created,
            description: `Import ${batch.typeEntite}: ligne ${record.ligneFichier}`,
            executor: tx,
            required: true
          });

          return created;
        });
        
        importes++;
      } catch (err) {
        errors.push({ ligne: record.ligneFichier, erreur: err.message });
        await db.update(importRecords)
          .set({ statut: 'erreur', erreursValidation: JSON.stringify([{ message: err.message }]) })
          .where(eq(importRecords.id, record.id));
      }
    }
    
    const statut = errors.length === 0 ? 'termine' : (importes > 0 ? 'termine' : 'echec');
    
    await db.update(importBatches)
      .set({
        nombreLignesImportees: importes,
        nombreLignesErreurs: batch.nombreLignesErreurs + errors.length,
        statut,
        termineAt: new Date(),
        messageErreur: errors.length > 0 ? `${errors.length} erreurs lors de l'import` : null
      })
      .where(eq(importBatches.id, parseInt(id)));
    
    await logAudit({
      ...extractAuditInfo(req),
      action: 'IMPORT_COMMIT',
      table: 'import_batches',
      recordId: parseInt(id),
      newValues: { importes, erreurs: errors.length, typeEntite: batch.typeEntite }
    });
    
    res.json({ 
      success: true, 
      data: { importes, erreurs: errors, total: records.length }
    });
  } catch (error) {
    console.error('Erreur POST /api/import/batches/:id/commit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [batch] = await db.select({ id: importBatches.id })
      .from(importBatches)
      .where(and(
        eq(importBatches.id, parseInt(id)),
        eq(importBatches.entrepriseId, req.entrepriseId)
      ));
    
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Import non trouvé' });
    }
    
    await db.delete(importRecords)
      .where(eq(importRecords.batchId, parseInt(id)));
    
    await db.delete(importBatches)
      .where(eq(importBatches.id, parseInt(id)));
    
    res.json({ success: true, message: 'Import supprimé' });
  } catch (error) {
    console.error('Erreur DELETE /api/import/batches/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const templates = await db.select()
      .from(importMappingTemplates)
      .where(eq(importMappingTemplates.actif, true))
      .orderBy(desc(importMappingTemplates.estSysteme), desc(importMappingTemplates.createdAt));
    
    res.json({ success: true, data: templates });
  } catch (error) {
    console.error('Erreur GET /api/import/templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
