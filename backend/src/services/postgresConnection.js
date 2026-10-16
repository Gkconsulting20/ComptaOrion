// Render's public PostgreSQL endpoint requires TLS. A connection that works
// against an unencrypted local test database is not sufficient for production.
export function normalizePostgresConnectionString(connectionString) {
  const url = new URL(connectionString);
  if (!url.hostname.endsWith('.render.com')) return connectionString;
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}
