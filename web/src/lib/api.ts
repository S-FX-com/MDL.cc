// MDL.cc API Client

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return data;
}

// Links
export interface Link {
  id: string;
  short_code: string;
  original_url: string;
  title: string | null;
  description: string | null;
  group_id: string | null;
  password: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  click_count?: number;
  group_name?: string;
  group_color?: string;
  short_url?: string;
  tags?: Tag[];
}

export interface CreateLinkPayload {
  url: string;
  custom_code?: string;
  title?: string;
  description?: string;
  group_id?: string;
  domain_id?: string;
  password?: string;
  expires_at?: string;
  tags?: string[];
}

export interface UpdateLinkPayload {
  url?: string;
  title?: string;
  description?: string;
  group_id?: string | null;
  password?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
  tags?: string[];
}

export interface LinksResponse {
  links: Link[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const links = {
  list: (params?: { page?: number; limit?: number; group_id?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.group_id) searchParams.set('group_id', params.group_id);
    if (params?.search) searchParams.set('search', params.search);
    const query = searchParams.toString();
    return request<LinksResponse>(`/links${query ? `?${query}` : ''}`);
  },

  get: (id: string) => request<Link>(`/links/${id}`),

  create: (payload: CreateLinkPayload) =>
    request<Link>('/links', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: UpdateLinkPayload) =>
    request<Link>(`/links/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<null>(`/links/${id}`, {
      method: 'DELETE',
    }),

  analytics: (id: string, days?: number) => {
    const query = days ? `?days=${days}` : '';
    return request<AnalyticsData>(`/links/${id}/analytics${query}`);
  },
};

// Groups
export interface LinkGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  link_count?: number;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export const groups = {
  list: () => request<LinkGroup[]>('/groups'),

  create: (payload: CreateGroupPayload) =>
    request<LinkGroup>('/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: Partial<CreateGroupPayload>) =>
    request<LinkGroup>(`/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<null>(`/groups/${id}`, {
      method: 'DELETE',
    }),
};

// Tags
export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
  link_count?: number;
}

export const tags = {
  list: () => request<Tag[]>('/tags'),

  create: (payload: { name: string; color?: string }) =>
    request<Tag>('/tags', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// Analytics
export interface AnalyticsData {
  total_clicks: number;
  unique_visitors: number;
  clicks_by_country: { country: string; count: number }[];
  clicks_by_device: { device: string; count: number }[];
  clicks_by_browser: { browser: string; count: number }[];
  clicks_by_date: { date: string; count: number }[];
  top_referers: { referer: string; count: number }[];
}

export interface DashboardStats {
  total_links: number;
  total_clicks: number;
  today_clicks: number;
  recent_links: Link[];
  top_links: Link[];
  weekly_clicks: { date: string; count: number }[];
}

export const stats = {
  dashboard: (linkIds?: string[]) => {
    const qs = linkIds && linkIds.length > 0 ? `?link_ids=${linkIds.join(',')}` : '';
    return request<DashboardStats>(`/stats${qs}`);
  },
};

// QR Code
export const qr = {
  getUrl: (shortCode: string, options?: { size?: number; fg?: string; bg?: string }) => {
    const params = new URLSearchParams({ code: shortCode });
    if (options?.size) params.set('size', String(options.size));
    if (options?.fg) params.set('fg', options.fg);
    if (options?.bg) params.set('bg', options.bg);
    return `${API_BASE}/qr?${params.toString()}`;
  },
};
