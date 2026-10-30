import test from 'node:test';
import assert from 'node:assert/strict';
import { entrepriseIsolation } from '../src/auth.js';

function responseStub() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('le tenant du jeton remplace les identifiants forgés dans les entrées', () => {
  const req = {
    user: { id: 42, entrepriseId: '12' },
    query: { entrepriseId: '99', filtre: { entrepriseId: 99 } },
    body: {
      entrepriseId: 99,
      userId: 7,
      items: [{ entrepriseId: 99, userId: 7, nom: 'test' }],
    },
    params: { entrepriseId: '99', userId: '7', id: '501' },
  };
  const res = responseStub();
  let nextCalled = false;

  entrepriseIsolation(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.entrepriseId, 12);
  assert.equal(req.userId, 42);
  assert.equal(req.query.entrepriseId, 12);
  assert.equal(req.query.filtre.entrepriseId, 12);
  assert.equal(req.body.entrepriseId, 12);
  assert.equal(req.body.userId, 42);
  assert.equal(req.body.items[0].entrepriseId, 12);
  assert.equal(req.body.items[0].userId, 7);
  assert.equal(req.params.entrepriseId, 12);
  assert.equal(req.params.userId, 42);
  assert.equal(req.params.id, '501');
});

test('le middleware refuse un tenant absent, nul ou non entier', () => {
  for (const entrepriseId of [undefined, null, 0, -1, 'abc', '1.5', Number.MAX_SAFE_INTEGER + 1]) {
    const req = { user: { id: 42, entrepriseId }, query: {}, body: {} };
    const res = responseStub();
    let nextCalled = false;

    entrepriseIsolation(req, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 401, `tenant refusé: ${String(entrepriseId)}`);
    assert.equal(nextCalled, false, `aucune route ne doit continuer: ${String(entrepriseId)}`);
  }
});

test('les lots JSON reçoivent le tenant authentifié sur chaque élément', () => {
  const req = {
    user: { id: 5, entrepriseId: 3 },
    query: {},
    body: [
      { entrepriseId: 88, userId: 91 },
      { children: [{ entrepriseId: 88, userId: 91 }] },
    ],
  };
  const res = responseStub();

  entrepriseIsolation(req, res, () => {});

  assert.deepEqual(req.body, [
    { entrepriseId: 3, userId: 91 },
    { children: [{ entrepriseId: 3, userId: 91 }] },
  ]);
});
