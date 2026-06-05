<p align="center">
  <img src="web/public/favicon.svg" alt="MDL.cc" width="64" height="64" />
</p>

<h1 align="center">MDL.cc</h1>

<p align="center"><em>The middle-point between you and your audience.</em></p>

A fast, modern URL shortening service built on Cloudflare's global edge network. MDL (pronounced "Middle") serves as the middle-point between you and your audience, with sub-10ms redirects, workspace-based team management, and real-time analytics — all running 100% on Cloudflare.

## Features

- **Ultra-fast redirects** — KV-powered lookups deliver sub-10ms global reads
- **Workspaces** — Each team gets its own workspace with members, roles, and link library
- **Microsoft 365 sign-in** — OAuth2 + PKCE against the multi-tenant `/common` endpoint
- **Email-domain auto-join** — Claim a domain so matching users land in the right workspace on first SSO
- **Invite-only sign-up** — Password sign-ups require a pending invitation; Microsoft sign-ups require a claimed domain or an invite
- **Link management** — Create, edit, group, and organise shortened URLs from a unified dashboard
- **Groups & folders** — Keep campaigns, projects, and teams tidy
- **Real-time analytics** — Clicks, geos, devices, browsers, and referrers, live
- **QR code generation** — Customisable colours, sizes, embed-ready
- **Custom aliases** — Pick your own memorable short codes
- **Password-protected links** — Gate sensitive URLs behind a password
- **Link expiration** — Auto-expire links on a schedule
- **Branded domains** — Bring your own hostname; verified per-workspace
- **Platform superadmin** — A platform-level operator oversees and configures *every* workspace, member, and domain from a single admin backend
- **Light & dark mode** — Adaptive UI

## Tech stack

- **Runtime**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Static assets**: Cloudflare Workers Assets (serves the SPA shell)
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + a scoped CSS layer for the marketing landing
- **Charts**: Recharts
- **Email**: Resend (workspace invitations)

## Brand

The new design system pairs a deep navy field with a cyan accent — same palette used by the favicon, the in-app logo, and the marketing landing.

| Token | Hex | Use |
|---|---|---|
| Primary | `#0C1B30` | Background, dark surfaces |
| Tertiary | `#1C2F47` | Elevated cards |
| Accent | `#00D1F9` | Logo mark, links, focus rings |
| Secondary | `#8888FF` | "Coming soon" / muted highlights |

Typography: **Clash Grotesk** (display), **Inter** (body), **JetBrains Mono** (code/micro-copy).

## Architecture

