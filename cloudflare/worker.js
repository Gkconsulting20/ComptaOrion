import { httpServerHandler } from 'cloudflare:node';
import app from '../backend/src/app.js';
import { createRequestDatabase } from '../backend/src/db.js';
import { runtimeContext } from '../backend/src/runtime-context.js';

app.listen(3000);
const server = httpServerHandler({ port: 3000 });

export default {
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
