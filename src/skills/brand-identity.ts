import { AutoDistiller } from "../distiller/auto-distill";

export interface BrandIdentityEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
}

export interface BrandIdentityOutput {
  brandName: string;
  tagline: string;
  logoDirection: string;
  viApplications: string[];
  brandSpecMarkdown: string;
}

export class BrandIdentitySkill {
  constructor(private readonly env: BrandIdentityEnv) {}

  public async run(projectId: string): Promise<BrandIdentityOutput> {
    const project = await this.env.DB.prepare(
      `SELECT name, industry, brief_json, style_tokens_json FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string; brief_json: string; style_tokens_json: string }>();

    const rulesRes = await this.env.DB.prepare(
      `SELECT domain, rule_key, rule_content FROM distilled_rules WHERE project_id = ?1 ORDER BY confidence DESC`
    )
      .bind(projectId)
      .all<{ domain: string; rule_key: string; rule_content: string }>();

    const brandName = project?.name ?? "LIMA RASA";
    const industry = project?.industry ?? "tea & milk tea";
    const styleTokens = project?.style_tokens_json ? JSON.parse(project.style_tokens_json) : {};
    const rules = rulesRes.results ?? [];

    const fallback: BrandIdentityOutput = {
      brandName,
      tagline: "Crafted Notes. Calm Daily Ritual.",
      logoDirection:
        "Minimalist emblem combining an organic leaf/arch mark with a clean wordmark legible down to 16px seal/sticker scale.",
      viApplications: [
        "Primary vessel & sleeve color hierarchy with clear SKU/customization badge zone",
        "Tamper-evident seal sticker & packaging label grid",
        "Menu board, signage & social visual frame rules",
      ],
      brandSpecMarkdown: "",
    };

    let identityData = fallback;
    try {
      const prompt = [
        "Create a concise, structured brand identity & VI system.",
        "Return ONLY JSON with keys: tagline (string), logoDirection (string), viApplications (string[]).",
        `Brand: ${brandName}`,
        `Industry: ${industry}`,
        `Brief: ${project?.brief_json ?? "{}"}`,
        `StyleTokens: ${JSON.stringify(styleTokens)}`,
        `DistilledRules: ${JSON.stringify(rules)}`,
      ].join("\n");

      const res = await this.env.AI.run(this.env.DEFAULT_MODEL, {
        messages: [
          { role: "system", content: "Output strict valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      });

      const rawText =
        typeof res === "string"
          ? res
          : typeof (res as { response?: unknown })?.response === "string"
            ? String((res as { response: string }).response)
            : "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<BrandIdentityOutput>;
        identityData = {
          brandName,
          tagline: parsed.tagline || fallback.tagline,
          logoDirection: parsed.logoDirection || fallback.logoDirection,
          viApplications:
            Array.isArray(parsed.viApplications) && parsed.viApplications.length > 0
              ? parsed.viApplications
              : fallback.viApplications,
          brandSpecMarkdown: "",
        };
      }
    } catch {
      // Keep fallback
    }

    const distiller = new AutoDistiller(this.env);
    const baseSpec = await distiller.rebuildLivingBrandSpec(projectId);

    const viSection = [
      "",
      "## Brand Identity & VI System",
      `- **Tagline**: ${identityData.tagline}`,
      `- **Logo Direction**: ${identityData.logoDirection}`,
      "### Core VI Applications",
      ...identityData.viApplications.map((item) => `- ${item}`),
    ].join("\n");

    const fullMarkdown = `${baseSpec}\n${viSection}`;
    identityData.brandSpecMarkdown = fullMarkdown;

    await this.env.DB.prepare(
      `UPDATE projects SET brand_spec_markdown = ?1, stage = 'identity_ready', updated_at = datetime('now') WHERE id = ?2`
    )
      .bind(fullMarkdown, projectId)
      .run();

    await this.env.BRAND_CACHE.put(`brand_spec:${projectId}`, fullMarkdown, {
      expirationTtl: 86400,
    });

    return identityData;
  }
}
