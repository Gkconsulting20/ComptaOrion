import assert from 'node:assert/strict';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const mf = new Miniflare(convertV4MiniflareOptions({
  workers: [{
  modules: true,
  scriptPath: 'generated-artifacts/worker/worker.js',
  compatibilityDate: '2026-02-01',
  compatibilityFlags: ['nodejs_compat'],
  bindings: {
    NODE_ENV: 'production', RUNTIME_CLOUDFLARE: 'true', AI_ENABLED: 'false',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    JWT_SECRET: 'isolated-test-only-not-a-deployment-secret',
    JWT_REFRESH_SECRET: 'isolated-refresh-test-only-not-a-deployment-secret',
  },
  r2Buckets: ['UPLOADS'],
  }],
}));
try {
  for (const [path, status] of [['/api/health',200],['/api/clients',401],['/lite',410]]) {
    const response = await mf.dispatchFetch(`https://test.local${path}`);
    assert.equal(response.status, status, path);
    console.log('Worker PASS', path, status);
  }
  const bucket = await mf.getR2Bucket('UPLOADS');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5N0AAAAASUVORK5CYII=', 'base64');
  await bucket.put('logos/entreprise-1-logo-test.png', new Uint8Array(png).buffer, { httpMetadata: { contentType:'image/png' } });
  const logo = await mf.dispatchFetch('https://test.local/uploads/logos/entreprise-1-logo-test.png');
  assert.equal(logo.status,200);
  assert.equal(logo.headers.get('content-type'),'image/png');
  assert.deepEqual(Buffer.from(await logo.arrayBuffer()),png);
  assert.equal((await mf.dispatchFetch('https://test.local/uploads/backups/private.dump')).status,404);
  console.log('Worker PASS R2 branding and private-path rejection');
} finally {
  await mf.dispose();
}
