export interface VisualHarvestEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
  AI: {
    run(model: string, input: Record<string, unknown>): Promise<unknown>;
  };
  DEFAULT_MODEL: string;
}

export interface StyleTokens {
  mood_keywords: string[];
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    neutral_ink: string;
  };
  typography_pairing: {
    display: string;
    body: string;
  };
  material_cues: string[];
  prompt_templates: string[];
}

export class VisualHarvestSkill {
  constructor(private readonly env: VisualHarvestEnv) {}

  public async run(projectId: string): Promise<StyleTokens> {
    const project = await this.env.DB.prepare(
      `SELECT name, industry, brief_json FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string; brief_json: string }>();

    const pinsRes = await this.env.DB.prepare(
      `SELECT source, source_url, r2_key, intent_domain, match_score, extracted_tags_json
       FROM reference_pins
       WHERE project_id = ?1 AND is_selected = 1
       ORDER BY match_score DESC
       LIMIT 24`
    )
      .bind(projectId)
      .all<{
        source: string;
        source_url: string;
        r2_key: string;
        intent_domain: string;
        match_score: number;
        extracted_tags_json: string;
      }>();

    const pins = pinsRes.results ?? [];
    const fallbackTokens: StyleTokens = {
      mood_keywords: ["tactile botanical", "warm editorial", "clean modern craft"],
      palette: {
        primary: "#1E3A2F",
        secondary: "#F6EFE2",
        accent: "#C86D3B",
        neutral_ink: "#181818",
      },
      typography_pairing: {
        display: "Editorial Serif / High-Contrast Geometric",
        body: "Clean Sans-Serif with clear numeric legibility",
      },
      material_cues: ["uncoated tactile paper", "matte cup sleeve", "warm natural counter"],
      prompt_templates: [
        `${project?.industry ?? "brand"} editorial studio visual, warm natural lighting, tactile materials, clean composition`,
      ],
    };

    if (pins.length === 0) {
      await this.persistTokens(projectId, fallbackTokens);
      return fallbackTokens;
    }

    const prompt = [
      "Distill visual style tokens from matched moodboard pins and project brief.",
      "Return ONLY strict JSON matching keys: mood_keywords (string[]), palette ({primary, secondary, accent, neutral_ink}), typography_pairing ({display, body}), material_cues (string[]), prompt_templates (string[]).",
      `Project: ${project?.name ?? projectId} (${project?.industry ?? "general"})`,
      `Brief: ${project?.brief_json ?? "{}"}`,
      `Matched Pins: ${JSON.stringify(pins)}`,
    ].join("\n");

    try {
      const res = await this.env.AI.run(this.env.DEFAULT_MODEL, {
        messages: [
          { role: "system", content: "Output strict valid JSON only." },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
      });

      const rawText =
        typeof res === "string"
          ? res
          : typeof (res as { response?: unknown })?.response === "string"
            ? String((res as { response: string }).response)
            : "";
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Partial<StyleTokens>;
        const merged: StyleTokens = {
          mood_keywords: Array.isArray(parsed.mood_keywords) && parsed.mood_keywords.length > 0
            ? parsed.mood_keywords
            : fallbackTokens.mood_keywords,
          palette: {
            primary: parsed.palette?.primary || fallbackTokens.palette.primary,
            secondary: parsed.palette?.secondary || fallbackTokens.palette.secondary,
            accent: parsed.palette?.accent || fallbackTokens.palette.accent,
            neutral_ink: parsed.palette?.neutral_ink || fallbackTokens.palette.neutral_ink,
          },
          typography_pairing: {
            display: parsed.typography_pairing?.display || fallbackTokens.typography_pairing.display,
            body: parsed.typography_pairing?.body || fallbackTokens.typography_pairing.body,
          },
          material_cues: Array.isArray(parsed.material_cues) && parsed.material_cues.length > 0
            ? parsed.material_cues
            : fallbackTokens.material_cues,
          prompt_templates: Array.isArray(parsed.prompt_templates) && parsed.prompt_templates.length > 0
            ? parsed.prompt_templates
            : fallbackTokens.prompt_templates,
        };
        await this.persistTokens(projectId, merged);
        return merged;
      }
    } catch {
      // Fallback to deterministic tokens
    }

    await this.persistTokens(projectId, fallbackTokens);
    return fallbackTokens;
  }

  private async persistTokens(projectId: string, tokens: StyleTokens): Promise<void> {
    const serialized = JSON.stringify(tokens);
    await this.env.DB.prepare(
      `UPDATE projects SET style_tokens_json = ?1, stage = 'visual_harvested', updated_at = datetime('now') WHERE id = ?2`
    )
      .bind(serialized, projectId)
      .run();

    await this.env.BRAND_CACHE.put(`style_tokens:${projectId}`, serialized, {
      expirationTtl: 86400,
    });
  }
}
