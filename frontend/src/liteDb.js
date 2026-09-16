const DB_NAME = 'comptaorion-lite';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'opId' });
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueWrite(scope, opId, endpoint, payload) {
  const db = await openDb();
  const item = { opId, scope, endpoint, payload, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueue(scope) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction('queue').objectStore('queue').getAll();
    req.onsuccess = () => resolve((req.result || []).filter(item => item.scope === scope));
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueue(opId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').delete(opId);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheRead(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction('cache').objectStore('cache').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function cacheWrite(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('cache', 'readwrite');
      tx.objectStore('cache').put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* IndexedDB is optional */ }
}