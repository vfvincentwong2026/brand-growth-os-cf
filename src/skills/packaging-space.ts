import type { ThreeSceneSpec } from "../../web/src/three/PackagingSpatialViewport";

export interface PackagingSpaceEnv {
  DB: D1Database;
  BRAND_CACHE: KVNamespace;
}

export interface PackagingSpaceResult {
  sceneId: string;
  packagingRecommendations: Array<{
    item: string;
    structure: string;
    materialAndFinish: string;
  }>;
  spatialPlan: {
    typology: string;
    layoutNotes: string[];
  };
  threeScene: ThreeSceneSpec;
}

export class PackagingSpaceSkill {
  constructor(private readonly env: PackagingSpaceEnv) {}

  public async run(projectId: string): Promise<PackagingSpaceResult> {
    const project = await this.env.DB.prepare(
      `SELECT name, industry, style_tokens_json FROM projects WHERE id = ?1`
    )
      .bind(projectId)
      .first<{ name: string; industry: string; style_tokens_json: string }>();

    const tokens = project?.style_tokens_json ? JSON.parse(project.style_tokens_json) : {};
    const primaryColor = tokens?.palette?.primary || "#1E3A2F";
    const secondaryColor = tokens?.palette?.secondary || "#F6EFE2";
    const accentColor = tokens?.palette?.accent || "#C86D3B";

    const sceneId = `scene_${projectId}_${Date.now()}`;
    const result: PackagingSpaceResult = {
      sceneId,
      packagingRecommendations: [
        {
          item: "Primary Vessel / Cup (500ml / 16oz)",
          structure: "Tapered high-stability vessel with custom lid fit and tamper-evident seal label",
          materialAndFinish: "Matte-coated board/paper with subtle embossed emblem and non-slip grip zone",
        },
        {
          item: "Multi-Unit Carrier & Tasting Box",
          structure: "2-cup / 4-cup carrier with locking handle and rigid tasting gift box with inserts",
          materialAndFinish: "Heavyweight kraft/molded pulp carrier + tactile rigid carton with accent foil/deboss",
        },
      ],
      spatialPlan: {
        typology: "Compact Counter / Street Kiosk & Pickup Flow",
        layoutNotes: [
          "Separate order counter, prep station, and rider/guest pickup shelf to avoid bottlenecks",
          "Pair primary brand surface color with warm neutral lighting for clear product contrast",
        ],
      },
      threeScene: {
        scene_id: sceneId,
        camera_presets: [
          { name: "hero_packaging", position: [2.0, 1.45, 2.5], target: [0, 0.72, 0] },
          { name: "spatial_counter", position: [4.2, 2.2, 4.4], target: [0, 1.1, -0.6] },
        ],
        lighting: {
          ambient_intensity: 0.45,
          key_directional: {
            color: "#FFF3DC",
            intensity: 2.1,
            position: [4.8, 7.5, 4.5],
            cast_shadow: true,
          },
          rim_light: {
            color: accentColor,
            intensity: 0.65,
            position: [-3.8, 3.6, -2.8],
          },
        },
        materials: [
          {
            mesh_target: "tea_cup_body",
            type: "MeshStandardMaterial",
            color: secondaryColor,
            roughness: 0.76,
            metalness: 0.02,
          },
          {
            mesh_target: "counter_fluted_wall",
            type: "MeshStandardMaterial",
            color: primaryColor,
            roughness: 0.58,
            metalness: 0.08,
          },
        ],
      },
    };

    const nextVersionRow = await this.env.DB.prepare(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_ver FROM three_scenes WHERE project_id = ?1`
    )
      .bind(projectId)
      .first<{ next_ver: number }>();

    await this.env.DB.prepare(
      `INSERT INTO three_scenes (id, project_id, scene_type, scene_json, version)
       VALUES (?1, ?2, 'combined', ?3, ?4)`
    )
      .bind(sceneId, projectId, JSON.stringify(result), nextVersionRow?.next_ver ?? 1)
      .run();

    await this.env.DB.prepare(
      `UPDATE projects SET stage = 'space_3d_ready', updated_at = datetime('now') WHERE id = ?1`
    )
      .bind(projectId)
      .run();

    await this.env.BRAND_CACHE.put(`latest_scene:${projectId}`, JSON.stringify(result), {
      expirationTtl: 86400,
    });

    return result;
  }
}
