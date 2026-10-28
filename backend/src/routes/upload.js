import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { db } from '../db.js';
import { entreprises } from '../schema.js';
import { eq } from 'drizzle-orm';
import { putFile, deleteFile } from '../services/fileStorage.js';
import { logAudit, extractAuditInfo } from '../utils/auditLogger.js';

const router = express.Router();
// No writes to /bundle or /tmp in Workers. R2 is the durable file store.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function imageType(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['png','image/png'];
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return ['jpg','image/jpeg'];
  if (['GIF87a','GIF89a'].includes(buffer.subarray(0, 6).toString())) return ['gif','image/gif'];
  return null;
}

router.post('/logo', (req, res, next) => {
  upload.single('logo')(req, res, error => {
    if (error) return res.status(400).json({ error: 'Image invalide ou supérieure à 5 Mo' });
    next();
  });
}, async (req, res) => {
  let logoUrl;
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const type = imageType(req.file.buffer);
    if (!type) return res.status(400).json({ error: 'Utilisez une image PNG, JPEG ou GIF valide (SVG non accepté).' });
    const key = `logos/entreprise-${req.entrepriseId}-logo-${randomUUID()}.${type[0]}`;
    logoUrl = `/uploads/${key}`;
    await putFile(key, req.file.buffer, type[1]);
    const entreprise = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(entreprises).where(eq(entreprises.id, req.entrepriseId))
        .for('update').limit(1);
      if (!previous) throw Object.assign(new Error('Entreprise introuvable'), { status: 404 });
      const [updated] = await tx.update(entreprises).set({ logoUrl, updatedAt: new Date() })
        .where(eq(entreprises.id, req.entrepriseId)).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'entreprises',
        recordId: updated.id,
        ancienneValeur: { logoUrl: previous.logoUrl },
        nouvelleValeur: { logoUrl: updated.logoUrl },
        description: 'Logo de l’entreprise modifié',
        executor: tx,
        required: true
      });
      return previous;
    });
    // Removing the old object is best effort only after the database update.
    if (entreprise.logoUrl) await deleteFile(entreprise.logoUrl).catch(() => console.warn('Ancien logo non supprimé'));
    res.json({ message: 'Logo enregistré', logoUrl });
  } catch (error) {
    if (logoUrl) await deleteFile(logoUrl).catch(() => {});
    res.status(error.status || 500).json({ error: error.status === 404 ? error.message : 'Impossible d’enregistrer le logo' });
  }
});

router.delete('/logo', async (req, res) => {
  try {
    const entreprise = await db.transaction(async (tx) => {
      const [previous] = await tx.select().from(entreprises).where(eq(entreprises.id, req.entrepriseId))
        .for('update').limit(1);
      if (!previous) return null;
      const [updated] = await tx.update(entreprises).set({ logoUrl: null, updatedAt: new Date() })
        .where(eq(entreprises.id, req.entrepriseId)).returning();
      await logAudit({
        ...extractAuditInfo(req),
        action: 'UPDATE',
        table: 'entreprises',
        recordId: updated.id,
        ancienneValeur: { logoUrl: previous.logoUrl },
        nouvelleValeur: { logoUrl: null },
        description: 'Logo de l’entreprise supprimé',
        executor: tx,
        required: true
      });
      return previous;
    });
    if (!entreprise) return res.status(404).json({ error: 'Entreprise introuvable' });
    if (entreprise.logoUrl) await deleteFile(entreprise.logoUrl).catch(() => console.warn('Logo privé non supprimé du stockage'));
    res.json({ message: 'Logo supprimé' });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de supprimer le logo' });
  }
});
export default router;
