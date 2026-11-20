# Architecture — brand-growth-os-cf

## 1. Architectural Positioning

`brand-growth-os-cf` adopts a **Split Control-and-Execution Architecture**:

- **Edge Control Plane (Cloudflare)**: `Workers`, `Queues` / `Workflows`, `D1`, `R2`, `KV`, `AI`, and `Pages` handle project state machines, skill routing, context auto-distillation, asset storage, Three.js interactive UI delivery, and outreach orchestration.
- **External Execution Runners**: Headless browser scrapers (Pinterest, Behance, Google Maps) and external delivery/messaging workers run outside edge request limits and communicate back via HMAC-signed webhooks.
- **Interactive 3D & Feedback Loop**: The `Pages` workspace renders packaging and spatial scenes in **Three.js** using R2-backed textures and scene specs, emitting viewport/material/review events back into Workers for secondary distillation.

---

## 2. Core Subsystems & Data Flows

### 2.1 Auto-Triggered Skill Engine (`src/router/skill-engine.ts`)
- Reads project state (`brief`, moodboard availability, brand identity status, 3D scene status, campaign plan, pending leads, and un-distilled feedback count).
- Emits prioritized `TriggerDecision` items, records `skill_runs` in `D1`, and enqueues tasks onto `SKILL_QUEUE`.

### 2.2 Pinterest Auto-Matching (`src/matchers/pinterest-matcher.ts`)
1. Synthesizes multi-axis search queries from industry, mood keywords, brand keywords, and visual domain (`brand_vi`, `packaging`, `spatial_3d`, `campaign`).
2. Receives candidate pins from external Pinterest scrapers, deduplicates by `perceptualHash`, filters low-resolution/forbidden keywords, and scores candidates.
3. Persists ranked candidates in `reference_pins` (`D1`) and binds R2 assets for downstream style token extraction.

### 2.3 Auto-Distillation Engine (`src/distiller/auto-distill.ts`)
- Consumes design approvals, Three.js material/lighting tweaks, campaign edits, and lead outreach outcomes.
- Extracts structured rules (`domain`, `rule_key`, `rule_content`, `confidence`) into `distilled_rules` (`D1`).
- Rebuilds the living `brand_spec_markdown` in `D1` and caches it in `BRAND_CACHE` (`KV`) so subsequent skills inherit accumulated constraints automatically.

### 2.4 Skills & Outreach Pipeline (`src/index.ts` + `src/skills/*`)
- `visual-harvest`: Consumes matched moodboard references and updates `style_tokens_json`.
- `brand-identity`: Produces identity tokens, logo/VI guidelines, and brand rules.
- `packaging-space`: Generates packaging structures, material/finish recommendations, spatial layouts, and `three_scenes` JSON payloads.
- `promo-strategy`: Builds campaign strategy and channel messaging tailored to distilled brand memory.
- `lead-outreach`: Scores Google Maps leads in `leads`, generates tailored product introductions, and queues approved outreach jobs onto `OUTREACH_QUEUE`.

---

## 3. State Machine & Storage Boundaries

| Layer | Cloudflare Primitive | Responsibility |
| --- | --- | --- |
| UI & 3D Viewport | `Cloudflare Pages` + `Three.js` | Project cockpit, moodboard review, 3D packaging/spatial inspection, lead queue |
| Edge API & Workers | `Cloudflare Workers` | REST/Webhook endpoints, HMAC verification, `SKILL_QUEUE` & `OUTREACH_QUEUE` consumers |
| Relational State | `Cloudflare D1` | `projects`, `reference_pins`, `three_scenes`, `distilled_rules`, `skill_runs`, `leads` |
| Binary & Scene Assets | `Cloudflare R2` (`ASSETS_BUCKET`) | Reference images, PBR textures, GLTF/GLB & scene JSON bundles, VI/packaging exports |
| Hot Read Cache | `Cloudflare KV` (`BRAND_CACHE`) | Cached living brand specs (`brand_spec:<projectId>`) and fast lookup state |
| Model Inference | `Workers AI` / `AI Gateway` | Rule distillation, query/copy generation, multimodal scoring |

---

## 4. Security & Reliability Boundaries

- **Signed Webhooks**: External scrapers and outreach runners must sign payloads with `X-Signature-HMAC-SHA256` verified against `WEBHOOK_SIGNING_SECRET`.
- **Idempotency & Retries**: Queue consumers should treat messages as at-least-once and write deterministic state transitions to `D1`.
- **Human-in-the-Loop Gate**: When `OUTREACH_REQUIRE_APPROVAL` is enabled, generated pitches stay in `draft_ready` until explicitly approved before `OUTREACH_QUEUE` dispatch.
