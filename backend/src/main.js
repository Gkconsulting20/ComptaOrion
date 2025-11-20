import app from './app.js';

const PORT = process.env.BACKEND_PORT || 3000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ComptaOrion Backend running on http://127.0.0.1:${PORT}`);
});
