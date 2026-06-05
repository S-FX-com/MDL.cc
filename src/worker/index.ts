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
import { microsoftStart, microsoftCallback } from './handlers/microsoft';
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateMemberRole,
  lookupWorkspace,
} from './handlers/workspaces';
import {
  listWorkspaceDomains,
  addWorkspaceDomain,
  updateWorkspaceDomain,
  removeWorkspaceDomain,
} from './handlers/workspaceDomains';
import {
  getPlatformOverview,
  listAllWorkspaces,
  getWorkspaceDetailAdmin,
  updateWorkspaceAdmin,
  deleteWorkspaceAdmin,
  addWorkspaceMemberAdmin,
  updateMemberRoleAdmin,
  removeWorkspaceMemberAdmin,
  listAllUsers,
  updateUserAdmin,
} from './handlers/admin';
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

    // Host routing. mdl.cc (and dev hosts) serve the full product — dashboard
    // app, JSON API, and mdl.cc/m{code} short links. Every other hostname is a
    // branded short-link domain: it must ONLY resolve /{code} redirects and
    // never expose the dashboard SPA or API. Without this gate the SPA fallback
    // (below) would happily serve the whole web app on any attached hostname.
    const host = url.hostname.toLowerCase();
    const isAppHost =
      host === 'mdl.cc' ||
      host === 'www.mdl.cc' ||
      host.endsWith('.workers.dev') ||
      host === 'localhost';

    try {
      if (!isAppHost) {
        if (method === 'GET') {
          const redirect = await routeRedirect(request, env);
          if (redirect) return redirect;
        }
        // Not a short link on a branded domain — don't leak the app/API here.
        return new Response('Not Found', { status: 404 });
      }

      // ============ API Routes ============

      // Health check + feature flags consumed by the web client (SSO buttons,
      // domain auto-join UI). Kept on /api/health so the web app only needs
      // one bootstrap request.
      if (path === '/api/health') {
        return jsonResponse({
          status: 'healthy',
          app: env.APP_NAME,
          tagline: env.APP_TAGLINE,
          environment: env.ENVIRONMENT,
          features: {
            microsoft_sso: Boolean(env.MS_CLIENT_ID && env.MS_CLIENT_SECRET),
          },
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
        if (method === 'GET') return getLink(linkId, request, env);
        if (method === 'PUT') return updateLink(linkId, request, env);
        if (method === 'DELETE') return deleteLink(linkId, request, env);
      }

      // Link analytics
      const analyticsMatch = path.match(/^\/api\/links\/([^/]+)\/analytics$/);
      if (analyticsMatch && method === 'GET') {
        return getLinkAnalytics(analyticsMatch[1], request, env);
      }

      // Groups
      if (path === '/api/groups') {
        if (method === 'GET') return getGroups(request, env);
        if (method === 'POST') return createGroup(request, env);
      }

      const groupMatch = path.match(/^\/api\/groups\/([^/]+)$/);
      if (groupMatch) {
        const groupId = groupMatch[1];
        if (method === 'PUT') return updateGroup(groupId, request, env);
        if (method === 'DELETE') return deleteGroup(groupId, request, env);
      }

      // Tags
      if (path === '/api/tags') {
        if (method === 'GET') return getTags(request, env);
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
      if (path === '/api/auth/microsoft/start'    && method === 'GET') return microsoftStart(request, env);
      if (path === '/api/auth/microsoft/callback' && method === 'GET') return microsoftCallback(request, env);

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
      if (wsMembersMatch) {
        if (method === 'GET')  return getWorkspaceMembers(wsMembersMatch[1], request, env);
        if (method === 'POST') return addWorkspaceMember(wsMembersMatch[1], request, env);
      }

      const wsMemberMatch = path.match(/^\/api\/workspaces\/([^/]+)\/members\/([^/]+)$/);
      if (wsMemberMatch) {
        if (method === 'DELETE') return removeWorkspaceMember(wsMemberMatch[1], wsMemberMatch[2], request, env);
        if (method === 'PATCH')  return updateMemberRole(wsMemberMatch[1], wsMemberMatch[2], request, env);
      }

      const wsDomainsMatch = path.match(/^\/api\/workspaces\/([^/]+)\/email-domains$/);
      if (wsDomainsMatch) {
        if (method === 'GET')  return listWorkspaceDomains(wsDomainsMatch[1], request, env);
        if (method === 'POST') return addWorkspaceDomain(wsDomainsMatch[1], request, env);
      }
      const wsDomainItemMatch = path.match(/^\/api\/workspaces\/([^/]+)\/email-domains\/([^/]+)$/);
      if (wsDomainItemMatch) {
        if (method === 'PATCH')  return updateWorkspaceDomain(wsDomainItemMatch[1], wsDomainItemMatch[2], request, env);
        if (method === 'DELETE') return removeWorkspaceDomain(wsDomainItemMatch[1], wsDomainItemMatch[2], request, env);
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

      // ============ Superadmin (platform-wide) ============
      //
      // Every /api/admin/* handler enforces getSuperadmin() and then operates
      // across workspaces — this is the only API surface that bypasses the
      // per-workspace membership scoping. Routes are matched before the SPA
      // fallback so they never leak into static asset serving.
      if (path === '/api/admin/overview'   && method === 'GET') return getPlatformOverview(request, env);
      if (path === '/api/admin/workspaces' && method === 'GET') return listAllWorkspaces(request, env);

      const adminWsMembersMatch = path.match(/^\/api\/admin\/workspaces\/([^/]+)\/members$/);
      if (adminWsMembersMatch && method === 'POST') {
        return addWorkspaceMemberAdmin(adminWsMembersMatch[1], request, env);
      }
      const adminWsMemberMatch = path.match(/^\/api\/admin\/workspaces\/([^/]+)\/members\/([^/]+)$/);
      if (adminWsMemberMatch) {
        if (method === 'PATCH')  return updateMemberRoleAdmin(adminWsMemberMatch[1], adminWsMemberMatch[2], request, env);
        if (method === 'DELETE') return removeWorkspaceMemberAdmin(adminWsMemberMatch[1], adminWsMemberMatch[2], request, env);
      }
      const adminWsMatch = path.match(/^\/api\/admin\/workspaces\/([^/]+)$/);
      if (adminWsMatch) {
        if (method === 'GET')    return getWorkspaceDetailAdmin(adminWsMatch[1], request, env);
        if (method === 'PUT')    return updateWorkspaceAdmin(adminWsMatch[1], request, env);
        if (method === 'DELETE') return deleteWorkspaceAdmin(adminWsMatch[1], request, env);
      }

      if (path === '/api/admin/users' && method === 'GET') return listAllUsers(request, env);
      const adminUserMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (adminUserMatch && method === 'PATCH') {
        return updateUserAdmin(adminUserMatch[1], request, env);
      }

      // ============ URL Redirect ============
      //
      // mdl.cc/m{code}  — default shared domain; "/m" prefix keeps app routes safe.
      // <branded>/{code} — full hostname dedicated to one workspace.
      if (method === 'GET') {
        const redirect = await routeRedirect(request, env);
        if (redirect) return redirect;
      }

      // Static assets + SPA fallback.
      //
      // With experimental_serve_directly = false, every request runs the Worker
      // first (so the isAppHost gate above can block branded domains). That means
      // asset requests — /assets/app.js, /favicon.ico, etc. — now reach here too,
      // and we must serve the REAL file, not index.html. Ask the ASSETS binding
      // for the requested path; only fall back to index.html (client-side routing)
      // when the asset doesn't exist (a 404 from the binding).
      if (method === 'GET' && !path.startsWith('/api/')) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return asset;
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString()));
      }

      return errorResponse('Not Found', 404);
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error', 500);
    }
  },
};

