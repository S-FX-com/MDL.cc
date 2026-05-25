// Feature flags surfaced by /api/health. Cached at module level so the SSO
// buttons render instantly on subsequent navigations.

interface Features {
  microsoft_sso: boolean;
}

let cache: Features | null = null;
let inflight: Promise<Features> | null = null;

const DEFAULT: Features = { microsoft_sso: false };

export async function getFeatures(): Promise<Features> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = fetch('/api/health')
    .then(r => r.json())
    .then((data: { features?: Features }) => {
      cache = { ...DEFAULT, ...(data.features || {}) };
      return cache;
    })
    .catch(() => {
      cache = DEFAULT;
      return cache;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
