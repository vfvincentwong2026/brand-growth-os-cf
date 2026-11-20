import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface MaterialSpec {
  mesh_target: string;
  type: "MeshStandardMaterial";
  color?: string;
  roughness?: number;
  metalness?: number;
  map_url?: string;
  bump_url?: string;
}

export interface ThreeSceneSpec {
  scene_id: string;
  camera_presets?: CameraPreset[];
  lighting?: {
    ambient_intensity?: number;
    key_directional?: {
      color?: string;
      intensity?: number;
      position?: [number, number, number];
      cast_shadow?: boolean;
    };
    rim_light?: {
      color?: string;
      intensity?: number;
      position?: [number, number, number];
    };
  };
  materials?: MaterialSpec[];
}

export interface SceneTweakFeedback {
  domain: "packaging" | "spatial_3d";
  sourceEvent: "three_scene_tweak";
  summary: string;
  rawContext: {
    sceneId: string;
    meshTarget: string;
    roughness: number;
    metalness: number;
    cameraPosition: [number, number, number];
    cameraTarget: [number, number, number];
  };
}

export class PackagingSpatialViewport {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly targets = new Map<string, THREE.Mesh>();
  private readonly textureLoader = new THREE.TextureLoader();
  private rafId: number | null = null;
  private currentSceneId = "default_scene";

  constructor(private readonly container: HTMLElement) {
    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#F4EFE6");

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(2.2, 1.6, 2.8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    container.innerHTML = "";
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.7, 0);

    this.buildBaseStage();
    this.startLoop();
  }

