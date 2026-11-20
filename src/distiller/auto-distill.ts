export type DistillDomain =
  | "visual"
  | "packaging"
  | "spatial_3d"
  | "campaign"
  | "outreach";

export interface FeedbackSignal {
  projectId: string;
  domain: DistillDomain;
  sourceEvent: string;
  summary: string;
  rawContext: Record<string, unknown>;
}

export interface DistilledRule {
  id: string;
  domain: DistillDomain;
  ruleKey: string;
  ruleContent: string;
  confidence: number;
}

export interface DistillEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
}

/**
 * Automatically distills user edits, Three.js viewport adjustments,
 * campaign results, and outreach feedback into structured rules
 * and refreshes the living brand specification.
 */
export class AutoDistiller {
  constructor(private readonly env: DistillEnv) {}

  public async distillFeedback(signal: FeedbackSignal): Promise<DistilledRule[]> {
    const prompt = [
      "You are an AI-Native brand memory distiller.",
      "Extract concise, reusable, non-contradictory brand/design/3D/marketing rules from the signal below.",
      "Return ONLY a JSON array of objects with fields: ruleKey, ruleContent, confidence (0.0 to 1.0).",
      `Domain: ${signal.domain}`,
      `Event: ${signal.sourceEvent}`,
      `Summary: ${signal.summary}`,
      `Context: ${JSON.stringify(signal.rawContext)}`,
    ].join("\n");

    const aiResult = await this.env.AI.run(this.env.DEFAULT_MODEL, {
      messages: [
        { role: "system", content: "Output strict JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const parsedRules = this.parseRulesFromModelOutput(aiResult, signal);
    const savedRules: DistilledRule[] = [];

    for (const item of parsedRules) {
      const id = crypto.randomUUID();
      await this.env.DB.prepare(
        `INSERT INTO distilled_rules (id, project_id, domain, rule_key, rule_content, confidence, source_event)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
        .bind(
          id,
          signal.projectId,
          signal.domain,
          item.ruleKey,
          item.ruleContent,
          item.confidence,
          signal.sourceEvent
        )
        .run();

      savedRules.push({
        id,
        domain: signal.domain,
        ruleKey: item.ruleKey,
        ruleContent: item.ruleContent,
        confidence: item.confidence,
      });
    }

    await this.rebuildLivingBrandSpec(signal.projectId);
    return savedRules;
  }

  private parseRulesFromModelOutput(
    raw: unknown,
    fallbackSignal: FeedbackSignal
  ): Array<{ ruleKey: string; ruleContent: string; confidence: number }> {
    const text =
      typeof raw === "string"
        ? raw
        : typeof (raw as { response?: unknown })?.response === "string"
          ? String((raw as { response: string }).response)
          : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const arr = JSON.parse(jsonMatch[0]);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr
            .filter((r) => r && typeof r.ruleContent === "string" && r.ruleContent.trim().length > 0)
            .map((r, idx) => ({
              ruleKey: typeof r.ruleKey === "string" && r.ruleKey.trim()
                ? r.ruleKey.trim()
                : `${fallbackSignal.domain.toUpperCase()}-RULE-${idx + 1}`,
              ruleContent: r.ruleContent.trim(),
              confidence: typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.85,
            }));
        }
      } catch {
        // Fallback below
      }
    }

    return [
      {
        ruleKey: `${fallbackSignal.domain.toUpperCase()}-SIGNAL`,
        ruleContent: fallbackSignal.summary,
        confidence: 0.75,
      },
    ];
  }

  public async rebuildLivingBrandSpec(projectId: string): Promise<string> {
    const projectRow = await this.env.DB.prepare(
      `SELECT name, industry, brief_json, style_tokens_json FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string; brief_json: string; style_tokens_json: string }>();

    const rulesRes = await this.env.DB.prepare(
      `SELECT domain, rule_key, rule_content, confidence
       FROM distilled_rules
       WHERE project_id = ?1
       ORDER BY confidence DESC, created_at DESC`
    )
      .bind(projectId)
      .all<{ domain: string; rule_key: string; rule_content: string; confidence: number }>();

    const rulesList = (rulesRes.results ?? [])
      .map((r) => `- [${r.domain}] **${r.rule_key}** (${r.confidence.toFixed(2)}): ${r.rule_content}`)
      .join("\n");

    const markdown = [
      `# Living Brand Spec: ${projectRow?.name ?? projectId}`,
      `- **Industry**: ${projectRow?.industry ?? "general"}`,
      `- **Updated At**: ${new Date().toISOString()}`,
      "",
      "## Style Tokens",
      "```json",
      projectRow?.style_tokens_json ?? "{}",
      "```",
      "",
      "## Auto-Distilled Rules",
      rulesList || "- No rules distilled yet.",
    ].join("\n");

    await this.env.DB.prepare(
      `UPDATE projects SET brand_spec_markdown = ?1, updated_at = datetime('now') WHERE id = ?2`
    )
      .bind(markdown, projectId)
      .run();

    await this.env.BRAND_CACHE.put(`brand_spec:${projectId}`, markdown, {
      expirationTtl: 86400,
    });

    return markdown;
  }
}
