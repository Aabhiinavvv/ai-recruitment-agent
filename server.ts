import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  insertAuditEvent,
  loadWorkspaceRecords,
  seedWorkspaceRecords,
  upsertCandidates,
  upsertHiringBrief,
  upsertOutreachDrafts,
  upsertScheduledInterview,
} from './src/db/records.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function resolveDbUserId(req: AuthRequest): Promise<number> {
  if (!req.user?.uid) {
    throw new Error('Authenticated user identity missing.');
  }
  const dbUser = await getOrCreateUser(
    req.user.uid,
    req.user.email || '',
    typeof req.user.name === 'string' ? req.user.name : null
  );
  return dbUser.id;
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/workspace', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const workspace = await loadWorkspaceRecords(userId);
      res.json(workspace);
    } catch (error) {
      console.error('GET /api/workspace failed:', error);
      res.status(500).json({ error: 'Failed to load workspace records' });
    }
  });

  app.post('/api/workspace/seed', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { brief, candidates, scheduledInterviews, outreachQueue, events, reset } =
        req.body || {};

      await seedWorkspaceRecords(
        userId,
        {
          brief: brief || null,
          candidates: Array.isArray(candidates) ? candidates : [],
          scheduledInterviews: Array.isArray(scheduledInterviews)
            ? scheduledInterviews
            : [],
          outreachQueue: Array.isArray(outreachQueue) ? outreachQueue : [],
          events: Array.isArray(events) ? events : [],
        },
        Boolean(reset)
      );

      const workspace = await loadWorkspaceRecords(userId);
      res.json(workspace);
    } catch (error) {
      console.error('POST /api/workspace/seed failed:', error);
      res.status(500).json({ error: 'Failed to seed workspace records' });
    }
  });

  app.put('/api/brief', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { brief } = req.body || {};
      if (!brief) {
        res.status(400).json({ error: 'Missing brief payload' });
        return;
      }
      await upsertHiringBrief(userId, brief);
      res.json({ ok: true });
    } catch (error) {
      console.error('PUT /api/brief failed:', error);
      res.status(500).json({ error: 'Failed to save hiring brief' });
    }
  });

  app.put('/api/candidates', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { candidates } = req.body || {};
      if (!Array.isArray(candidates)) {
        res.status(400).json({ error: 'Missing candidates array' });
        return;
      }
      await upsertCandidates(userId, candidates);
      res.json({ ok: true, count: candidates.length });
    } catch (error) {
      console.error('PUT /api/candidates failed:', error);
      res.status(500).json({ error: 'Failed to save candidates' });
    }
  });

  app.post('/api/interviews', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { interview } = req.body || {};
      if (!interview || !interview.id) {
        res.status(400).json({ error: 'Missing interview payload' });
        return;
      }
      await upsertScheduledInterview(userId, interview);
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/interviews failed:', error);
      res.status(500).json({ error: 'Failed to save scheduled interview' });
    }
  });

  app.put('/api/outreach', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { drafts } = req.body || {};
      if (!Array.isArray(drafts)) {
        res.status(400).json({ error: 'Missing drafts array' });
        return;
      }
      await upsertOutreachDrafts(userId, drafts);
      res.json({ ok: true, count: drafts.length });
    } catch (error) {
      console.error('PUT /api/outreach failed:', error);
      res.status(500).json({ error: 'Failed to save outreach drafts' });
    }
  });

  app.post('/api/audit', requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = await resolveDbUserId(req);
      const { event } = req.body || {};
      if (!event || !event.action) {
        res.status(400).json({ error: 'Missing audit event payload' });
        return;
      }
      await insertAuditEvent(userId, event);
      res.json({ ok: true });
    } catch (error) {
      console.error('POST /api/audit failed:', error);
      res.status(500).json({ error: 'Failed to save audit event' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
