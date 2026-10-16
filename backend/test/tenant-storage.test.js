import test from 'node:test';
import assert from 'node:assert/strict';
import { entrepriseIsolation } from '../src/auth.js';
import { runtimeContext } from '../src/runtime-context.js';
import { putFile, deleteFile, validateLogoKey } from '../src/services/fileStorage.js';
import { imageType } from '../src/routes/upload.js';

test('les champs entreprise transmis par le client ne remplacent jamais la session', () => {
  const req = { user: { entrepriseId: 3, id: 8 }, query: { entrepriseId: 999 }, body: { entrepriseId: 999, userId:999 } };
  let called = false;
  entrepriseIsolation(req, {}, () => called = true);
  assert.ok(called);
  assert.equal(req.query.entrepriseId,3);
  assert.equal(req.body.entrepriseId,3);
  assert.equal(req.body.userId,8);
});

test('les logos sont écrits dans R2 sans chemin arbitraire', async () => {
  const objects = new Map();
  const key='logos/entreprise-3-logo-abc123.png';
  await runtimeContext.run({ uploads: {
    async put(k,b) { objects.set(k,b); },
    async delete(k) { objects.delete(k); },
  } }, async () => {
    await putFile(key,Buffer.from('test'),'image/png');
    assert.ok(objects.has(key));
    await assert.rejects(putFile('../secret',Buffer.from('x'),'text/plain'));
    await deleteFile('/uploads/'+key);
    assert.equal(objects.size,0);
  });
  assert.equal(validateLogoKey('../secret'),false);
});

test('un SVG ou un faux PNG est rejeté', () => {
  assert.equal(imageType(Buffer.from('<svg onload="alert(1)"/>')),null);
  assert.equal(imageType(Buffer.from('not a png')),null);
  assert.deepEqual(imageType(Buffer.from([137,80,78,71,13,10,26,10])),['png','image/png']);
});
