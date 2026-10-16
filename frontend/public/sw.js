// Retraite de l'ancien service worker Lite. Ne pas supprimer ce fichier tant
// que des navigateurs peuvent encore avoir l'ancien worker enregistré.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('orion-lite-shell-'))
      .map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
