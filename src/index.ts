import { AutoDistiller, type DistillDomain } from "./distiller/auto-distill";
import { PinterestMatcher, type PinterestCandidatePin, type VisualIntentDomain } from "./matchers/pinterest-matcher";
import { SkillEngine, type ProjectSnapshot, type SkillName, type TriggerDecision } from "./router/skill-engine";

export interface Env {
  DB: D1Database;
  ASSETS_BUCKET: R2Bucket;
  BRAND_CACHE: KVNamespace;
  SKILL_QUEUE: Queue;
  OUTREACH_QUEUE: Queue;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
  VISION_MODEL: string;
  PINTEREST_MIN_SCORE: string;
  OUTREACH_REQUIRE_APPROVAL: string;
  WEBHOOK_SIGNING_SECRET?: string;
}

interface QueueEnvelope {
  runId: string;
  skill: SkillName;
  reason: string;
  priority: number;
  payload: Record<string, unknown>;
}

interface OutreachEnvelope {
  leadId: string;
  projectId: string;
  placeName: string;
  email?: string;
  phone?: string;
  tailoredPitch: string;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret?: string
): Promise<boolean> {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const normalizedHex = signatureHeader.replace(/^sha256=/i, "").trim();
  if (!/^[0-9a-fA-F]+$/.test(normalizedHex) || normalizedHex.length % 2 !== 0) {
    return false;
  }

  const sigBytes = new Uint8Array(normalizedHex.length / 2);
  for (let i = 0; i < normalizedHex.length; i += 2) {
    sigBytes[i / 2] = parseInt(normalizedHex.slice(i, i + 2), 16);
  }

  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
}

