<div align="center">

# brand-growth-os-cf

**AI-Native Brand Identity, Three.js Spatial & Packaging Studio, Campaign Strategy, and Outbound Lead Outreach OS on Cloudflare**

*Auto-distilled brand memory · Auto-triggered skills · Pinterest visual matching · Real-time Three.js 3D previews*

[![License: MIT](https://img.shields.io/badge/License-MIT-111827?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20D1%20%7C%20R2%20%7C%20Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Three.js](https://img.shields.io/badge/Three.js-Real--Time%203D-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

</div>

---

## Overview

`brand-growth-os-cf` is an AI-native operational system for end-to-end brand creation, spatial and packaging design, campaign planning, and outbound lead outreach. It pairs a **Cloudflare** edge control plane (`Workers`, `Workflows` / `Queues`, `D1`, `R2`, and `Pages`) with external runner nodes for browser-heavy scraping and outreach execution, and a browser-native **Three.js** viewport for real-time 3D packaging and spatial inspection.

Rather than acting as a static dashboard or a single-turn prompt wrapper, `brand-growth-os-cf` operates around **state-driven skill execution**, **continuous auto-distillation**, **Pinterest auto-matching**, and **closed-loop 3D & campaign feedback**.

---

## Core Pillars

### 1. Auto-Distillation Engine (`auto-distill` & `scene-feedback-distill`)
- **Living Brand Memory**: Distills approved palettes, typography rules, logo usage constraints, and tone guidelines into structured memory and living brand specifications.
- **3D & Packaging Feedback Loop**: Captures Three.js material roughness, metallic/finish choices, lighting setups, and spatial layout adjustments, distilling them into reusable design and production rules.
- **Campaign & Outreach Learning**: Extracts high-performing campaign hooks, channel angles, and lead response signals to refine future copy and targeting.

### 2. Auto-Triggered Skill Routing (`skill-engine` & `trigger-rules`)
- **State & Context Aware**: Inspects project stage, asset completeness, matched moodboard signals, and user intent to route and trigger modular skills automatically.
- **Event & Webhook Driven**: Responds to workspace actions, workflow steps, scheduled runs, and signed callbacks from external scraper and outreach nodes.

### 3. Pinterest Auto-Matching Pipeline (`pinterest-matcher`)
- **Multi-Axis Query Synthesis**: Expands project attributes (category, brand tone, packaging form factor, spatial typology, and distilled brand rules) into targeted search queries.
- **Deduplication & Noise Filtering**: Deduplicates candidate pins via perceptual hashes and URL fingerprints while filtering out low-resolution assets, watermarks, and off-brand noise.
- **Multimodal Scoring & Diversity Balancing**: Ranks candidates on intent alignment, palette/material harmony, anti-pattern exclusion, and visual diversity, then binds top matches into R2/D1 and distills style tokens for downstream skills.

### 4. Brand Identity, Packaging & Three.js Spatial Rendering (`brand-identity` & `packaging-space`)
- **Identity & VI System**: Generates brand positioning, logo concepts, color/typography tokens, and visual identity guidelines.
- **Packaging & Spatial Direction**: Recommends structural packaging formats, substrates, finishes, and retail/exhibition/storefront spatial applications.
- **Real-Time Three.js Viewport**: Compiles structured scene, lighting, camera preset, and PBR material configs backed by R2 textures for interactive browser inspection.

### 5. Campaign Strategy & Google Maps Lead Outreach (`promo-strategy` & `lead-outreach`)
- **Go-to-Market & Campaign Planning**: Builds launch campaigns, content pillars, and audience-specific messaging grounded in distilled brand memory.
- **Lead Ingestion & Tailored Outreach**: Consumes Google Maps leads from external runners, scores prospect fit, drafts tailored product introductions, queues outreach workflows, and logs outcomes.

---

## System Architecture

```text
+-------------------------------------------------------------------+
|               Cloudflare Pages (Workspace & Three.js UI)          |
|  [3D Packaging & Spatial Stage]  [Moodboard]  [Brand]  [Leads]   |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|           Cloudflare Workers + Workflows / Queues (Edge Core)     |
|   [Skill Router]   [Pinterest Matcher]   [Auto-Distiller]         |
|   [Webhook Gateway]                                               |
+---------+------------------------+------------------------+-----+
          |                        |                        |
          v                        v                        v
+-------------------+    +-------------------+    +-------------------+
|   Cloudflare D1   |    |   Cloudflare R2   |    |    AI Gateway     |
| State, Rules,     |    | Pins, PBR Maps,   |    | Model Routing,    |
| Leads, Audit Logs |    | 3D Scenes, VI Kit |    | Caching & Metrics |
+-------------------+    +-------------------+    +-------------------+
                                  ^
                                  | Signed Webhooks
+---------------------------------+---------------------------------+
|         External Execution Nodes (Scrapers & Outreach Runners)    |
|   [Pinterest / Behance Scrapers]   [Google Maps Lead Runner]      |
|   [Outreach & Delivery Workers]                                   |
+-------------------------------------------------------------------+
Repository Structure
Plaintext


brand-growth-os-cf/
├── wrangler.jsonc
├── migrations/
│   └── 0001_init.sql
├── examples/
│   └── sample-output-lima-rasa.md
├── src/
│   ├── index.ts
│   ├── router/
│   │   ├── skill-engine.ts
│   │   └── trigger-rules.ts
│   ├── matchers/
│   │   └── pinterest-matcher.ts
│   ├── distiller/
│   │   ├── auto-distill.ts
│   │   └── scene-feedback-distill.ts
│   ├── skills/
│   │   ├── visual-harvest.ts
│   │   ├── brand-identity.ts
│   │   ├── packaging-space.ts
│   │   ├── promo-strategy.ts
│   │   └── lead-outreach.ts
│   └── connectors/
│       └── scraper-webhook.ts
└── web/
    ├── src/
    │   ├── three/
    │   │   ├── SceneCanvas.ts
    │   │   ├── PackagingBuilder.ts
    │   │   └── SpatialStage.ts
    │   └── workspace/
    └── package.json
End-to-End Lifecycle
Initialize Brief: Create a project with brand/product context, target market, and objectives.

Match & Distill Visuals: pinterest-matcher and visual-harvest ingest and score Pinterest/Behance references, storing media in R2 and distilling style tokens into D1.

Build Identity, Packaging & 3D Scene: brand-identity and packaging-space generate identity systems, packaging/spatial recommendations, and Three.js scene/PBR configs.

Inspect & Distill in 3D: Review and tune packaging finishes, lighting, and spatial presets in Three.js; scene-feedback-distill persists approved parameters as reusable rules.

Launch & Outreach Loop: promo-strategy and lead-outreach generate campaign plans, process Google Maps leads, draft tailored product introductions, track responses, and feed outcomes back into auto-distill.

Quick Start
Prerequisites
Node.js (LTS) and npm or pnpm

A Cloudflare account authenticated with wrangler

External runner node(s) for Pinterest, Behance, Google Maps, or outbound messaging tasks

Setup
Bash


git clone [https://github.com/](https://github.com/)<your-org>/brand-growth-os-cf.git
cd brand-growth-os-cf
npm install
Configure D1, R2, KV, Queues / Workflows, AI Gateway, and secrets in wrangler.jsonc, apply migrations, and run locally:

Bash


npx wrangler d1 migrations apply <YOUR_D1_DATABASE_NAME> --local
npx wrangler dev
Operational & Compliance Guidelines
3D Scene Performance: Optimize textures, polygon budgets, and lighting setups in Three.js so interactive previews run smoothly across desktop and mobile viewports.

Scraping & Outreach Compliance: Ensure external scraping and outbound messaging workflows adhere to target platform terms, rate limits, anti-spam rules, and data privacy regulations.

Human-in-the-Loop: Keep explicit review gates before sending external outreach or releasing production assets.

Contributing
Contributions, issues, and feature proposals are welcome. Please open an issue first to discuss major architectural, matching, skill, or 3D pipeline changes.

License
MIT
