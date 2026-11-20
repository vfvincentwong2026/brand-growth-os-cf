export interface AssetsRouteEnv {
  ASSETS_BUCKET: R2Bucket;
  BRAND_CACHE: KVNamespace;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleAssetsRoutes(
  request: Request,
  url: URL,
  env: AssetsRouteEnv
): Promise<Response | null> {
  const method = request.method.toUpperCase();

  // PUT /api/assets/*  -> Upload texture, moodboard pin, or 3D bundle to R2
  const assetMatch = url.pathname.match(/^\/api\/assets\/(.+)$/);
  if (assetMatch && method === "PUT") {
    const objectKey = decodeURIComponent(assetMatch[1]).replace(/^\/+/, "");
    if (!objectKey) {
      return jsonResponse({ error: "invalid asset key" }, 400);
    }

    const contentType = request.headers.get("content-type") || "application/octet-stream";
    const body = await request.arrayBuffer();

    await env.ASSETS_BUCKET.put(objectKey, body, {
      httpMetadata: { contentType },
    });

    return jsonResponse({
      ok: true,
      r2Key: objectKey,
      size: body.byteLength,
      contentType,
    });
  }

  // GET /api/assets/*  -> Serve stored R2 asset with cache headers
  if (assetMatch && method === "GET") {
    const objectKey = decodeURIComponent(assetMatch[1]).replace(/^\/+/, "");
    const obj = await env.ASSETS_BUCKET.get(objectKey);
    if (!obj) {
      return jsonResponse({ error: "asset not found" }, 404);
    }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set("etag", obj.httpEtag);
    headers.set("cache-control", "public, max-age=3600");

    return new Response(obj.body, { headers });
  }

  // GET /api/projects/:projectId/queries  -> Fetch synthesized Pinterest queries for external runners
  const queriesMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/queries$/);
  if (queriesMatch && method === "GET") {
    const projectId = decodeURIComponent(queriesMatch[1]);
    const cached = await env.BRAND_CACHE.get(`pinterest_queries:${projectId}`);
    const queries = cached ? (JSON.parse(cached) as string[]) : [];
    return jsonResponse({ projectId, queries });
  }

  return null;
}