async function buildProjectSnapshot(db: D1Database, projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db
    .prepare(`SELECT id, name, industry, stage, style_tokens_json, brand_spec_markdown FROM projects WHERE id = ?1`)
    .bind(projectId)
    .first<{
      id: string;
      name: string;
      industry: string;
      stage: string;
      style_tokens_json: string;
      brand_spec_markdown: string;
    }>();

  if (!project) return null;

  const moodCount = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM reference_pins WHERE project_id = ?1 AND is_selected = 1`)
    .bind(projectId)
    .first<{ cnt: number }>();

  const sceneCount = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM three_scenes WHERE project_id = ?1`)
    .bind(projectId)
    .first<{ cnt: number }>();

  const leadCount = await db
    .prepare(`SELECT COUNT(*) AS cnt FROM leads WHERE project_id = ?1 AND outreach_status = 'pending_draft'`)
    .bind(projectId)
    .first<{ cnt: number }>();

  const pendingRuns = await db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM skill_runs WHERE project_id = ?1 AND skill_name = 'auto-distill' AND status = 'queued'`
    )
    .bind(projectId)
    .first<{ cnt: number }>();

  const hasBrandIdentity =
    Boolean(project.brand_spec_markdown && project.brand_spec_markdown.includes("## Auto-Distilled Rules")) ||
    ["identity_ready", "space_3d_ready", "campaign_ready", "outreach_active"].includes(project.stage);

  const hasCampaignPlan = ["campaign_ready", "outreach_active"].includes(project.stage);

  return {
    id: project.id,
    name: project.name,
    industry: project.industry,
    stage: project.stage,
    hasMoodboard: (moodCount?.cnt ?? 0) > 0,
    hasBrandIdentity,
    hasPackagingAnd3D: (sceneCount?.cnt ?? 0) > 0,
    hasCampaignPlan,
    hasLeadsToProcess: (leadCount?.cnt ?? 0) > 0,
    pendingFeedbackCount: pendingRuns?.cnt ?? 0,
  };
}

async function executeSkillRun(env: Env, job: QueueEnvelope): Promise<void> {
  const projectId = String(job.payload.projectId ?? "");
  if (!projectId) return;

  await env.DB.prepare(`UPDATE skill_runs SET status = 'running' WHERE id = ?1`).bind(job.runId).run();

  try {
    if (job.skill === "auto-distill") {
      const distiller = new AutoDistiller(env);
      const domain = (job.payload.domain as DistillDomain) || "visual";
      const summary = String(job.payload.summary ?? job.reason);
      await distiller.distillFeedback({
        projectId,
        domain,
        sourceEvent: String(job.payload.eventType ?? "queued_feedback"),
        summary,
        rawContext: job.payload,
      });
    } else if (job.skill === "visual-harvest") {
      const matcher = new PinterestMatcher();
      const project = await env.DB.prepare(`SELECT industry, brief_json FROM projects WHERE id = ?1`)
        .bind(projectId)
        .first<{ industry: string; brief_json: string }>();
      const brief = project?.brief_json ? JSON.parse(project.brief_json) : {};
      const queries = matcher.buildSearchQueries({
        projectId,
        industry: project?.industry ?? "brand",
        brandKeywords: Array.isArray(brief.brandKeywords) ? brief.brandKeywords : [],
        moodKeywords: Array.isArray(brief.moodKeywords) ? brief.moodKeywords : ["editorial", "minimalist"],
        forbiddenKeywords: Array.isArray(brief.forbiddenKeywords) ? brief.forbiddenKeywords : [],
        intentDomain: (job.payload.intentDomain as VisualIntentDomain) || "packaging",
        minScore: Number(env.PINTEREST_MIN_SCORE || "0.75"),
        targetCount: 12,
      });

      await env.BRAND_CACHE.put(`pinterest_queries:${projectId}`, JSON.stringify(queries), {
        expirationTtl: 3600,
      });
      await env.DB.prepare(`UPDATE projects SET stage = 'visual_harvested', updated_at = datetime('now') WHERE id = ?1`)
        .bind(projectId)
        .run();
    } else if (job.skill === "brand-identity") {
      const distiller = new AutoDistiller(env);
      await distiller.rebuildLivingBrandSpec(projectId);
      await env.DB.prepare(`UPDATE projects SET stage = 'identity_ready', updated_at = datetime('now') WHERE id = ?1`)
        .bind(projectId)
        .run();
    } else if (job.skill === "packaging-space") {
      const sceneId = crypto.randomUUID();
      const defaultScene = {
        scene_id: sceneId,
        renderer: "three.js",
        camera_presets: [
          { name: "hero_view", position: [2.0, 1.5, 2.6], target: [0, 0.8, 0] },
          { name: "spatial_overview", position: [4.5, 2.4, 4.5], target: [0, 1.2, 0] },
        ],
        materials: [
          {
            mesh_target: "primary_packaging",
            type: "MeshStandardMaterial",
            roughness: 0.72,
            metalness: 0.05,
          },
        ],
      };
      await env.DB.prepare(
        `INSERT INTO three_scenes (id, project_id, scene_type, scene_json, version)
         VALUES (?1, ?2, 'combined', ?3, 1)`
      )
        .bind(sceneId, projectId, JSON.stringify(defaultScene))
        .run();
      await env.DB.prepare(`UPDATE projects SET stage = 'space_3d_ready', updated_at = datetime('now') WHERE id = ?1`)
        .bind(projectId)
        .run();
    } else if (job.skill === "promo-strategy") {
      await env.DB.prepare(`UPDATE projects SET stage = 'campaign_ready', updated_at = datetime('now') WHERE id = ?1`)
        .bind(projectId)
        .run();
    } else if (job.skill === "lead-outreach") {
      const leadsRes = await env.DB.prepare(
        `SELECT id, place_name, category, email, phone FROM leads WHERE project_id = ?1 AND outreach_status = 'pending_draft' LIMIT 25`
      )
        .bind(projectId)
        .all<{ id: string; place_name: string; category: string | null; email: string | null; phone: string | null }>();

      const requireApproval = (env.OUTREACH_REQUIRE_APPROVAL || "true").toLowerCase() === "true";
      for (const lead of leadsRes.results ?? []) {
        const pitch = `Hello ${lead.place_name} team — we tailor brand identity, tactile packaging/spatial presentation, and campaign rollouts for ${lead.category || "local businesses"}. Would you be open to a brief product introduction?`;
        const nextStatus = requireApproval ? "draft_ready" : "approved";
        await env.DB.prepare(
          `UPDATE leads SET tailored_pitch = ?1, outreach_status = ?2, fit_score = COALESCE(NULLIF(fit_score, 0), 0.8) WHERE id = ?3`
        )
          .bind(pitch, nextStatus, lead.id)
          .run();

        if (!requireApproval) {
          const envelope: OutreachEnvelope = {
            leadId: lead.id,
            projectId,
            placeName: lead.place_name,
            email: lead.email ?? undefined,
            phone: lead.phone ?? undefined,
            tailoredPitch: pitch,
          };
          await env.OUTREACH_QUEUE.send(envelope);
        }
      }
    }

    await env.DB.prepare(
      `UPDATE skill_runs SET status = 'completed', output_json = ?1 WHERE id = ?2`
    )
      .bind(JSON.stringify({ completedAt: new Date().toISOString() }), job.runId)
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await env.DB.prepare(
      `UPDATE skill_runs SET status = 'failed', output_json = ?1 WHERE id = ?2`
    )
      .bind(JSON.stringify({ error: message }), job.runId)
      .run();
    throw err;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === "/health" && method === "GET") {
      return jsonResponse({ ok: true, service: "brand-growth-os-cf", timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/api/projects" && method === "POST") {
      const body = (await request.json()) as {
        name: string;
        industry: string;
        brief?: Record<string, unknown>;
      };
      if (!body.name || !body.industry) {
        return jsonResponse({ error: "name and industry are required" }, 400);
      }

      const id = `proj_${crypto.randomUUID().slice(0, 8)}`;
      await env.DB.prepare(
        `INSERT INTO projects (id, name, industry, stage, brief_json)
         VALUES (?1, ?2, ?3, 'brief_created', ?4)`
      )
        .bind(id, body.name, body.industry, JSON.stringify(body.brief ?? {}))
        .run();

      const engine = new SkillEngine(env);
      const snapshot = await buildProjectSnapshot(env.DB, id);
      const triggered: TriggerDecision[] = snapshot
        ? await engine.evaluateAndTrigger(snapshot, "project_created", { brief: body.brief ?? {} })
        : [];

      return jsonResponse({ projectId: id, triggered }, 201);
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && method === "GET") {
      const projectId = projectMatch[1];
      const project = await env.DB.prepare(`SELECT * FROM projects WHERE id = ?1`).bind(projectId).first();
      if (!project) return jsonResponse({ error: "project not found" }, 404);

      const rules = await env.DB.prepare(
        `SELECT id, domain, rule_key, rule_content, confidence, source_event, created_at
         FROM distilled_rules WHERE project_id = ?1 ORDER BY created_at DESC`
      )
        .bind(projectId)
        .all();

      const scenes = await env.DB.prepare(
        `SELECT id, scene_type, scene_json, version, created_at
         FROM three_scenes WHERE project_id = ?1 ORDER BY version DESC`
      )
        .bind(projectId)
        .all();

      return jsonResponse({
        project,
        distilledRules: rules.results ?? [],
        threeScenes: scenes.results ?? [],
      });
    }

    const feedbackMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/feedback$/);
    if (feedbackMatch && method === "POST") {
      const projectId = feedbackMatch[1];
      const body = (await request.json()) as {
        domain: DistillDomain;
        sourceEvent?: string;
        summary: string;
        rawContext?: Record<string, unknown>;
      };

      const distiller = new AutoDistiller(env);
      const rules = await distiller.distillFeedback({
        projectId,
        domain: body.domain || "visual",
        sourceEvent: body.sourceEvent || "user_feedback",
        summary: body.summary,
        rawContext: body.rawContext ?? {},
      });

      const engine = new SkillEngine(env);
      const snapshot = await buildProjectSnapshot(env.DB, projectId);
      const triggered = snapshot
        ? await engine.evaluateAndTrigger(snapshot, "feedback_submitted", {
            domain: body.domain,
            rawContext: body.rawContext ?? {},
          })
        : [];

      return jsonResponse({ distilledRules: rules, triggered });
    }

    if (url.pathname === "/webhooks/scraper" && method === "POST") {
      const rawBody = await request.text();
      const sig = request.headers.get("x-signature-hmac-sha256");
      const valid = await verifyHmacSignature(rawBody, sig, env.WEBHOOK_SIGNING_SECRET);
      if (!valid) {
        return jsonResponse({ error: "invalid webhook signature" }, 401);
      }

      const payload = JSON.parse(rawBody) as {
        projectId: string;
        source: "pinterest" | "behance" | "google_maps";
        intentDomain?: VisualIntentDomain;
        pins?: PinterestCandidatePin[];
        leads?: Array<{
          place_name: string;
          category?: string;
          address?: string;
          phone?: string;
          email?: string;
          website?: string;
        }>;
      };

      if (payload.source === "pinterest" && Array.isArray(payload.pins)) {
        const project = await env.DB.prepare(`SELECT industry, brief_json FROM projects WHERE id = ?1`)
          .bind(payload.projectId)
          .first<{ industry: string; brief_json: string }>();
        const brief = project?.brief_json ? JSON.parse(project.brief_json) : {};
        const matcher = new PinterestMatcher();
        const ranked = matcher.rankCandidates(payload.pins, {
          projectId: payload.projectId,
          industry: project?.industry ?? "brand",
          brandKeywords: Array.isArray(brief.brandKeywords) ? brief.brandKeywords : [],
          moodKeywords: Array.isArray(brief.moodKeywords) ? brief.moodKeywords : [],
          forbiddenKeywords: Array.isArray(brief.forbiddenKeywords) ? brief.forbiddenKeywords : [],
          intentDomain: payload.intentDomain || "packaging",
          minScore: Number(env.PINTEREST_MIN_SCORE || "0.75"),
          targetCount: 18,
        });

        for (const pin of ranked) {
          await env.DB.prepare(
            `INSERT INTO reference_pins
              (id, project_id, source, source_url, r2_key, perceptual_hash, intent_domain, match_score, is_selected, extracted_tags_json)
             VALUES (?1, ?2, 'pinterest', ?3, ?4, ?5, ?6, ?7, 1, ?8)`
          )
            .bind(
              pin.pinId || crypto.randomUUID(),
              payload.projectId,
              pin.sourceUrl,
              pin.r2Key,
              pin.perceptualHash,
              pin.intentDomain,
              pin.score,
              JSON.stringify({ tags: pin.tags ?? [], rationale: pin.rationale })
            )
            .run();
        }
      }

      if (payload.source === "google_maps" && Array.isArray(payload.leads)) {
        for (const lead of payload.leads) {
          await env.DB.prepare(
            `INSERT INTO leads
              (id, project_id, place_name, category, address, phone, email, website, outreach_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'pending_draft')`
          )
            .bind(
              crypto.randomUUID(),
              payload.projectId,
              lead.place_name,
              lead.category ?? null,
              lead.address ?? null,
              lead.phone ?? null,
              lead.email ?? null,
              lead.website ?? null
            )
            .run();
        }
      }

      const engine = new SkillEngine(env);
      const snapshot = await buildProjectSnapshot(env.DB, payload.projectId);
      const triggered = snapshot
        ? await engine.evaluateAndTrigger(snapshot, `${payload.source}_ingested`, { source: payload.source })
        : [];

      return jsonResponse({ ok: true, triggered });
    }

    return jsonResponse({ error: "not found" }, 404);
  },

  async queue(batch: MessageBatch<QueueEnvelope | OutreachEnvelope>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      if (batch.queue === "brand-growth-skill-jobs") {
        await executeSkillRun(env, msg.body as QueueEnvelope);
      } else if (batch.queue === "brand-growth-outreach-jobs") {
        const outreach = msg.body as OutreachEnvelope;
        await env.DB.prepare(
          `UPDATE leads
           SET outreach_status = 'sent', last_contacted_at = datetime('now')
           WHERE id = ?1 AND project_id = ?2`
        )
          .bind(outreach.leadId, outreach.projectId)
          .run();
      }
      msg.ack();
    }
  },
};
