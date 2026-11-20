import { AutoDistiller } from "../distiller/auto-distill";

export interface LeadsRouteEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  OUTREACH_QUEUE: {
    send(message: unknown): Promise<void>;
  };
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
}

interface LeadRecord {
  id: string;
  project_id: string;
  place_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  fit_score: number;
  outreach_status: string;
  tailored_pitch: string | null;
  last_contacted_at: string | null;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleLeadsRoutes(
  request: Request,
  url: URL,
  env: LeadsRouteEnv
): Promise<Response | null> {
  const method = request.method.toUpperCase();

  // GET /api/projects/:projectId/leads
  const listMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/leads$/);
  if (listMatch && method === "GET") {
    const projectId = decodeURIComponent(listMatch[1]);
    const statusFilter = url.searchParams.get("status");

    const rows = statusFilter
      ? await env.DB.prepare(
          `SELECT * FROM leads WHERE project_id = ?1 AND outreach_status = ?2 ORDER BY fit_score DESC, created_at DESC`
        )
          .bind(projectId, statusFilter)
          .all<LeadRecord>()
      : await env.DB.prepare(
          `SELECT * FROM leads WHERE project_id = ?1 ORDER BY fit_score DESC, created_at DESC`
        )
          .bind(projectId)
          .all<LeadRecord>();

    return jsonResponse({ leads: rows.results ?? [] });
  }

  // POST /api/projects/:projectId/leads/:leadId/approve
  const approveMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/leads\/([^/]+)\/approve$/);
  if (approveMatch && method === "POST") {
    const projectId = decodeURIComponent(approveMatch[1]);
    const leadId = decodeURIComponent(approveMatch[2]);

    const body = (await request.json().catch(() => ({}))) as {
      tailoredPitch?: string;
      dispatchNow?: boolean;
    };

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ?1 AND project_id = ?2`
    )
      .bind(leadId, projectId)
      .first<LeadRecord>();

    if (!lead) {
      return jsonResponse({ error: "lead not found" }, 404);
    }

    const finalPitch =
      typeof body.tailoredPitch === "string" && body.tailoredPitch.trim().length > 0
        ? body.tailoredPitch.trim()
        : lead.tailored_pitch || "";

    if (!finalPitch) {
      return jsonResponse({ error: "tailoredPitch is empty; run lead-outreach first" }, 400);
    }

    const dispatchNow = body.dispatchNow !== false;
    const nextStatus = dispatchNow ? "approved" : "draft_ready";

    await env.DB.prepare(
      `UPDATE leads SET tailored_pitch = ?1, outreach_status = ?2 WHERE id = ?3 AND project_id = ?4`
    )
      .bind(finalPitch, nextStatus, leadId, projectId)
      .run();

    if (dispatchNow) {
      await env.OUTREACH_QUEUE.send({
        leadId: lead.id,
        projectId,
        placeName: lead.place_name,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        tailoredPitch: finalPitch,
      });
    }

    return jsonResponse({
      ok: true,
      leadId,
      outreachStatus: nextStatus,
      queued: dispatchNow,
    });
  }

  // POST /api/projects/:projectId/leads/:leadId/outcome
  const outcomeMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/leads\/([^/]+)\/outcome$/);
  if (outcomeMatch && method === "POST") {
    const projectId = decodeURIComponent(outcomeMatch[1]);
    const leadId = decodeURIComponent(outcomeMatch[2]);

    const body = (await request.json()) as {
      outcome: "replied" | "rejected";
      notes?: string;
    };

    if (!body.outcome || !["replied", "rejected"].includes(body.outcome)) {
      return jsonResponse({ error: "outcome must be 'replied' or 'rejected'" }, 400);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ?1 AND project_id = ?2`
    )
      .bind(leadId, projectId)
      .first<LeadRecord>();

    if (!lead) {
      return jsonResponse({ error: "lead not found" }, 404);
    }

    await env.DB.prepare(
      `UPDATE leads SET outreach_status = ?1 WHERE id = ?2 AND project_id = ?3`
    )
      .bind(body.outcome, leadId, projectId)
      .run();

    const distiller = new AutoDistiller(env);
    const distilledRules = await distiller.distillFeedback({
      projectId,
      domain: "outreach",
      sourceEvent: `lead_${body.outcome}`,
      summary: `Lead "${lead.place_name}" (${lead.category || "unknown"}) marked as ${body.outcome}. ${body.notes || ""}`.trim(),
      rawContext: {
        leadId: lead.id,
        placeName: lead.place_name,
        category: lead.category,
        fitScore: lead.fit_score,
        outcome: body.outcome,
        notes: body.notes ?? "",
      },
    });

    return jsonResponse({
      ok: true,
      leadId,
      outreachStatus: body.outcome,
      distilledRules,
    });
  }

  return null;
}
