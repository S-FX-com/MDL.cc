// MDL.cc Type Definitions

export interface Env {
  URL_KV: KVNamespace;
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  APP_NAME: string;
  APP_TAGLINE: string;
  RESEND_API_KEY: string;
  JWT_SECRET: string;
  PBKDF2_SALT_PREFIX: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface Link {
  id: string;
  user_id: string | null;
  group_id: string | null;
  domain_id: string | null;
  short_code: string;
  original_url: string;
  title: string | null;
  description: string | null;
  password: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface LinkGroup {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface Click {
  id: string;
  link_id: string;
  timestamp: string;
  country: string | null;
  city: string | null;
  region: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  referer: string | null;
  ip_hash: string | null;
}

export interface DailyStats {
  id: string;
  link_id: string;
  date: string;
  click_count: number;
  unique_visitors: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  user_id: string;
  domain: string;
  verified: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface QRConfig {
  id: string;
  link_id: string;
  foreground_color: string;
  background_color: string;
  logo_url: string | null;
  size: number;
  error_correction: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLinkRequest {
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

export interface UpdateLinkRequest {
  url?: string;
  title?: string;
  description?: string;
  group_id?: string | null;
  password?: string | null;
  expires_at?: string | null;
  is_active?: boolean;
  tags?: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LinkWithStats extends Link {
  click_count: number;
  tags: Tag[];
  group?: LinkGroup;
}

export interface AnalyticsData {
  total_clicks: number;
  unique_visitors: number;
  clicks_by_country: { country: string; count: number }[];
  clicks_by_device: { device: string; count: number }[];
  clicks_by_browser: { browser: string; count: number }[];
  clicks_by_date: { date: string; count: number }[];
  top_referers: { referer: string; count: number }[];
}

// KV stored link data for fast redirects
export interface KVLinkData {
  url: string;
  password?: string;
  expires_at?: string;
  is_active: boolean;
  link_id: string;
}
