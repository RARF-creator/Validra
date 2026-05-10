import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { connectDB, closeDB } from './db/connection.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // Security headers (CSP off for Google Fonts)
app.use(cors());                           // Allow all origins (lock down in production)
app.use(morgan('dev'));                     // HTTP request logging
app.use(express.json({ limit: '1mb' }));   // Parse JSON bodies

// ── Static Frontend ───────────────────────────────────────────────────────────
const publicDir = join(__dirname, '..', 'public');
app.use(express.static(publicDir));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Auth Routes ──────────────────────────────────────────────────────────────
app.use('/auth', authRouter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── SPA fallback — serve index.html for any non-API route ───────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'Route not found.' });
  }
  res.sendFile(join(publicDir, 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

import { startScraperCron } from './services/ideaScraper.js';
import { startPatentCheckerCron } from './services/patentChecker.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB();

    startScraperCron();
    startPatentCheckerCron();

    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Validra API running on http://localhost:${PORT}`);
      console.log(`   GET  /health`);
      console.log(`   POST /api/ideas         – Submit & store idea`);
      console.log(`   GET  /api/ideas         – List ideas`);
      console.log(`   POST /api/similarity    – Find similar ideas`);
      console.log(`   GET  /api/autocomplete  – Title suggestions`);
      console.log(`   GET  /api/trends        – Domain trend analysis\n`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n📴 Received ${signal} – shutting down gracefully…`);
      server.close(async () => {
        await closeDB();
        console.log('✅ Server stopped.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('❌ Bootstrap failed:', err.message);
    process.exit(1);
  }
}

bootstrap();
