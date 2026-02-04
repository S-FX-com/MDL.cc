# MDL.cc

**The middle-point between you and your audience.**

A fast, modern URL shortening service built on Cloudflare's global edge network. MDL (pronounced "Middle") serves as the middle-point, connecting you to your audience with lightning-fast redirects and comprehensive analytics.

## Features

- **Ultra-Fast Redirects**: KV-powered lookups for sub-10ms global redirects
- **Link Management**: Create, edit, and organize your shortened URLs
- **Groups & Folders**: Organize links by campaign, project, or category
- **Real-time Analytics**: Track clicks, geographic data, devices, browsers, and referrers
- **QR Code Generation**: Generate customizable QR codes for any link
- **Custom Aliases**: Choose your own memorable short codes
- **Password Protection**: Secure sensitive links with passwords
- **Link Expiration**: Set automatic expiration dates
- **Light & Dark Mode**: Beautiful UI that adapts to your preference
- **Branded Links**: Support for custom domains (coming soon)

## Tech Stack

- **Runtime**: Cloudflare Workers (Edge)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV (Key-Value Store)
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Edge Network                   │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────┐ │
│  │   KV Store    │    │    Worker     │    │     D1      │ │
│  │  (URL Cache)  │◄───│   (Router)    │───►│  (Database) │ │
│  └───────────────┘    └───────────────┘    └─────────────┘ │
│          ▲                   │                              │
│          │                   ▼                              │
│          │            ┌───────────────┐                     │
│          └────────────│  Static Site  │                     │
│                       │   (React SPA) │                     │
│                       └───────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
MDL.cc/
├── src/
│   └── worker/           # Cloudflare Worker code
│       ├── index.ts      # Main entry point & router
│       ├── types.ts      # TypeScript type definitions
│       ├── utils.ts      # Utility functions
│       └── handlers/     # Request handlers
│           ├── redirect.ts  # URL redirect logic
│           ├── api.ts       # REST API endpoints
│           └── qr.ts        # QR code generation
├── web/                  # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── contexts/     # React contexts (Theme)
│   │   ├── lib/          # API client & utilities
│   │   └── pages/        # Page components
│   └── public/           # Static assets
├── migrations/           # D1 database migrations
├── wrangler.toml         # Cloudflare configuration
└── package.json          # Dependencies & scripts
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/MDL.cc.git
   cd MDL.cc
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd web && npm install && cd ..
   ```

3. **Set up local database**
   ```bash
   npm run db:migrate:local
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Cloudflare Worker on `http://localhost:8787`
   - React frontend on `http://localhost:3000`

### Deployment

1. **Configure Cloudflare**
   - Create a KV namespace named `mdl_urls_kv`
   - Create a D1 database named `mdl-db`
   - Update `wrangler.toml` with your resource IDs

2. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

3. **Deploy**
   ```bash
   npm run deploy
   ```

## API Reference

### Create Link
```http
POST /api/links
Content-Type: application/json

{
  "url": "https://example.com/long-url",
  "custom_code": "my-link",    // optional
  "title": "My Link",          // optional
  "group_id": "...",           // optional
  "password": "secret"         // optional
}
```

### Get Links
```http
GET /api/links?page=1&limit=20&group_id=...&search=...
```

### Get Link Analytics
```http
GET /api/links/:id/analytics?days=30
```

### Generate QR Code
```http
GET /api/qr?code=my-link&size=256&fg=#000000&bg=#FFFFFF
```

## Speed Optimizations

1. **KV-First Lookups**: Short URL data is cached in Cloudflare KV for sub-10ms global reads
2. **Edge Computing**: All logic runs on Cloudflare's edge, close to users worldwide
3. **Async Analytics**: Click tracking runs asynchronously, never blocking redirects
4. **Efficient Queries**: Database indexes on frequently queried columns

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting a PR.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**MDL.cc** - The middle-point between you and your audience.
