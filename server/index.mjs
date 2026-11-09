import { createServer } from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import process from 'node:process';
import {

  createLinkedInClient,
  getLinkedInConfiguration,
  LinkedInApiError,
} from './linkedin.mjs';


const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const isDevelopment = process.argv.includes('--dev');
const portArgument = process.argv.indexOf('--port');
const port = Number(
  portArgument >= 0
    ? process.argv[portArgument + 1]
    : process.env.PORT || (isDevelopment ? 3001 : 3000),
);
const linkedin = createLinkedInClient();
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(data));

}

function isAuthorized(request) {
  const expected = process.env.LINKEDIN_PUBLISH_KEY || '';
  const provided = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) {
      throw new LinkedInApiError('Request body exceeds the 32 KB limit.', 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new LinkedInApiError('Request body must be valid JSON.', 400);
  }
}

function serveStatic(request, response) {
  const dist = resolve(root, 'dist');
  if (!existsSync(dist)) {
    sendJson(response, 503, { error: 'Frontend is not built. Run npm run build first.' });
    return;
  }
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^[/\\]+/, '');
  const file = resolve(dist, relativePath);
  if (file !== dist && !file.startsWith(`${dist}${sep}`)) {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  const target = existsSync(file) && statSync(file).isFile()
    ? file
    : resolve(dist, 'index.html');
  response.writeHead(200, {
    'Cache-Control': 'no-cache',
    'Content-Type': contentTypes[extname(target)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(target).pipe(response);
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname === '/api/linkedin/status' && request.method === 'GET') {
    sendJson(response, 200, {
      configured: getLinkedInConfiguration().configured,
    });
    return;
  }

  if (pathname === '/api/linkedin/post-job' && request.method === 'POST') {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: 'Enter the valid recruiter publishing key.' });
      return;
    }
    try {
      const body = await readJson(request);
      const result = await linkedin.postJob(body.job);
      sendJson(response, 202, result);
    } catch (error) {
      const status = error instanceof LinkedInApiError ? error.statusCode : 502;
      sendJson(response, status, {
        error: error instanceof Error ? error.message : 'LinkedIn publishing failed.',
      });
    }
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    serveStatic(request, response);
    return;
  }
  sendJson(response, 405, { error: 'Method not allowed.' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Recruitment app server listening on port ${port}`);
});
