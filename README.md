# brand-growth-os-cf
AI-native brand, marketing, and lead outreach OS on Cloudflare with auto-distillation and auto-triggered skills across visual moodboards, brand/space/packaging, campaign strategy, and Google Maps leads.
# brand-growth-os-cf

AI-native brand, marketing, and lead outreach OS on Cloudflare with auto-distillation and auto-triggered skills across visual moodboards, brand/space/packaging, campaign strategy, and Google Maps leads.

## Overview

`brand-growth-os-cf` is an AI-native operational system designed for end-to-end brand building, spatial and packaging direction, campaign planning, and outbound lead generation. It pairs a **Cloudflare** control plane (`Workers`, `Workflows` / `Queues`, `D1`, `R2`, and `Pages`) with external execution workers for browser-heavy scraping and outreach delivery.

Instead of relying on static forms or manual prompt repetition, the system tracks project state, **automatically triggers relevant skills**, and **continuously distills decisions, feedback, and campaign signals** into reusable brand memory.

## Key Capabilities

- **Auto-Distillation**: Extracts color/layout/tone rules, packaging and spatial preferences, messaging insights, and outreach feedback into structured memory and living brand specs.
- **Auto-Triggered Skills**: Evaluates project stage, context, and missing deliverables to route and trigger modular skills automatically.
- **Visual Moodboard & Style Harvesting**: Ingests Pinterest and Behance reference boards and distills visual tags, palettes, and prompt templates.
- **Brand Identity, Space & Packaging**: Generates logo/VI systems, spatial/environment applications, and packaging structure, material, and visual recommendations.
- **Campaign Strategy & Lead Outreach**: Builds go-to-market/promotional plans and pairs Google Maps lead scraping with tailored product introductions and outreach tracking.
- **Edge-First Architecture with External Runners**: Keeps orchestration, state, assets, and UI on Cloudflare while offloading headless scraping and external messaging/email delivery to dedicated worker nodes via signed webhooks.

## Architecture

```text
[ Cloudflare Pages ]  ──▶  Workspace UI (Projects, Assets, Leads, Distillation Log)
         │
         ▼
[ Cloudflare Workers + Workflows / Queues ]
  ├── Skill Router      ──▶  Auto-triggers skills based on project state & intent
  ├── Auto-Distiller    ──▶  Distills rules & feedback into D1 & R2 assets
  └── Webhook Gateway   ──▶  Receives external scraper & outreach callbacks
         │
         ├──▶ [ Cloudflare D1 ]  (Project state, skills, leads, distilled memory)
         ├──▶ [ Cloudflare R2 ]  (Moodboards, VI assets, packaging/space files)
         └──▶ [ AI Gateway ]     (Model routing, caching, observability)
         │
         ▼ (Signed Webhooks)
[ External Execution Nodes ]  ──▶  Pinterest / Behance / Google Maps scrapers & outreach runners
Project Structure
Plaintext


brand-growth-os-cf/
├── wrangler.jsonc
├── migrations/
│   └── 0001_init.sql
├── src/
│   ├── index.ts
│   ├── router/
│   │   └── skill-engine.ts
│   ├── distiller/
│   │   └── auto-distill.ts
│   ├── skills/
│   │   ├── visual-harvest.ts
│   │   ├── brand-identity.ts
│   │   ├── packaging-space.ts
│   │   ├── promo-strategy.ts
│   │   └── lead-outreach.ts
│   └── connectors/
│       └── scraper-webhook.ts
└── web/
Core Workflow
Initialize Project: Create a project brief with brand/product context, target market, and goals.

Harvest & Distill Visuals: Trigger visual-harvest via external Pinterest/Behance scrapers and distill style attributes into reusable visual tokens.

Generate Brand, Space & Packaging: Trigger brand-identity and packaging-space to produce identity systems, spatial applications, and packaging recommendations; distill approvals into brand memory.

Plan & Execute Outreach: Trigger promo-strategy and lead-outreach to generate campaign plans, ingest Google Maps leads, craft tailored product introductions, and log outreach outcomes.

Continuous Distillation: Feed user edits, asset approvals, and lead responses back into auto-distill to refine future outputs.

Getting Started
Prerequisites
Node.js (LTS) and npm / pnpm

A Cloudflare account with wrangler authenticated

External scraper/outreach runner(s) if running live Pinterest, Behance, Google Maps, or outbound messaging jobs

Local Setup
Bash


git clone [https://github.com/](https://github.com/)<your-org>/brand-growth-os-cf.git
cd brand-growth-os-cf
npm install
Configure bindings (D1, R2, KV, Queues / Workflows, and secrets) in wrangler.jsonc, then apply database migrations:

Bash


npx wrangler d1 migrations apply <YOUR_D1_DATABASE_NAME> --local
npx wrangler dev
Compliance & Operational Notes
Scraping & Outreach: Ensure external scraping and outbound messaging workflows comply with target platform terms, rate limits, anti-spam rules, and applicable data privacy regulations.

Human-in-the-Loop: Use approval gates for external outreach and production asset releases to prevent unintended sends or off-brand outputs.

Contributing
Issues and pull requests are welcome. Please open an issue first to discuss major architectural or skill-schema changes.

License
MIT
