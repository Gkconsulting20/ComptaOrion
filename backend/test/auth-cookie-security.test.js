import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('ERP and commercial JWTs are not persisted in browser storage', () => {
  const frontend = [
    '../../frontend/src/api.js',
    '../../frontend/src/App.jsx',
    '../../frontend/src/pages/Login.jsx',
    '../../frontend/src/pages/CommercialPortal.jsx',
    '../../frontend/src/components/ImportWizard.jsx',
    '../../frontend/src/modules/ModuleComptabilite.jsx',
    '../../frontend/src/modules/ClientsModule.jsx'
  ].map(source).join('\n');

  assert.doesNotMatch(frontend, /localStorage\.(?:getItem|setItem)\(['"](?:token|refreshToken|commercialToken)['"]/);
  assert.doesNotMatch(frontend, /Authorization['"]?\s*:\s*`Bearer \$\{[^}]*localStorage/);
});

test('ERP auth cookies are HttpOnly, SameSite protected, and used for refresh', () => {
  const auth = source('../src/auth.js');
  const authRoutes = source('../src/routes/auth-security.js');

  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /readCookie\(req, ACCESS_TOKEN_COOKIE\)/);
  assert.match(authRoutes, /readCookie\(req, REFRESH_TOKEN_COOKIE\)/);
  assert.match(authRoutes, /setAuthCookies\(res, token, refreshToken\)/);
});

test('commercial portal uses an HttpOnly cookie instead of a browser token', () => {
  const commercialRoutes = source('../src/routes/commercial-portal.js');
  const commercialFrontend = source('../../frontend/src/pages/CommercialPortal.jsx');

  assert.match(commercialRoutes, /HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(commercialRoutes, /success:\s*true,\s*token,/);
  assert.doesNotMatch(commercialFrontend, /localStorage\.setItem\(['"]commercialToken['"]/);
});
