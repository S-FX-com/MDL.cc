// MDL.cc - Email handler using Resend

import { Env } from '../types';
import { generateId, jsonResponse, errorResponse, successResponse } from '../utils';
import { getAuthUser } from '../middleware/auth';

interface SendInviteRequest {
  email: string;
  workspaceName: string;
  inviterName?: string;
}

export async function sendInviteEmail(request: Request, env: Env): Promise<Response> {
  if (!env.RESEND_API_KEY) {
    return errorResponse('Email service not configured', 503);
  }

  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  let body: SendInviteRequest;
  try {
    body = await request.json<SendInviteRequest>();
  } catch {
    return errorResponse('Invalid request body', 400);
  }

  const { email, workspaceName } = body;
  if (!email || !workspaceName) return errorResponse('email and workspaceName are required', 400);
  if (!email.includes('@')) return errorResponse('Invalid email address', 400);

  // Find workspace by name that the inviter owns/admins
  const workspace = await env.DB.prepare(`
    SELECT w.id, w.name, w.slug FROM workspaces w
    JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = ? AND w.name = ?
    LIMIT 1
  `).bind(user.id, workspaceName).first<{ id: string; name: string; slug: string }>();

  if (!workspace) return errorResponse('Workspace not found or access denied', 403);

  // Generate a secure token
  const token = generateId() + '-' + generateId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Store invitation in D1
  await env.DB.prepare(`
    INSERT OR REPLACE INTO invitations (id, workspace_id, email, role, invited_by, token, status, expires_at)
    VALUES (?, ?, ?, 'member', ?, ?, 'pending', ?)
  `).bind(generateId(), workspace.id, email.toLowerCase(), user.id, token, expiresAt).run();

  const appUrl = env.ENVIRONMENT === 'production' ? 'https://mdl.cc' : 'http://localhost:5173';
  const inviteLink = `${appUrl}/join?code=${token}`;
  const inviterName = body.inviterName || user.name || user.email;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MDL.cc <invites@mdl.cc>',
      to: [email],
      subject: `You've been invited to ${workspace.name} on MDL.cc`,
      html: buildInviteHtml({ email, workspaceName: workspace.name, inviterName, inviteLink, appUrl }),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Resend error:', res.status, errText);
    return errorResponse('Failed to send invitation email', 502);
  }

  const data = await res.json() as { id: string };
  return jsonResponse({ success: true, messageId: data.id, token });
}

// ── Validate invite token (public) ────────────────────────────────────────────

export async function validateInvite(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return errorResponse('code is required', 400);

  const inv = await env.DB.prepare(`
    SELECT i.id, i.email, i.status, i.expires_at,
           w.id as workspace_id, w.name as workspace_name, w.slug as workspace_slug
    FROM invitations i
    JOIN workspaces w ON w.id = i.workspace_id
    WHERE i.token = ?
  `).bind(code).first<{
    id: string; email: string; status: string; expires_at: string;
    workspace_id: string; workspace_name: string; workspace_slug: string;
  }>();

  if (!inv) return jsonResponse({ success: false, valid: false, error: 'Invitation not found' });
  if (inv.status === 'accepted') return jsonResponse({ success: false, valid: false, error: 'Invitation already used' });
  if (new Date(inv.expires_at) < new Date()) return jsonResponse({ success: false, valid: false, error: 'Invitation has expired' });

  return jsonResponse({
    success: true,
    valid: true,
    invitation: {
      email: inv.email,
      workspace_id: inv.workspace_id,
      workspace_name: inv.workspace_name,
      workspace_slug: inv.workspace_slug,
    },
  });
}

// ── Accept invite (requires auth) ─────────────────────────────────────────────

export async function acceptInvite(request: Request, env: Env): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return errorResponse('Unauthorized', 401);

  let body: { code: string };
  try { body = await request.json(); } catch { return errorResponse('Invalid request body', 400); }
  if (!body.code) return errorResponse('code is required', 400);

  const inv = await env.DB.prepare(`
    SELECT i.id, i.workspace_id, i.status, i.expires_at
    FROM invitations i WHERE i.token = ?
  `).bind(body.code).first<{ id: string; workspace_id: string; status: string; expires_at: string }>();

  if (!inv) return errorResponse('Invitation not found', 404);
  if (inv.status === 'accepted') return errorResponse('Invitation already used', 409);
  if (new Date(inv.expires_at) < new Date()) return errorResponse('Invitation has expired', 410);

  const now = new Date().toISOString();

  // Add user to workspace
  await env.DB.prepare(`
    INSERT OR IGNORE INTO workspace_members (id, workspace_id, user_id, role, joined_at)
    VALUES (?, ?, ?, 'member', ?)
  `).bind(generateId(), inv.workspace_id, user.id, now).run();

  // Mark invitation as accepted
  await env.DB.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ?`).bind(inv.id).run();

  const workspace = await env.DB.prepare('SELECT id, name, slug FROM workspaces WHERE id = ?')
    .bind(inv.workspace_id).first();

  return successResponse({ workspace }, 'Invitation accepted');
}

// ── Email HTML ────────────────────────────────────────────────────────────────

function buildInviteHtml(opts: {
  email: string;
  workspaceName: string;
  inviterName?: string;
  inviteLink: string;
  appUrl: string;
}): string {
  const { email, workspaceName, inviterName, inviteLink, appUrl } = opts;
  const inviterText = inviterName
    ? `<strong style="color:#f8fafc;">${inviterName}</strong> has invited you`
    : 'You have been invited';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You're invited to ${workspaceName} on MDL.cc</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#1e293b;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1456f0;padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">MDL.cc</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">The middle-point between you and your audience</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <h2 style="margin:0 0 16px;color:#f8fafc;font-size:20px;font-weight:600;">You're invited!</h2>
            <p style="margin:0 0 20px;color:#94a3b8;font-size:15px;line-height:1.6;">
              ${inviterText} to join <strong style="color:#1456f0;">${workspaceName}</strong> on MDL.cc.
            </p>
            <p style="margin:0 0 32px;color:#94a3b8;font-size:15px;line-height:1.6;">
              MDL.cc helps teams manage, track, and share short links in one place. Accept your invitation to get started.
            </p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 32px;">
              <tr>
                <td align="center" style="background:#1456f0;border-radius:8px;">
                  <a href="${inviteLink}" style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#64748b;font-size:12px;text-align:center;word-break:break-all;">
              Or paste this link:<br>
              <a href="${inviteLink}" style="color:#1456f0;text-decoration:none;">${inviteLink}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0 0 6px;color:#475569;font-size:12px;">
              This email was sent to ${email}. If you didn't expect this invitation, you can safely ignore it.
            </p>
            <p style="margin:0;color:#475569;font-size:12px;">
              <a href="${appUrl}" style="color:#1456f0;text-decoration:none;">mdl.cc</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
