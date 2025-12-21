import { defineConfig } from 'drizzle-kit';

// Fonction pour convertir l'URL en URL poolée
function getPooledUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes('-pooler')) {
      parsed.hostname = parsed.hostname.replace(/^([^.]+)(\..*)/, '$1-pooler$2');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const connectionUrl = getPooledUrl(process.env.DATABASE_URL || '');

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.js',
  dialect: 'postgresql',
  strict: false,
  dbCredentials: {
    url: connectionUrl,
  },
});
