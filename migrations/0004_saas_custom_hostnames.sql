-- Cloudflare for SaaS custom-hostname tracking for branded domains.
--
-- When Cloudflare for SaaS is configured (CF_API_TOKEN + CF_ZONE_ID), adding a
-- workspace domain provisions a Custom Hostname on the mdl.cc zone. We persist
-- the hostname id and Cloudflare's reported status + validation records so the
-- UI can show the customer exactly what DNS records to add and reflect live
-- progress. These columns are nullable; the legacy _mdl-verify TXT flow keeps
-- working when SaaS is not configured.

ALTER TABLE domains ADD COLUMN cf_hostname_id TEXT;
ALTER TABLE domains ADD COLUMN cf_status      TEXT;
ALTER TABLE domains ADD COLUMN cf_ssl_status  TEXT;
-- JSON blob: { "cname_target": "...", "records": [{ "type","name","value" }] }
ALTER TABLE domains ADD COLUMN cf_validation  TEXT;

CREATE INDEX IF NOT EXISTS idx_domains_cf_hostname ON domains(cf_hostname_id);