```
┌────────────────────────── Cloudflare Edge ──────────────────────────┐
│                                                                     │
│   ┌──────────┐     ┌────────────────────┐     ┌─────────────────┐   │
│   │  KV      │ ◄── │  Worker (router)   │ ──► │  D1 (SQLite)    │   │
│   │  cache   │     │  src/worker/*      │     │  schema.sql     │   │
│   └──────────┘     └────────────────────┘     └─────────────────┘   │
│                            │                                        │
│                            ▼                                        │
│                    ┌────────────────────┐                           │
│                    │  Workers Assets    │  ◄── React SPA            │
│                    │  (SPA fallback)    │      web/dist             │
│                    └────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

Every redirect resolves at the edge in <10ms; click events fan out asynchronously so the response is never blocked.

## Project structure

```
MDL.cc/
├── src/worker/                       # Cloudflare Worker (TypeScript)
│   ├── index.ts                      # Router entry point
│   ├── handlers/
│   │   ├── api.ts                    # Links, groups, analytics
│   │   ├── auth.ts                   # Register / login / me (invite-gated)
│   │   ├── microsoft.ts              # OAuth2 + PKCE sign-in
│   │   ├── email.ts                  # Invitation send / validate / accept (Resend)
│   │   ├── workspaces.ts             # Workspace CRUD & membership
│   │   ├── admin.ts                  # Superadmin: oversee/configure all workspaces
│   │   ├── workspaceDomains.ts       # Email-domain claims & auto-join
│   │   ├── domains.ts                # Branded custom domains
│   │   ├── preview.ts                # Open Graph link previews
│   │   ├── qr.ts                     # QR code generation
│   │   └── redirect.ts               # Short-link resolution
│   ├── lib/        (jwt, password)
│   ├── middleware/ (auth)
│   ├── types.ts, utils.ts
├── web/                              # React SPA
│   ├── public/favicon.svg            # Brand mark
│   └── src/
│       ├── pages/
│       │   ├── Landing.tsx + .css    # Public marketing landing (logged-out /)
│       │   ├── Login.tsx             # Password + Microsoft sign-in
│       │   ├── WorkspaceEntry.tsx    # Workspace lookup by slug
│       │   ├── Join.tsx              # Invite acceptance
│       │   ├── Dashboard.tsx, Links.tsx, LinkDetail.tsx,
│       │   ├── Groups.tsx, Analytics.tsx, Invitations.tsx, Settings.tsx
│       │   ├── Admin.tsx              # Platform admin (superadmin only)
│       ├── components/  (Layout, CreateLinkModal, EmailDomainsCard, QRCodeDisplay)
│       ├── contexts/    (AuthContext, ThemeContext, WorkspaceContext)
│       └── lib/         (api, features)
├── migrations/                       # D1 schema
├── wrangler.toml                     # Cloudflare bindings (KV, D1, Assets)
└── package.json
```

## Getting started

### Prerequisites

- Node.js 18+
- A Cloudflare account (for deployment)

### Local development

1. **Install**
   ```bash
   npm install
   ```
   The web app is a workspace, so its deps come along.

2. **Migrate the local D1 database**
   ```bash
   npm run db:migrate:local
   ```

3. **Run**
   ```bash
   npm run dev
   ```
   - Worker on `http://localhost:8787`
   - Vite dev server on `http://localhost:3000` (proxies `/api` to the worker)

   Visit `http://localhost:3000` — logged-out visitors see the marketing landing; the **Sign In** link drops you into the workspace-selection flow.

### Deployment

1. Provision a KV namespace and a D1 database, then update `wrangler.toml` with the IDs.
2. Apply the schema. `migrations/schema.sql` is the canonical, idempotent full
   schema — run it for a **fresh** database:
   ```bash
   npm run db:migrate
   ```
   For an **existing** database provisioned from an older schema, apply only the
   newer incremental migrations (they are additive and safe to run once):
   ```bash
   wrangler d1 execute mdl-db --file=./migrations/0005_invitations.sql
   wrangler d1 execute mdl-db --file=./migrations/0006_groups_tags_workspace_scope.sql
   wrangler d1 execute mdl-db --file=./migrations/0007_superadmin.sql
   ```
   > The numbered files (`0001…`) are the incremental history. Do **not** replay
   > `0002` against a live database — it rebuilds the `domains` table and deletes
   > workspace-less links. A fresh database only needs `schema.sql`.
3. Configure secrets (`wrangler secret put`):
   - `JWT_SECRET` — JWT signing key
   - `PBKDF2_SALT_PREFIX` — server-side salt prefix for password hashing
   - `RESEND_API_KEY` — required for invitation emails
   - `MS_CLIENT_ID`, `MS_CLIENT_SECRET` — required for Microsoft sign-in
   - `SUPERADMIN_EMAILS` (a `[vars]` entry in `wrangler.toml`, not a secret) — comma-separated allowlist that bootstraps the first platform superadmin (see below)
4. Deploy:
   ```bash
   npm run deploy
   ```

## Sign-up policy

Sign-up is **invite-only** by design (the public landing page reflects this with an "Alpha — sign-ups temporarily closed" notice on every sign-up CTA):

