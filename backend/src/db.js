import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import pg from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from 'ws';
import * as schema from './schema.js';
import { runtimeContext } from './runtime-context.js';

if (!process.env.DATABASE_URL && process.env.RUNTIME_CLOUDFLARE !== 'true') {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

const isNeon = process.env.DATABASE_URL?.includes('neon.tech');
const isProduction = process.env.NODE_ENV === 'production';

let defaultPool;
let defaultDb;

if (process.env.RUNTIME_CLOUDFLARE === 'true') {
  // Created lazily inside the request, not at module initialization.
} else if (isNeon) {
  neonConfig.webSocketConstructor = ws;
  neonConfig.pipelineConnect = false;
  neonConfig.useSecureWebSocket = true;
  
  function getPooledConnectionString(url) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('-pooler')) {
        parsed.hostname = parsed.hostname.replace(/^([^.]+)(.*)/, '$1-pooler$2');
      }
      return parsed.toString();
    } catch (e) {
      return url;
    }
  }
  
  const connectionString = getPooledConnectionString(process.env.DATABASE_URL);
  defaultPool = new NeonPool({
    connectionString,
    max: 5,
    min: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: false
  });
  
  defaultPool.on('error', (err) => {
    console.error('Erreur pool Neon:', err.message);
  });
  
  defaultDb = drizzleNeon({ client: defaultPool, schema });
  console.log('✅ Base de données Neon connectée');
} else {
  defaultPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: isProduction ? { rejectUnauthorized: false } : false
  });
  defaultDb = drizzlePg({ client: defaultPool, schema });
  console.log('✅ Base de données PostgreSQL connectée');
}

export function createRequestDatabase(connectionString) {
  const neon = new URL(connectionString).hostname.endsWith('.neon.tech');
  if (neon) {
    // Workers provide the WebSocket implementation; do not use a Node ws socket.
    neonConfig.webSocketConstructor = globalThis.WebSocket;
    const pool = new NeonPool({ connectionString, max: 3, connectionTimeoutMillis: 15000 });
    return { pool, db: drizzleNeon({ client: pool, schema }) };
  }
  const pool = new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 15000 });
  return { pool, db: drizzlePg({ client: pool, schema }) };
}

function scoped(key, fallback) {
  return new Proxy({}, {
    get(_target, property) {
      const value = runtimeContext.getStore()?.[key] || fallback;
      if (!value) throw new Error(`Accès ${key} hors d’une requête Cloudflare`);
      const member = value[property];
      return typeof member === 'function' ? member.bind(value) : member;
    },
  });
}
export const pool = scoped('pool', defaultPool);
export const db = scoped('db', defaultDb);
