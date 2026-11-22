import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import extractQuizHandler from './api/gemini/extract-quiz.ts';
import legacyExtractQuizHandler from './api/extract-quiz.ts';
import storageSyncHandler from './api/storage/sync.ts';
import ttsHandler from './api/tts.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for PDF textbook uploads and page images
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Mount API routes compatible with Vercel serverless handlers
  app.all('/api/gemini/extract-quiz', async (req, res) => {
    await extractQuizHandler(req as any, res as any);
  });

  app.all('/api/extract-quiz', async (req, res) => {
    await legacyExtractQuizHandler(req as any, res as any);
  });

  app.all('/api/storage/sync', async (req, res) => {
    await storageSyncHandler(req as any, res as any);
  });

  app.all('/api/tts', async (req, res) => {
    await ttsHandler(req as any, res as any);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
