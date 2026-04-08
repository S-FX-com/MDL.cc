// MDL.cc - Main Worker Entry Point
// "The middle-point between you and your audience"

import { Env } from './types';
import { handleRedirect } from './handlers/redirect';
import {
  createLink,
  getLinks,
  getLink,
  updateLink,
  deleteLink,
  createGroup,
  getGroups,
  updateGroup,
  deleteGroup,
  getLinkAnalytics,
  getDashboardStats,
  getTags,
  createTag,
} from './handlers/api';
import { generateQR, saveQRConfig } from './handlers/qr';
import { sendInviteEmail, validateInvite, acceptInvite } from './handlers/email';
import { register, login, getMe, updateProfile } from './handlers/auth';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  lookupWorkspace,
} from './handlers/workspaces';
import { errorResponse, jsonResponse } from './utils';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Attach context for waitUntil
    (request as any).ctx = ctx;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    try {
      // ============ API Routes ============

      // Health check
      if (path === '/api/health') {
        return jsonResponse({
          status: 'healthy',
          app: env.APP_NAME,
          tagline: env.APP_TAGLINE,
          environment: env.ENVIRONMENT,
        });
      }

      // Dashboard stats
      if (path === '/api/stats' && method === 'GET') {
        return getDashboardStats(env);
      }

      // Links CRUD
      if (path === '/api/links') {
        if (method === 'GET') return getLinks(request, env);
        if (method === 'POST') return createLink(request, env);
      }

      // Single link operations
      const linkMatch = path.match(/^\/api\/links\/([^/]+)$/);
      if (linkMatch) {
        const linkId = linkMatch[1];
        if (method === 'GET') return getLink(linkId, env);
        if (method === 'PUT') return updateLink(linkId, request, env);
        if (method === 'DELETE') return deleteLink(linkId, env);
      }

      // Link analytics
      const analyticsMatch = path.match(/^\/api\/links\/([^/]+)\/analytics$/);
      if (analyticsMatch && method === 'GET') {
        return getLinkAnalytics(analyticsMatch[1], request, env);
      }

      // Groups
      if (path === '/api/groups') {
        if (method === 'GET') return getGroups(env);
        if (method === 'POST') return createGroup(request, env);
      }

      const groupMatch = path.match(/^\/api\/groups\/([^/]+)$/);
      if (groupMatch) {
        const groupId = groupMatch[1];
        if (method === 'PUT') return updateGroup(groupId, request, env);
        if (method === 'DELETE') return deleteGroup(groupId, env);
      }

      // Tags
      if (path === '/api/tags') {
        if (method === 'GET') return getTags(env);
        if (method === 'POST') return createTag(request, env);
      }

      // QR Code generation
      if (path === '/api/qr') {
        if (method === 'GET') return generateQR(request, env);
        if (method === 'POST') return saveQRConfig(request, env);
      }

      // Invite emails
      if (path === '/api/invites' && method === 'POST') return sendInviteEmail(request, env);
      if (path === '/api/invites/validate' && method === 'GET') return validateInvite(request, env);
      if (path === '/api/invites/accept'   && method === 'POST') return acceptInvite(request, env);

      // ============ Auth Routes ============
      if (path === '/api/auth/register' && method === 'POST') return register(request, env);
      if (path === '/api/auth/login'    && method === 'POST') return login(request, env);
      if (path === '/api/auth/me'       && method === 'GET')  return getMe(request, env);
      if (path === '/api/auth/me'       && method === 'PUT')  return updateProfile(request, env);

      // ============ Workspace Routes ============
      if (path === '/api/workspaces/lookup' && method === 'GET') return lookupWorkspace(request, env);
      if (path === '/api/workspaces' && method === 'GET')  return getWorkspaces(request, env);
      if (path === '/api/workspaces' && method === 'POST') return createWorkspace(request, env);

      const wsMatch = path.match(/^\/api\/workspaces\/([^/]+)$/);
      if (wsMatch) {
        const wsId = wsMatch[1];
        if (method === 'PUT')    return updateWorkspace(wsId, request, env);
        if (method === 'DELETE') return deleteWorkspace(wsId, request, env);
      }

      const wsMembersMatch = path.match(/^\/api\/workspaces\/([^/]+)\/members$/);
      if (wsMembersMatch && method === 'GET') {
        return getWorkspaceMembers(wsMembersMatch[1], request, env);
      }

      // ============ Static Assets & Web App ============

      // Serve static assets (handled by Cloudflare Sites/Pages)
      if (
        path === '/' ||
        path.startsWith('/assets/') ||
        path.endsWith('.js') ||
        path.endsWith('.css') ||
        path.endsWith('.ico') ||
        path.endsWith('.png') ||
        path.endsWith('.svg')
      ) {
        // In production, this would be handled by __STATIC_CONTENT binding
        // For now, return the app shell for SPA routing
        if (path === '/' || !path.includes('.')) {
          return getAppShell(env);
        }
        return new Response('Not Found', { status: 404 });
      }

      // ============ URL Redirect ============

      // Check if this is a short URL redirect
      const shortCodeMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
      if (shortCodeMatch && method === 'GET') {
        const shortCode = shortCodeMatch[1];

        // Exclude API and app routes
        if (
          !shortCode.startsWith('api') &&
          !['dashboard', 'login', 'signup', 'register', 'settings', 'groups', 'analytics', 'invitations', 'join', 'workspace'].includes(shortCode)
        ) {
          return handleRedirect(shortCode, request, env);
        }
      }

      // SPA fallback - serve app shell for client-side routing
      if (method === 'GET' && !path.startsWith('/api/')) {
        return getAppShell(env);
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  },
};

// App shell for SPA
function getAppShell(env: Env): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${env.APP_NAME} - ${env.APP_TAGLINE}</title>
  <meta name="description" content="MDL.cc is a fast, reliable URL shortening service. The middle-point between you and your audience.">
  <meta name="theme-color" content="#10B981">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .loading {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #1e293b;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="root">
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading MDL.cc...</p>
    </div>
  </div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache',
    },
  });
}
