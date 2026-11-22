-- Renommage de la table d'idempotence : lite_idempotency -> idempotency.
-- Le nom "lite" venait de ComptaOrion Lite (code copié au début du projet) ;
-- la table est la SEULE table d'idempotence de ComptaOrion, utilisée par
-- POST /api/depenses/create et le middleware d'idempotence.
-- À appliquer sur la base live au déploiement, sur feu vert de Cap.
-- Le code (schema Drizzle, middleware, routes) utilise déjà le nouveau nom.
ALTER TABLE lite_idempotency RENAME TO idempotency;
ALTER INDEX lite_idempotency_key_unique RENAME TO idempotency_key_unique;
