import app from './app.js';
import { db } from './db.js';
import { users, entreprises } from './schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || (isProduction ? 5000 : 3000);

async function ensureAdminExists() {
  try {
    const existingAdmin = await db.select().from(users).where(eq(users.email, 'admin@comptaorion.com')).limit(1);
    
    if (existingAdmin.length === 0) {
      console.log('Admin non trouvé, création en cours...');
      
      let entreprise = await db.select().from(entreprises).where(eq(entreprises.id, 1)).limit(1);
      
      if (entreprise.length === 0) {
        await db.insert(entreprises).values({
          id: 1,
          nom: 'ComptaOrion',
          email: 'contact@comptaorion.com',
          telephone: '+221 77 000 0000',
          adresse: 'Dakar, Sénégal',
          pays: 'Sénégal',
          devise: 'XOF',
          systemeComptable: 'SYSCOHADA',
          actif: true
        });
        console.log('Entreprise ComptaOrion créée');
      }
      
      const passwordHash = await bcrypt.hash('Admin123!', 10);
      
      await db.insert(users).values({
        email: 'admin@comptaorion.com',
        username: 'admin',
        passwordHash: passwordHash,
        nom: 'Administrateur',
        prenom: 'Système',
        role: 'admin',
        entrepriseId: 1,
        actif: true
      });
      
      console.log('Admin créé avec succès: admin@comptaorion.com / Admin123!');
    } else {
      console.log('Admin existant trouvé');
    }
  } catch (error) {
    console.error('Erreur lors de la vérification/création admin:', error.message);
  }
}

const HOST = isProduction ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, async () => {
  console.log(`ComptaOrion Backend running on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
  await ensureAdminExists();
});
