# Deployment & Operations Guide — brand-growth-os-cf

## 1. Provision Cloudflare Resources

Create the required bindings in your Cloudflare account and record the returned IDs into `wrangler.jsonc`:

```bash
# 1. D1 database
npx wrangler d1 create brand-growth-os-db

# 2. R2 bucket for reference pins, PBR textures, and scene bundles
npx wrangler r2 bucket create brand-growth-os-assets

# 3. KV namespace for cached living brand specs and style tokens
npx wrangler kv namespace create BRAND_CACHE

# 4. Queues for async skill execution and approved outreach delivery
npx wrangler queues create brand-growth-skill-jobs
npx wrangler queues create brand-growth-outreach-jobs
