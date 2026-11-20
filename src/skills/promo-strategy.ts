export interface PromoStrategyEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
}

export interface PromoPlan {
  projectId: string;
  coreAngles: string[];
  channelPlaybook: Array<{
    channel: string;
    objective: string;
    cadence: string;
  }>;
  b2bOutreachHook: string;
}

export class PromoStrategySkill {
  constructor(private readonly env: PromoStrategyEnv) {}

  public async run(projectId: string): Promise<PromoPlan> {
    const project = await this.env.DB.prepare(
      `SELECT name, industry, brief_json, brand_spec_markdown FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string; brief_json: string; brand_spec_markdown: string }>();

    const brandName = project?.name ?? "Brand";
    const industry = project?.industry ?? "general";

    const fallback: PromoPlan = {
      projectId,
      coreAngles: [
        `Signature product pairing & sensory story for ${brandName}`,
        "Tactile packaging & spatial unboxing moments built for organic sharing",
        "Group/team order convenience for nearby offices, studios & events",
      ],
      channelPlaybook: [
        {
          channel: "Short-Form Social & Visual Feeds",
          objective: "Drive local discovery via craft process, 3D/packaging reveals, and tasting hooks",
          cadence: "4-5 posts / week",
        },
        {
          channel: "Local Map Listing & Geo-Targeted B2B Outreach",
          objective: "Convert nearby offices, co-working spaces, and event hosts into recurring orders",
          cadence: "Weekly batch outreach + follow-up",
        },
      ],
      b2bOutreachHook: `${brandName} offers structured group ordering, custom event/team labeling, and consistent ${industry} quality for nearby teams and spaces.`,
    };

    await this.env.BRAND_CACHE.put(`promo_plan:${projectId}`, JSON.stringify(fallback), {
      expirationTtl: 86400,
    });

    await this.env.DB.prepare(
      `UPDATE projects SET stage = 'campaign_ready', updated_at = datetime('now') WHERE id = ?1`
    )
      .bind(projectId)
      .run();

    return fallback;
  }
}
