import { httpServerHandler } from 'cloudflare:node';
import app from '../backend/src/app.js';
import { createRequestDatabase } from '../backend/src/db.js';
import { runtimeContext } from '../backend/src/runtime-context.js';
import { purgeExpiredTrials } from '../backend/src/services/trialLifecycle.js';

app.listen(3000);
const server = httpServerHandler({ port: 3000 });

export default {
  // Cron quotidien 03:00 UTC (triggers.crons dans wrangler.jsonc) :
  // purge des essais expirés non convertis (30 j d'essai + 30 j de blocage)
  // et des démos de plus de 7 jours. Tant que trial_purge_enabled = false
  // en base (défaut), le run est un dry-run : sélection + journalisation,
  // aucune suppression réelle. Voir services/trialLifecycle.js.
  async scheduled(event, env, ctx) {
    const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
    if (!connectionString) {
      console.error('Purge cron impossible : DATABASE_URL absente.');
      return;
    }
    const database = createRequestDatabase(connectionString);
    ctx.waitUntil((async () => {
      try {
        await runtimeContext.run({ ...database, uploads: env.UPLOADS }, async () => {
          const summary = await purgeExpiredTrials({
            deletedBy: 'systeme:cron-03h00',
            uploads: env.UPLOADS || null,
          });
          console.log('Purge quotidienne terminée:', JSON.stringify(summary));
        });
      } catch (error) {
        console.error('Purge quotidienne échouée:', error);
      } finally {
        await database.pool.end();
      }
    })());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/uploads/')) {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
      const key = url.pathname.slice('/uploads/'.length);
      // Only public branding files are served without a session, never backups.
      if (!/^logos\/entreprise-\d+-logo-[a-zA-Z0-9-]+\.(png|jpe?g|gif|svg)$/.test(key)) {
        return new Response('Introuvable', { status: 404 });
      }
      const object = await env.UPLOADS.get(key);
      if (!object) return new Response('Introuvable', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
      headers.set('ETag', object.httpEtag);
      return new Response(request.method === 'HEAD' ? null : object.body, { headers });
    }
    if (url.pathname === '/lite' || url.pathname.startsWith('/lite/')) {
      return new Response('Lite est un projet indépendant.', { status: 410 });
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
      if (!connectionString || !env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
        return Response.json({ error: 'Configuration serveur incomplète' }, { status: 503 });
      }
      const database = createRequestDatabase(connectionString);
      return runtimeContext.run({ ...database, uploads: env.UPLOADS }, async () => {
        try {
          return await server.fetch(request, env, ctx);
        } finally {
          ctx.waitUntil(database.pool.end());
        }
      });
    }
    return env.ASSETS.fetch(request);
  },
};
