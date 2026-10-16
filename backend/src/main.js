import app from './app.js';
import { initializeTenantSetting } from './utils/rlsPolicies.js';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || (isProduction ? 5000 : 3000);

const HOST = isProduction ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, HOST, async () => {
  console.log(`ComptaOrion Backend running on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
  await initializeTenantSetting();
});
