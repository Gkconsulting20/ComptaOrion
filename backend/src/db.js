import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema.js';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

// Utiliser le connection pooler de Neon pour éviter "too many connections"
function getPooledConnectionString(url) {
  try {
    const parsed = new URL(url);
    // Ajouter -pooler au hostname si pas déjà présent
    if (!parsed.hostname.includes('-pooler')) {
      parsed.hostname = parsed.hostname.replace(
        /^([^.]+)(\..*)/,
        '$1-pooler$2'
      );
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
}

const connectionString = getPooledConnectionString(process.env.DATABASE_URL);

export const pool = new Pool({ 
  connectionString,
  max: 3,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000
});
export const db = drizzle({ client: pool, schema });
