import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { db } from '../db.js';
import { entreprises } from '../schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/logos'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers image (JPEG, PNG, GIF, SVG) sont autorisés'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

router.post('/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;

    await db.update(entreprises)
      .set({ 
        logoUrl,
        updatedAt: new Date()
      })
      .where(eq(entreprises.id, req.entrepriseId));

    res.json({ 
      message: 'Logo uploadé avec succès', 
      logoUrl 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/logo', async (req, res) => {
  try {
    await db.update(entreprises)
      .set({ 
        logoUrl: null,
        updatedAt: new Date()
      })
      .where(eq(entreprises.id, req.entrepriseId));

    res.json({ message: 'Logo supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