  private buildBaseStage(): void {
    const floorGeo = new THREE.CylinderGeometry(6, 6, 0.12, 48);
    const floorMat = new THREE.MeshStandardMaterial({
      color: "#E5DEC9",
      roughness: 0.85,
      metalness: 0.02,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Default packaging proxy (cup + carrier base)
    const cupGeo = new THREE.CylinderGeometry(0.42, 0.32, 1.15, 36);
    const cupMat = new THREE.MeshStandardMaterial({
      color: "#F6EFE2",
      roughness: 0.78,
      metalness: 0.02,
    });
    const cupMesh = new THREE.Mesh(cupGeo, cupMat);
    cupMesh.name = "tea_cup_body";
    cupMesh.position.set(0, 0.58, 0);
    cupMesh.castShadow = true;
    cupMesh.receiveShadow = true;
    this.scene.add(cupMesh);
    this.targets.set("tea_cup_body", cupMesh);
    this.targets.set("primary_packaging", cupMesh);

    const counterGeo = new THREE.BoxGeometry(2.6, 0.9, 1.1);
    const counterMat = new THREE.MeshStandardMaterial({
      color: "#1E3A2F",
      roughness: 0.58,
      metalness: 0.08,
    });
    const counterMesh = new THREE.Mesh(counterGeo, counterMat);
    counterMesh.name = "counter_fluted_wall";
    counterMesh.position.set(0, 0.45, -1.25);
    counterMesh.castShadow = true;
    counterMesh.receiveShadow = true;
    this.scene.add(counterMesh);
    this.targets.set("counter_fluted_wall", counterMesh);
  }

  public applySceneSpec(spec: ThreeSceneSpec): void {
    this.currentSceneId = spec.scene_id || this.currentSceneId;

    // Clear previous non-stage lights
    const removableLights = this.scene.children.filter((obj) => obj instanceof THREE.Light);
    for (const l of removableLights) {
      this.scene.remove(l);
    }

    const ambient = new THREE.AmbientLight(
      "#FFFFFF",
      spec.lighting?.ambient_intensity ?? 0.45
    );
    this.scene.add(ambient);

    const keySpec = spec.lighting?.key_directional;
    const keyLight = new THREE.DirectionalLight(
      keySpec?.color ?? "#FFF3DC",
      keySpec?.intensity ?? 2.0
    );
    const keyPos = keySpec?.position ?? [4.5, 7.5, 4.5];
    keyLight.position.set(keyPos[0], keyPos[1], keyPos[2]);
    keyLight.castShadow = keySpec?.cast_shadow ?? true;
    this.scene.add(keyLight);

    const rimSpec = spec.lighting?.rim_light;
    if (rimSpec) {
      const rimLight = new THREE.DirectionalLight(
        rimSpec.color ?? "#DCE8E2",
        rimSpec.intensity ?? 0.75
      );
      const rimPos = rimSpec.position ?? [-4, 4, -3];
      rimLight.position.set(rimPos[0], rimPos[1], rimPos[2]);
      this.scene.add(rimLight);
    }

    for (const matSpec of spec.materials ?? []) {
      const mesh = this.targets.get(matSpec.mesh_target);
      if (!mesh) continue;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (matSpec.color) mat.color.set(matSpec.color);
      if (typeof matSpec.roughness === "number") mat.roughness = THREE.MathUtils.clamp(matSpec.roughness, 0, 1);
      if (typeof matSpec.metalness === "number") mat.metalness = THREE.MathUtils.clamp(matSpec.metalness, 0, 1);

      if (matSpec.map_url) {
        this.textureLoader.load(matSpec.map_url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          mat.map = tex;
          mat.needsUpdate = true;
        });
      }

      if (matSpec.bump_url) {
        this.textureLoader.load(matSpec.bump_url, (bump) => {
          mat.bumpMap = bump;
          mat.bumpScale = 0.02;
          mat.needsUpdate = true;
        });
      }

      mat.needsUpdate = true;
    }

    if (spec.camera_presets && spec.camera_presets.length > 0) {
      this.applyCameraPreset(spec.camera_presets[0]);
    }
  }

  public applyCameraPreset(preset: CameraPreset): void {
    this.camera.position.set(preset.position[0], preset.position[1], preset.position[2]);
    this.controls.target.set(preset.target[0], preset.target[1], preset.target[2]);
    this.controls.update();
  }

  public updateMaterialFinish(
    meshTarget: string,
    roughness: number,
    metalness: number
  ): SceneTweakFeedback | null {
    const mesh = this.targets.get(meshTarget);
    if (!mesh) return null;

    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.roughness = THREE.MathUtils.clamp(roughness, 0, 1);
    mat.metalness = THREE.MathUtils.clamp(metalness, 0, 1);
    mat.needsUpdate = true;

    const domain: "packaging" | "spatial_3d" =
      meshTarget.includes("counter") || meshTarget.includes("space") || meshTarget.includes("wall")
        ? "spatial_3d"
        : "packaging";

    return {
      domain,
      sourceEvent: "three_scene_tweak",
      summary: `Adjusted ${meshTarget} to roughness=${mat.roughness.toFixed(2)}, metalness=${mat.metalness.toFixed(2)}`,
      rawContext: {
        sceneId: this.currentSceneId,
        meshTarget,
        roughness: mat.roughness,
        metalness: mat.metalness,
        cameraPosition: [
          Number(this.camera.position.x.toFixed(2)),
          Number(this.camera.position.y.toFixed(2)),
          Number(this.camera.position.z.toFixed(2)),
        ],
        cameraTarget: [
          Number(this.controls.target.x.toFixed(2)),
          Number(this.controls.target.y.toFixed(2)),
          Number(this.controls.target.z.toFixed(2)),
        ],
      },
    };
  }

  public async submitFeedbackToWorker(
    workerBaseUrl: string,
    projectId: string,
    feedback: SceneTweakFeedback
  ): Promise<unknown> {
    const res = await fetch(`${workerBaseUrl.replace(/\/$/, "")}/api/projects/${projectId}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(feedback),
    });
    return res.json();
  }

  private startLoop(): void {
    const tick = () => {
      this.rafId = requestAnimationFrame(tick);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  public dispose(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.controls.dispose();
    this.renderer.dispose();
  }
}
