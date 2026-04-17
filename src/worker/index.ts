// MDL.cc - Main Worker Entry Point
// "The middle-point between you and your audience"

import { Env } from './types';
import { routeRedirect } from './handlers/redirect';
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
import {
  listDomains,
  createDomain,
  verifyDomain,
  setDefaultDomain,
  deleteDomain,
} from './handlers/domains';
import { generateQR, saveQRConfig } from './handlers/qr';
import { sendInviteEmail, validateInvite, acceptInvite, getWorkspaceInvitations, cancelInvitation } from './handlers/email';
import { register, login, getMe, updateProfile } from './handlers/auth';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
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
        return getDashboardStats(request, env);
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

      const wsMemberMatch = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/);
      if (wsMemberMatch) {
        if (method === 'DELETE') return removeWorkspaceMember(wsMemberMatch[1], wsMemberMatch[2], request, env);
        if (method === 'PATCH')  return updateMemberRole(wsMemberMatch[1], wsMemberMatch[2], request, env);
      }

      const wsInvitesMatch = path.match(/^\/api\/workspaces\/([^/]+)\/invitations$/);
      if (wsInvitesMatch) {
        if (method === 'GET') return getWorkspaceInvitations(wsInvitesMatch[1], request, env);
      }

      const wsInviteCancelMatch = path.match(/^\/api\/workspaces\/([^/]+)\/invitations\/([^/]+)$/);
      if (wsInviteCancelMatch && method === 'DELETE') {
        return cancelInvitation(wsInviteCancelMatch[1], wsInviteCancelMatch[2], request, env);
      }

      // ============ Domains ============
      if (path === '/api/domains') {
        if (method === 'GET')  return listDomains(request, env);
        if (method === 'POST') return createDomain(request, env);
      }
      const domainVerifyMatch = path.match(/^\/api\/domains\/([^/]+)\/verify$/);
      if (domainVerifyMatch && method === 'POST') {
        return verifyDomain(domainVerifyMatch[1], request, env);
      }
      const domainDefaultMatch = path.match(/^\/api\/domains\/([^/]+)\/default$/);
      if (domainDefaultMatch && method === 'POST') {
        return setDefaultDomain(domainDefaultMatch[1], request, env);
      }
      const domainMatch = path.match(/^\/api\/domains\/([^/]+)$/);
      if (domainMatch && method === 'DELETE') {
        return deleteDomain(domainMatch[1], request, env);
      }

      // ============ URL Redirect ============
      //
      // mdl.cc/m{code}  — default shared domain; "/m" prefix keeps app routes safe.
      // <branded>/{code} — full hostname dedicated to one workspace.
      if (method === 'GET') {
        const redirect = await routeRedirect(request, env);
        if (redirect) return redirect;
      }

      // SPA fallback - serve real index.html for client-side routing
      if (method === 'GET' && !path.startsWith('/api/')) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  },
};

