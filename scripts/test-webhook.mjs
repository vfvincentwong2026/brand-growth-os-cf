import crypto from "node:crypto";

const WORKER_URL = process.env.WORKER_URL || "http://127.0.0.1:8787";
const PROJECT_ID = process.env.PROJECT_ID || "proj_limarasa_001";
const SECRET = process.env.WEBHOOK_SIGNING_SECRET || "dev-webhook-secret";

function signPayload(rawBody, secret) {
  return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

async function postSignedWebhook(payload) {
  const rawBody = JSON.stringify(payload);
  const signature = signPayload(rawBody, SECRET);

  const res = await fetch(`${WORKER_URL}/webhooks/scraper`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-signature-hmac-sha256": signature,
    },
    body: rawBody,
  });

  const text = await res.text();
  console.log(`Status ${res.status} (${payload.source}):`, text);
}

async function main() {
  // 1. Simulate Pinterest reference pins ingestion for LIMA RASA milk tea
  await postSignedWebhook({
    projectId: PROJECT_ID,
    source: "pinterest",
    intentDomain: "packaging",
    pins: [
      {
        pinId: "pin_lr_101",
        sourceUrl: "https://www.pinterest.com/pin/example-101/",
        imageUrl: "https://example.com/tea-cup-matte.jpg",
        title: "Minimalist Matte Paper Tea Cup & Botanical Sleeve Packaging",
        description: "Warm cream and deep green tea packaging editorial",
        tags: ["packaging", "cup", "minimalist", "botanical", "editorial"],
        width: 1200,
        height: 1500,
        perceptualHash: "phash_lr_001",
        r2Key: `projects/${PROJECT_ID}/pins/pin_lr_101.jpg`,
      },
      {
        pinId: "pin_lr_102",
        sourceUrl: "https://www.pinterest.com/pin/example-102/",
        imageUrl: "https://example.com/neon-cyber-trash.jpg",
        title: "Cyberpunk Neon Glitch Poster",
        description: "High saturation neon clashing colors",
        tags: ["neon", "cyberpunk"],
        width: 1080,
        height: 1080,
        perceptualHash: "phash_lr_002",
        r2Key: `projects/${PROJECT_ID}/pins/pin_lr_102.jpg`,
      },
    ],
  });

  // 2. Simulate Google Maps B2B leads ingestion around Jakarta commercial/office hubs
  await postSignedWebhook({
    projectId: PROJECT_ID,
    source: "google_maps",
    leads: [
      {
        place_name: "Karya Studio Space",
        category: "Co-working & Creative Hub",
        address: "Jl. Jenderal Sudirman Kav. 52-53, Jakarta",
        phone: "+62-21-5550192",
        email: "ops@karyastudio.example",
        website: "https://karyastudio.example",
      },
      {
        place_name: "Surya Tower Reception & Facilities",
        category: "Commercial Office Building",
        address: "Jl. MH Thamrin No. 10, Jakarta",
        phone: "+62-21-5550148",
        email: "facilities@suryatower.example",
        website: "https://suryatower.example",
      },
    ],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
