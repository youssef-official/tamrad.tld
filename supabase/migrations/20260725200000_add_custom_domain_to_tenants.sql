-- Migration: Add custom_domain to tenants for subdomain and custom domain routing
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;

-- Create index on custom_domain for fast hostname lookups
CREATE INDEX IF NOT EXISTS tenants_custom_domain_idx ON public.tenants(custom_domain);
CREATE INDEX IF NOT EXISTS tenants_slug_idx ON public.tenants(slug);
