export type SkillName =
  | "visual-harvest"
  | "brand-identity"
  | "packaging-space"
  | "promo-strategy"
  | "lead-outreach"
  | "auto-distill";

export interface ProjectSnapshot {
  id: string;
  name: string;
  industry: string;
  stage: string;
  hasMoodboard: boolean;
  hasBrandIdentity: boolean;
  hasPackagingAnd3D: boolean;
  hasCampaignPlan: boolean;
  hasLeadsToProcess: boolean;
  pendingFeedbackCount: number;
}

export interface TriggerDecision {
  skill: SkillName;
  reason: string;
  priority: number;
  payload: Record<string, unknown>;
}

export interface QueueLike {
  send(message: unknown): Promise<void>;
}

export interface EngineEnv {
  DB: D1Database;
  SKILL_QUEUE: QueueLike;
}

/**
 * Evaluates project state, missing deliverables, and incoming events
 * to automatically route and enqueue the next required skills.
 */
export class SkillEngine {
  constructor(private readonly env: EngineEnv) {}

  public async evaluateAndTrigger(
    project: ProjectSnapshot,
    eventType: string,
    eventPayload: Record<string, unknown> = {}
  ): Promise<TriggerDecision[]> {
    const decisions: TriggerDecision[] = [];

    if (project.pendingFeedbackCount > 0 || eventType === "feedback_submitted") {
      decisions.push({
        skill: "auto-distill",
        reason: "Pending user edits, 3D scene tweaks, or outreach signals require memory distillation",
        priority: 1,
        payload: { projectId: project.id, eventType, ...eventPayload },
      });
    }

    if (!project.hasMoodboard || eventType === "request_moodboard") {
      decisions.push({
        skill: "visual-harvest",
        reason: "Missing matched Pinterest/Behance moodboard references for style token extraction",
        priority: 2,
        payload: { projectId: project.id, industry: project.industry, ...eventPayload },
      });
    }

    if (project.hasMoodboard && !project.hasBrandIdentity) {
      decisions.push({
        skill: "brand-identity",
        reason: "Visual style tokens ready; auto-generating logo, palette, typography & VI rules",
        priority: 3,
        payload: { projectId: project.id, ...eventPayload },
      });
    }

    if (project.hasBrandIdentity && (!project.hasPackagingAnd3D || eventType === "three_scene_update")) {
      decisions.push({
        skill: "packaging-space",
        reason: "Brand identity available; generating packaging, spatial specs & Three.js scene config",
        priority: 4,
        payload: { projectId: project.id, ...eventPayload },
      });
    }

    if (project.hasBrandIdentity && !project.hasCampaignPlan) {
      decisions.push({
        skill: "promo-strategy",
        reason: "Brand foundation ready; generating campaign strategy and channel messaging matrix",
        priority: 5,
        payload: { projectId: project.id, ...eventPayload },
      });
    }

    if (project.hasCampaignPlan && (project.hasLeadsToProcess || eventType === "leads_ingested")) {
      decisions.push({
        skill: "lead-outreach",
        reason: "New or uncontacted Google Maps leads ready for fit scoring and tailored product intro",
        priority: 6,
        payload: { projectId: project.id, ...eventPayload },
      });
    }

    decisions.sort((a, b) => a.priority - b.priority);

    for (const decision of decisions) {
      const runId = crypto.randomUUID();
      await this.env.DB.prepare(
        `INSERT INTO skill_runs (id, project_id, skill_name, trigger_reason, status, input_json)
         VALUES (?1, ?2, ?3, ?4, 'queued', ?5)`
      )
        .bind(
          runId,
          project.id,
          decision.skill,
          decision.reason,
          JSON.stringify(decision.payload)
        )
        .run();

      await this.env.SKILL_QUEUE.send({
        runId,
        ...decision,
      });
    }

    return decisions;
  }
}
