import app from './app.js';

const PORT = process.env.BACKEND_PORT || 3000;

app.listen(PORT, 'localhost', () => {
  console.log(`ComptaOrion Backend running on http://localhost:${PORT}`);
});
