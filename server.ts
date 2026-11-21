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
import { analyzeResumeWithGemini } from './src/services/geminiResumeAnalyzer.ts';

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

  app.post('/api/ai/resume-insights', async (req, res) => {
    try {
      const {
        candidateName,
        resumeText,
        targetRole,
        jobDescription,
        requiredSkills,
        experienceYears,
        educationSummary,
        overallScore,
      } = req.body || {};

      if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
        res.status(400).json({ error: 'Resume text is required for AI analysis.' });
        return;
      }

      const insights = await analyzeResumeWithGemini({
        candidateName: typeof candidateName === 'string' ? candidateName : 'Candidate',
        resumeText,
        targetRole: typeof targetRole === 'string' ? targetRole : 'Software Engineer',
        jobDescription: typeof jobDescription === 'string' ? jobDescription : undefined,
        requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : undefined,
        experienceYears: typeof experienceYears === 'string' ? experienceYears : undefined,
        educationSummary: typeof educationSummary === 'string' ? educationSummary : undefined,
        overallScore: typeof overallScore === 'number' ? overallScore : undefined,
      });

      res.json({ insights });
    } catch (error: unknown) {
      console.error('POST /api/ai/resume-insights failed:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate AI resume insights.';
      const status =
        message.includes('not configured')
          ? 503
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/gmail/send', async (req, res) => {
    try {
      const authHeader = req.headers.authorization || '';
      const accessToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

      if (!accessToken) {
        res.status(401).json({
          error: 'Gmail permission token is missing. Please sign in with Google to connect Gmail.',
          requiresReauth: true,
        });
        return;
      }

      const { to, subject, body } = req.body || {};
      const cleanTo = typeof to === 'string' ? to.trim() : '';
      const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
      const cleanBody = typeof body === 'string' ? body : '';

      if (!cleanTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
        res.status(400).json({ error: 'Valid candidate recipient email is required.' });
        return;
      }
      if (!cleanSubject) {
        res.status(400).json({ error: 'Email subject is required.' });
        return;
      }
      if (!cleanBody.trim()) {
        res.status(400).json({ error: 'Email body is required.' });
        return;
      }

      const encodedSubject = `=?UTF-8?B?${Buffer.from(cleanSubject, 'utf8').toString('base64')}?=`;
      const mimeMessage = [
        `To: ${cleanTo}`,
        `Subject: ${encodedSubject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 8bit',
        '',
        cleanBody,
      ].join('\r\n');

      const raw = Buffer.from(mimeMessage, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const gmailRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ raw }),
        }
      );

      const gmailData = (await gmailRes.json().catch(() => ({}))) as {
        id?: string;
        threadId?: string;
        error?: { message?: string; code?: number };
      };

      if (!gmailRes.ok) {
        const isAuthIssue = gmailRes.status === 401 || gmailRes.status === 403;
        const gmailErrMsg =
          gmailData?.error?.message ||
          (isAuthIssue
            ? 'Gmail authorization expired or missing send permission. Please reconnect Gmail.'
            : `Gmail delivery failed (${gmailRes.status}).`);
        res.status(gmailRes.status).json({
          error: gmailErrMsg,
          requiresReauth: isAuthIssue,
        });
        return;
      }

      res.json({
        ok: true,
        id: gmailData.id || `msg-${Date.now()}`,
        threadId: gmailData.threadId,
        to: cleanTo,
      });
    } catch (error) {
      console.error('POST /api/gmail/send failed:', error);
      res.status(500).json({ error: 'Failed to send email via Gmail.' });
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
