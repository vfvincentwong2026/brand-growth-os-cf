export interface LeadOutreachEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  OUTREACH_QUEUE: {
    send(message: unknown): Promise<void>;
  };
  OUTREACH_REQUIRE_APPROVAL: string;
}

interface LeadRow {
  id: string;
  place_name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export class LeadOutreachSkill {
  constructor(private readonly env: LeadOutreachEnv) {}

  public async run(projectId: string): Promise<{ processed: number; queuedForSend: number }> {
    const project = await this.env.DB.prepare(
      `SELECT name, industry FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string }>();

    const cachedPromoRaw = await this.env.BRAND_CACHE.get(`promo_plan:${projectId}`);
    const cachedPromo = cachedPromoRaw ? JSON.parse(cachedPromoRaw) : {};
    const hook =
      typeof cachedPromo.b2bOutreachHook === "string" && cachedPromo.b2bOutreachHook.trim()
        ? cachedPromo.b2bOutreachHook.trim()
        : `${project?.name ?? "We"} provide tailored ${project?.industry ?? "product"} packages and group delivery for local teams.`;

    const leadsRes = await this.env.DB.prepare(
      `SELECT id, place_name, category, address, phone, email, website
       FROM leads
       WHERE project_id = ?1 AND outreach_status = 'pending_draft'
       LIMIT 30`
    )
      .bind(projectId)
      .all<LeadRow>();

    const leads = leadsRes.results ?? [];
    const requireApproval = (this.env.OUTREACH_REQUIRE_APPROVAL || "true").toLowerCase() === "true";
    let queuedForSend = 0;

    for (const lead of leads) {
      const hasDirectContact = Boolean(lead.email || lead.phone);
      const categoryLower = (lead.category || "").toLowerCase();
      const categoryBonus = /(office|studio|cowork|co-work|hotel|event|retail|mall|campus|cafe)/i.test(
        categoryLower
      )
        ? 0.14
        : 0.05;
      const fitScore = Number(Math.min(0.98, 0.72 + categoryBonus + (hasDirectContact ? 0.06 : 0)).toFixed(2));

      const pitch = [
        `Hi ${lead.place_name} team,`,
        `${hook}`,
        `For ${lead.category || "your location"} (${lead.address || "nearby area"}), we can prepare a sample tasting/product kit or scheduled group order tailored to your team or guests.`,
        `Would you like us to share our product menu and bundle options?`,
      ].join(" ");

      const nextStatus = requireApproval ? "draft_ready" : "approved";

      await this.env.DB.prepare(
        `UPDATE leads
         SET tailored_pitch = ?1, outreach_status = ?2, fit_score = ?3
         WHERE id = ?4`
      )
        .bind(pitch, nextStatus, fitScore, lead.id)
        .run();

      if (!requireApproval && hasDirectContact) {
        await this.env.OUTREACH_QUEUE.send({
          leadId: lead.id,
          projectId,
          placeName: lead.place_name,
          email: lead.email ?? undefined,
          phone: lead.phone ?? undefined,
          tailoredPitch: pitch,
        });
        queuedForSend += 1;
      }
    }

    if (leads.length > 0) {
      await this.env.DB.prepare(
        `UPDATE projects SET stage = 'outreach_active', updated_at = datetime('now') WHERE id = ?1`
      )
        .bind(projectId)
        .run();
    }

    return { processed: leads.length, queuedForSend };
  }
}
