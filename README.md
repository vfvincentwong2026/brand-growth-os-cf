# brand-growth-os-cf

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

AI-native brand, marketing, and lead outreach OS on Cloudflare with auto-distillation and auto-triggered skills across visual moodboards, brand/space/packaging, campaign strategy, and Google Maps leads.

## Overview

`brand-growth-os-cf` is an AI-native operational system for end-to-end brand identity, spatial and packaging direction, campaign planning, and outbound lead generation. It pairs a **Cloudflare** control plane (`Workers`, `Workflows` / `Queues`, `D1`, `R2`, and `Pages`) with external runner nodes for browser-heavy scraping and outreach execution.

Instead of relying on static forms or manual prompt repetition, the system tracks project state, **automatically triggers skills**, and **continuously distills decisions, edits, and campaign signals** into reusable brand memory.

## Features

- **Auto-Distillation**: Extracts palette/layout/tone rules, packaging and spatial preferences, messaging patterns, and outreach feedback into structured memory and living brand specs.
- **Auto-Triggered Skills**: Evaluates project state, context, and missing deliverables to route and invoke modular skills automatically.
- **Moodboard & Style Harvesting**: Ingests Pinterest and Behance reference boards and distills visual tags, palettes, and prompt templates.
- **Brand Identity, Space & Packaging**: Generates logo/VI systems, spatial/environment applications, and packaging structure, material, and visual recommendations.
- **Campaign Strategy & Lead Outreach**: Builds promotional plans and pairs Google Maps lead scraping with tailored product introductions and outreach tracking.
- **Edge Control Plane + External Runners**: Runs orchestration, state, assets, and UI on Cloudflare while offloading headless scraping and outbound delivery to external workers over signed webhooks.

## Architecture

```text
[Cloudflare Pages] ──▶ Workspace UI (Projects, Assets, Leads, Distillation Log)
        │
        ▼
[Cloudflare Workers + Workflows / Queues]
  ├── Skill Router     ──▶ Auto-triggers skills from project state & intent
  ├── Auto-Distiller   ──▶ Distills rules & feedback into D1 & R2 assets
  └── Webhook Gateway  ──▶ Handles external scraper & outreach callbacks
        │
        ├──▶ [Cloudflare D1]  (Project state, skills, leads, distilled memory)
        ├──▶ [Cloudflare R2]  (Moodboards, VI assets, packaging & space files)
        └──▶ [AI Gateway]     (Model routing, caching, observability)
        │
        ▼ (Signed Webhooks)
[External Runners] ──▶ Pinterest / Behance / Google Maps scrapers & outreach workers
Directory Structure
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
Workflow
Create Project: Define brand/product context, target audience, and campaign goals.

Harvest & Distill Visuals: Run visual-harvest via external Pinterest/Behance scrapers and distill style attributes into reusable tokens.

Generate Brand, Space & Packaging: Run brand-identity and packaging-space for identity systems, spatial applications, and packaging recommendations; distill approvals into brand memory.

Plan & Execute Outreach: Run promo-strategy and lead-outreach to build campaign plans, ingest Google Maps leads, generate tailored product introductions, and track outreach results.

Distill Feedback: Feed user revisions, asset approvals, and lead responses back into auto-distill to update downstream rules.

Quick Start
Prerequisites
Node.js (LTS) and npm or pnpm

A Cloudflare account configured with wrangler

External runner node(s) for Pinterest, Behance, Google Maps, or outbound messaging tasks

Installation
Bash


git clone https://github.com/<your-org>/brand-growth-os-cf.git
cd brand-growth-os-cf
npm install
Configure D1, R2, KV, Queues / Workflows, and secrets in wrangler.jsonc, then run local migrations and start the dev server:

Bash


npx wrangler d1 migrations apply <YOUR_D1_DATABASE_NAME> --local
npx wrangler dev
Compliance & Safeguards
Scraping & Outreach: Follow target platform terms, rate limits, anti-spam rules, and applicable data privacy laws.

Human Approval: Keep review gates on external outreach and production asset releases.

Contributing
Contributions are welcome. Please open an issue first to discuss major changes.

License
MIT
