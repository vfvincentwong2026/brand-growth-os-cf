import crypto from "node:crypto";

const WORKER_URL = (process.env.WORKER_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const PROJECT_ID = process.env.PROJECT_ID || "proj_limarasa_001";
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || "dev-webhook-secret";

function signHmacSha256(rawBody, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

async function fetchSynthesizedQueries(projectId) {
  const res = await fetch(`${WORKER_URL}/api/projects/${encodeURIComponent(projectId)}/queries`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.queries) ? data.queries : [];
}

async function uploadSampleAssetToR2(r2Key, contentType, bytes) {
  const res = await fetch(`${WORKER_URL}/api/assets/${encodeURIComponent(r2Key)}`, {
    method: "PUT",
    headers: { "content-type": contentType },
    body: bytes,
  });
  return res.ok;
}

async function pushSignedWebhook(payload) {
  const rawBody = JSON.stringify(payload);
  const signature = signHmacSha256(rawBody, SECRET);

  const res = await fetch(`${WORKER_URL}/webhooks/scraper`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature-hmac-sha256": signature,
    },
    body: rawBody,
  });

  const bodyText = await res.text();
  console.log(`[runner] webhook=${payload.source} status=${res.status} response=${bodyText}`);
}

async function runRunnerCycle() {
  const queries = await fetchSynthesizedQueries(PROJECT_ID);
  console.log(`[runner] active queries for ${PROJECT_ID}:`, queries);

  // Replace this placeholder with real headless browser / API scraping for Pinterest
  const sampleR2Key = `projects/${PROJECT_ID}/pins/pin_runner_01.txt`;
  await uploadSampleAssetToR2(
    sampleR2Key,
    "text/plain; charset=utf-8",
    Buffer.from("placeholder-image-payload-for-local-pipeline-check")
  );

  await pushSignedWebhook({
    projectId: PROJECT_ID,
    source: "pinterest",
    intentDomain: "packaging",
    pins: [
      {
        pinId: `pin_${Date.now()}`,
        sourceUrl: "https://www.pinterest.com/pin/sample-tea-packaging/",
        imageUrl: "https://example.com/sample-tea-packaging.jpg",
        title: "Minimalist Botanical Tea Packaging & Warm Counter Mood",
        description: "Editorial packaging with tactile matte paper and clean hierarchy",
        tags: ["packaging", "minimalist", "botanical", "editorial"],
        width: 1280,
        height: 1600,
        perceptualHash: `phash_${Date.now()}`,
        r2Key: sampleR2Key,
      },
    ],
  });

  // Replace this placeholder with real Google Maps place extraction
  await pushSignedWebhook({
    projectId: PROJECT_ID,
    source: "google_maps",
    leads: [
      {
        place_name: "Sudirman Creative Hub",
        category: "Co-working & Creative Hub",
        address: "Jakarta Selatan",
        phone: "+62-21-5550101",
        email: "hello@sudirmanhub.example",
        website: "https://sudirmanhub.example",
      },
    ],
  });
}

runRunnerCycle().catch((err) => {
  console.error("[runner] failed:", err);
  process.exit(1);
});
