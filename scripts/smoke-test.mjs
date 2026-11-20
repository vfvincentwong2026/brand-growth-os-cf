import crypto from "node:crypto";

const WORKER_URL = (process.env.WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || "dev-webhook-secret";

function signPayload(rawBody, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

async function assertJson(res, label) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function runSmokeTest() {
  console.log("1. Checking /health...");
  const health = await assertJson(await fetch(`${WORKER_URL}/health`), "health");
  console.log("   health:", health);

  console.log("2. Creating LIMA RASA project...");
  const created = await assertJson(
    await fetch(`${WORKER_URL}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "LIMA RASA",
        industry: "tea & milk tea",
        brief: {
          brandKeywords: ["LIMA RASA", "botanical tea", "roasted oolong"],
          moodKeywords: ["tactile botanical", "warm editorial", "minimalist"],
          forbiddenKeywords: ["neon", "cyberpunk"],
        },
      }),
    }),
    "create project"
  );
  const projectId = created.projectId;
  console.log("   projectId:", projectId, "triggered:", created.triggered.map((t) => t.skill));

  console.log("3. Posting signed Pinterest & Google Maps webhook...");
  const webhookPayload = {
    projectId,
    source: "pinterest",
    intentDomain: "packaging",
    pins: [
      {
        pinId: `pin_smoke_${Date.now()}`,
        sourceUrl: "https://www.pinterest.com/pin/smoke-tea-cup/",
        imageUrl: "https://example.com/smoke-tea-cup.jpg",
        title: "Minimalist Botanical Tea Cup Packaging & Warm Counter",
        description: "Editorial packaging with tactile matte paper",
        tags: ["packaging", "cup", "minimalist", "botanical", "editorial"],
        width: 1200,
        height: 1500,
        perceptualHash: `phash_smoke_${Date.now()}`,
        r2Key: `projects/${projectId}/pins/smoke.jpg`,
      },
    ],
  };
  const rawBody = JSON.stringify(webhookPayload);
  const hookRes = await assertJson(
    await fetch(`${WORKER_URL}/webhooks/scraper`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-hmac-sha256": signPayload(rawBody, SECRET),
      },
      body: rawBody,
    }),
    "pinterest webhook"
  );
  console.log("   webhook triggered:", hookRes.triggered.map((t) => t.skill));

  const mapsPayload = {
    projectId,
    source: "google_maps",
    leads: [
      {
        place_name: "Karya Studio Space",
        category: "Co-working & Creative Hub",
        address: "Jakarta",
        email: "hello@karyastudio.example",
      },
    ],
  };
  const rawMaps = JSON.stringify(mapsPayload);
  await assertJson(
    await fetch(`${WORKER_URL}/webhooks/scraper`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-hmac-sha256": signPayload(rawMaps, SECRET),
      },
      body: rawMaps,
    }),
    "google maps webhook"
  );

  console.log("4. Submitting manual feedback to trigger auto-distillation...");
  const fb = await assertJson(
    await fetch(`${WORKER_URL}/api/projects/${encodeURIComponent(projectId)}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: "packaging",
        sourceEvent: "smoke_test_rule",
        summary: "Always include tamper-evident seal sticker on delivery milk tea cups.",
        rawContext: { cupSize: "16oz" },
      }),
    }),
    "feedback distill"
  );
  console.log("   distilled rules count:", fb.distilledRules.length);

  console.log("5. Fetching project state & leads...");
  const state = await assertJson(
    await fetch(`${WORKER_URL}/api/projects/${encodeURIComponent(projectId)}`),
    "get project"
  );
  const leadsRes = await assertJson(
    await fetch(`${WORKER_URL}/api/projects/${encodeURIComponent(projectId)}/leads`),
    "get leads"
  );
  console.log("   stage:", state.project.stage, "| leads:", leadsRes.leads.length);
  console.log("SMOKE TEST PASSED.");
}

runSmokeTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
