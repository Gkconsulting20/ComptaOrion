import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/schema.js',
  dialect: 'postgresql',
  strict: false, // Disable interactive prompts for auto-sync
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