- **Password sign-up** at `/api/auth/register` requires a pending invitation matching the email + workspace.
- **Microsoft sign-in** creates a new user only when their email domain is claimed by a workspace with `auto_join_mode = 'auto'`, or a pending invitation matches the email.
- Existing accounts can always sign in.

Invitations are sent via Resend (`POST /api/invites`) and accepted at `/join?code=…`.

## API reference (excerpt)

All management endpoints (links, groups, tags, analytics, dashboard stats,
workspaces, domains, invitations) require a `Authorization: Bearer <jwt>` header
and are scoped to a workspace the caller belongs to — link/group/tag reads and
writes pass a `workspace_id` and are rejected (`403`) for non-members. Only the
public short-link redirect, the invite-validation lookup, and `/api/health` are
unauthenticated.

### Auth
```http
POST /api/auth/login            { email, password }
POST /api/auth/register         { email, password, name, workspace_slug }   # invite-gated
GET  /api/auth/me               Authorization: Bearer <jwt>
GET  /api/auth/microsoft/start
GET  /api/auth/microsoft/callback
```

### Invitations
```http
POST /api/invites               { email, workspaceName, role }
GET  /api/invites/validate?code=<token>
POST /api/invites/accept        { code }
```

### Links
```http
POST /api/links                 { url, workspace_id, custom_code?, title?, group_id?, password? }
GET  /api/links?workspace_id=…&page=1&limit=20&group_id=…&search=…
GET  /api/links/:id/analytics?days=30
```

### QR codes
```http
GET /api/qr?code=my-link&size=256&fg=#000000&bg=#FFFFFF
```

### Workspaces & domains
```http
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:id/invitations
GET    /api/workspaces/:id/email-domains
POST   /api/workspaces/:id/email-domains   { domain, auto_join_mode }
```

### Superadmin (platform-wide)

A **superadmin** is a platform-level operator — distinct from the per-workspace
`owner`/`admin`/`member` roles. They oversee and configure **every** workspace
on the instance. The `/api/admin/*` endpoints are the only API surface that
deliberately bypasses workspace-membership scoping, so each one re-checks the
superadmin status server-side; the web route and the sidebar entry are just UX
guards on top of that.

**Who is a superadmin?** Either source grants it:
1. The user's email is in the `SUPERADMIN_EMAILS` allowlist (bootstrap — the
   first operator is never locked out, even on a fresh database), or
2. Their `users.is_superadmin` flag is set (granted by another superadmin from
   the **Platform Admin → Users** tab).

`GET /api/auth/me` returns an `is_superadmin` boolean so the web app can reveal
the **Platform Admin** sidebar entry and `/admin` page (Overview · Workspaces ·
Users).

```http
GET    /api/admin/overview                              # platform totals + recent workspaces
GET    /api/admin/workspaces?search=…                   # every workspace + owner & counts
GET    /api/admin/workspaces/:id                        # members, domains, counts
PUT    /api/admin/workspaces/:id        { name?, owner_id? }   # rename / transfer ownership
DELETE /api/admin/workspaces/:id                        # delete a workspace + all its data
POST   /api/admin/workspaces/:id/members         { email, role? }
PATCH  /api/admin/workspaces/:id/members/:memberId { role }
DELETE /api/admin/workspaces/:id/members/:memberId
GET    /api/admin/users?search=…                        # every user + workspace count
PATCH  /api/admin/users/:id              { is_superadmin }     # grant / revoke superadmin
```

## Speed optimisations

1. **KV-first lookups** — short-link data is cached for sub-10ms global reads.
2. **Edge-native** — all logic runs on Cloudflare Workers, close to users.
3. **Async analytics** — click tracking never blocks the redirect.
4. **Indexed queries** — D1 indexes on the hot paths (`code`, `workspace_id`).

## Contributing

Contributions welcome — please open an issue first for any non-trivial change.

## License

MIT — see [LICENSE](LICENSE).

---

**MDL.cc** — the middle-point between you and your audience.
