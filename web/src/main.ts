import { PackagingSpatialViewport, type SceneTweakFeedback, type ThreeSceneSpec } from "./three/PackagingSpatialViewport";

const viewportEl = document.getElementById("three-viewport") as HTMLElement;
const workerUrlInput = document.getElementById("worker-url") as HTMLInputElement;
const projectIdInput = document.getElementById("project-id") as HTMLInputElement;
const brandSpecEl = document.getElementById("brand-spec") as HTMLElement;
const rulesEl = document.getElementById("distilled-rules") as HTMLElement;

const roughInput = document.getElementById("input-rough") as HTMLInputElement;
const metalInput = document.getElementById("input-metal") as HTMLInputElement;
const roughLabel = document.getElementById("val-rough") as HTMLElement;
const metalLabel = document.getElementById("val-metal") as HTMLElement;
const meshSelect = document.getElementById("mesh-target") as HTMLSelectElement;

const viewport = new PackagingSpatialViewport(viewportEl);
let latest3DFeedback: SceneTweakFeedback | null = null;

function getBaseUrl(): string {
  return workerUrlInput.value.trim().replace(/\/$/, "");
}

async function loadProjectState(projectId: string): Promise<void> {
  if (!projectId) return;
  const res = await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}`);
  if (!res.ok) {
    brandSpecEl.textContent = `Failed to load project (${res.status})`;
    return;
  }
  const data = (await res.json()) as {
    project?: { brand_spec_markdown?: string };
    distilledRules?: unknown[];
    threeScenes?: Array<{ scene_json?: string }>;
  };

  brandSpecEl.textContent = data.project?.brand_spec_markdown || "Living brand spec pending generation...";
  rulesEl.textContent = JSON.stringify(data.distilledRules ?? [], null, 2);

  const latestSceneRaw = data.threeScenes?.[0]?.scene_json;
  if (latestSceneRaw) {
    try {
      const parsed = JSON.parse(latestSceneRaw) as { threeScene?: ThreeSceneSpec } & ThreeSceneSpec;
      viewport.applySceneSpec(parsed.threeScene ?? parsed);
    } catch {
      // Ignore malformed scene JSON
    }
  }
}

document.getElementById("btn-create")?.addEventListener("click", async () => {
  const name = (document.getElementById("brand-name") as HTMLInputElement).value.trim();
  const industry = (document.getElementById("brand-industry") as HTMLInputElement).value.trim();
  const moodsRaw = (document.getElementById("brand-moods") as HTMLInputElement).value;
  const moodKeywords = moodsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const res = await fetch(`${getBaseUrl()}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      industry,
      brief: { brandKeywords: [name], moodKeywords },
    }),
  });
  const data = (await res.json()) as { projectId?: string };
  if (data.projectId) {
    projectIdInput.value = data.projectId;
    await loadProjectState(data.projectId);
  }
});

document.getElementById("btn-load")?.addEventListener("click", async () => {
  await loadProjectState(projectIdInput.value.trim());
});

function handleMaterialSliderChange(): void {
  const r = Number(roughInput.value);
  const m = Number(metalInput.value);
  roughLabel.textContent = r.toFixed(2);
  metalLabel.textContent = m.toFixed(2);
  latest3DFeedback = viewport.updateMaterialFinish(meshSelect.value, r, m);
}

roughInput.addEventListener("input", handleMaterialSliderChange);
metalInput.addEventListener("input", handleMaterialSliderChange);

document.getElementById("btn-distill-3d")?.addEventListener("click", async () => {
  const projectId = projectIdInput.value.trim();
  if (!projectId) return;
  if (!latest3DFeedback) {
    handleMaterialSliderChange();
  }
  if (!latest3DFeedback) return;

  await viewport.submitFeedbackToWorker(getBaseUrl(), projectId, latest3DFeedback);
  await loadProjectState(projectId);
});

document.getElementById("btn-feedback")?.addEventListener("click", async () => {
  const projectId = projectIdInput.value.trim();
  const summary = (document.getElementById("feedback-text") as HTMLTextAreaElement).value.trim();
  if (!projectId || !summary) return;

  await fetch(`${getBaseUrl()}/api/projects/${encodeURIComponent(projectId)}/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      domain: "visual",
      sourceEvent: "workspace_manual_rule",
      summary,
      rawContext: { source: "ui_workspace" },
    }),
  });
  (document.getElementById("feedback-text") as HTMLTextAreaElement).value = "";
  await loadProjectState(projectId);
});
