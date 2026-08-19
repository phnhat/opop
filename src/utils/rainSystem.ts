import * as THREE from 'three';

export type WeatherMode = 'auto' | 'clear' | 'drizzle' | 'heavy_rain';

export interface RainSystemOptions {
  scene: THREE.Scene;
  cols: number;
  rows: number;
  tileSize: number;
  getTileBaseY: (col: number, row: number) => number;
  isWaterTile: (col: number, row: number) => boolean;
  enabled?: boolean;
  autoCycle?: boolean;
  ambientLight?: THREE.AmbientLight;
  sunLight?: THREE.DirectionalLight;
  onWeatherChange?: (mode: WeatherMode, intensity: number, label: string) => void;
}

interface RainDrop {
  mesh: THREE.Mesh;
  speed: number;
  length: number;
  initialY: number;
}

interface RainSplash {
  mesh: THREE.Mesh;
  velY: number;
  life: number;
  maxLife: number;
}

interface RainRipple {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export class RainSystem {
  private scene: THREE.Scene;
  private cols: number;
  private rows: number;
  private tileSize: number;
  private getTileBaseY: (col: number, row: number) => number;
  private isWaterTile: (col: number, row: number) => boolean;
  private ambientLight?: THREE.AmbientLight;
  private sunLight?: THREE.DirectionalLight;
  private onWeatherChange?: (mode: WeatherMode, intensity: number, label: string) => void;

  private enabled: boolean = true;
  private autoCycle: boolean = true;
  private weatherMode: WeatherMode = 'auto';

  // Rain Intensity: 0.0 (Clear) to 1.0 (Heavy Rain)
  private currentIntensity: number = 0.0;
  private targetIntensity: number = 0.0;

  // Occasional Rain Timer (in seconds)
  private weatherTimer: number = 0;
  private currentCycleDuration: number = 35; // Initial clear phase
  private isRainyCycle: boolean = false;

  // Three.js Objects
  private rainGroup: THREE.Group = new THREE.Group();
  private splashGroup: THREE.Group = new THREE.Group();
  private drops: RainDrop[] = [];
  private splashes: RainSplash[] = [];
  private ripples: RainRipple[] = [];

  // Geometries & Materials
  private dropGeo: THREE.BoxGeometry;
  private dropMat: THREE.MeshBasicMaterial;
  private splashGeo: THREE.BoxGeometry;
  private splashMat: THREE.MeshBasicMaterial;
  private ringGeo: THREE.RingGeometry;

  // Original Scene Colors for Smooth Interpolation
  private baseBgColor: THREE.Color = new THREE.Color(0x3d7068);
  private rainyBgColor: THREE.Color = new THREE.Color(0x284240);
  private baseFogColor: THREE.Color = new THREE.Color(0x3d7068);
  private rainyFogColor: THREE.Color = new THREE.Color(0x284240);
  private baseSunIntensity: number = 1.8;
  private rainySunIntensity: number = 0.9;
  private baseAmbientIntensity: number = 1.2;
  private rainyAmbientIntensity: number = 0.7;

  constructor(options: RainSystemOptions) {
    this.scene = options.scene;
    this.cols = options.cols;
    this.rows = options.rows;
    this.tileSize = options.tileSize;
    this.getTileBaseY = options.getTileBaseY;
    this.isWaterTile = options.isWaterTile;
    this.enabled = options.enabled ?? true;
    this.autoCycle = options.autoCycle ?? true;
    this.ambientLight = options.ambientLight;
    this.sunLight = options.sunLight;
    this.onWeatherChange = options.onWeatherChange;

    if (this.ambientLight) this.baseAmbientIntensity = this.ambientLight.intensity;
    if (this.sunLight) this.baseSunIntensity = this.sunLight.intensity;

    // Shared Geometries & Materials
    this.dropGeo = new THREE.BoxGeometry(0.025, 0.4, 0.025);
    this.dropMat = new THREE.MeshBasicMaterial({
      color: 0x9be2f5,
      transparent: true,
      opacity: 0.6,
    });

    this.splashGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
    this.splashMat = new THREE.MeshBasicMaterial({
      color: 0xc4f0fc,
      transparent: true,
      opacity: 0.8,
    });

    this.ringGeo = new THREE.RingGeometry(0.08, 0.35, 12);
    this.ringGeo.rotateX(-Math.PI / 2);

    this.scene.add(this.rainGroup);
    this.scene.add(this.splashGroup);

    this.initDrops(300);
  }

  private initDrops(count: number) {
    const mapWidth = this.cols * this.tileSize;
    const mapDepth = this.rows * this.tileSize;

    for (let i = 0; i < count; i++) {
      const dropMesh = new THREE.Mesh(this.dropGeo, this.dropMat);
      
      const x = (Math.random() - 0.5) * (mapWidth + 6);
      const z = (Math.random() - 0.5) * (mapDepth + 6);
      const y = 2 + Math.random() * 16;

      dropMesh.position.set(x, y, z);
      // Slight slanted rotation for wind angle
      dropMesh.rotation.z = -0.12;
      dropMesh.rotation.x = 0.05;

      this.rainGroup.add(dropMesh);

      this.drops.push({
        mesh: dropMesh,
        speed: 16 + Math.random() * 8,
        length: 0.4 + Math.random() * 0.2,
        initialY: y,
      });
    }

    this.rainGroup.visible = false;
  }

  // Set weather mode manually or automatically
  public setWeatherMode(mode: WeatherMode) {
    this.weatherMode = mode;
    this.weatherTimer = 0;

    switch (mode) {
      case 'clear':
        this.targetIntensity = 0.0;
        this.isRainyCycle = false;
        break;
      case 'drizzle':
        this.targetIntensity = 0.4;
        this.isRainyCycle = true;
        break;
      case 'heavy_rain':
        this.targetIntensity = 1.0;
        this.isRainyCycle = true;
        break;
      case 'auto':
        this.targetIntensity = 0.0;
        this.isRainyCycle = false;
        this.currentCycleDuration = 25 + Math.random() * 20; // 25s - 45s clear phase
        break;
    }

    this.notifyWeatherChange();
  }

  public getWeatherMode(): WeatherMode {
    return this.weatherMode;
  }

  public getIntensity(): number {
    return this.currentIntensity;
  }

  public getWeatherLabel(): string {
    if (this.currentIntensity <= 0.05) return '☀️ Clear Sky';
    if (this.currentIntensity <= 0.5) return '🌦️ Passing Drizzle';
    return '🌧️ Occasional Rain';
  }

  private notifyWeatherChange() {
    if (this.onWeatherChange) {
      this.onWeatherChange(this.weatherMode, this.currentIntensity, this.getWeatherLabel());
    }
  }

  // Convert world X, Z coordinates to grid col & row
  private worldToGrid(x: number, z: number) {
    const col = Math.floor(x / this.tileSize + this.cols / 2);
    const row = Math.floor(z / this.tileSize + this.rows / 2);
    return { col, row };
  }

  private triggerImpact(x: number, z: number, floorY: number) {
    const { col, row } = this.worldToGrid(x, z);

    // Out of map bounds check
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

    const isWater = this.isWaterTile(col, row);

    if (isWater) {
      // Create expanding water ripple
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xb3f0ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
      ringMesh.position.set(x, floorY + 0.02, z);
      this.splashGroup.add(ringMesh);
      this.ripples.push({ mesh: ringMesh, life: 0, maxLife: 0.4 + Math.random() * 0.2 });
    } else {
      // Create tiny splash droplets on solid ground
      const splashCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < splashCount; i++) {
        const sMesh = new THREE.Mesh(this.splashGeo, this.splashMat);
        sMesh.position.set(x, floorY + 0.05, z);
        this.splashGroup.add(sMesh);

        const angle = Math.random() * Math.PI * 2;
        const spd = 0.8 + Math.random() * 1.2;

        this.splashes.push({
          mesh: sMesh,
          velY: spd,
          life: 0,
          maxLife: 0.2 + Math.random() * 0.15,
        });
      }
    }
  }

  public update(delta: number, elapsedTime: number) {
    if (!this.enabled) return;

    // 1. Occasional Rain Auto-Cycle Timer
    if (this.weatherMode === 'auto') {
      this.weatherTimer += delta;

      if (this.weatherTimer >= this.currentCycleDuration) {
        this.weatherTimer = 0;
        this.isRainyCycle = !this.isRainyCycle;

        if (this.isRainyCycle) {
          // Rain shower phase (duration 20s to 35s)
          this.currentCycleDuration = 20 + Math.random() * 15;
          // Randomize intensity between drizzle (0.4) and moderate/heavy rain (0.8 - 1.0)
          this.targetIntensity = Math.random() < 0.5 ? 0.45 : 0.85;
        } else {
          // Clear sky phase (duration 30s to 50s)
          this.currentCycleDuration = 30 + Math.random() * 20;
          this.targetIntensity = 0.0;
        }

        this.notifyWeatherChange();
      }
    }

    // Smoothly lerp current rain intensity towards target intensity
    const intensityStep = delta * 0.4; // Soft 2.5-second rain fade transition
    if (Math.abs(this.currentIntensity - this.targetIntensity) > 0.01) {
      if (this.currentIntensity < this.targetIntensity) {
        this.currentIntensity = Math.min(this.targetIntensity, this.currentIntensity + intensityStep);
      } else {
        this.currentIntensity = Math.max(this.targetIntensity, this.currentIntensity - intensityStep);
      }
    }

    // Toggle rain group visibility based on intensity
    this.rainGroup.visible = this.currentIntensity > 0.02;

    if (this.currentIntensity <= 0.01) {
      // Clear sky atmosphere
      if (this.scene.background && this.scene.background instanceof THREE.Color) {
        this.scene.background.lerp(this.baseBgColor, 0.05);
      }
      if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.lerp(this.baseFogColor, 0.05);
        this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, 0.025, 0.05);
      }
      if (this.sunLight) {
        this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, this.baseSunIntensity, 0.05);
      }
      if (this.ambientLight) {
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, this.baseAmbientIntensity, 0.05);
      }
      return;
    }

    // 2. Adjust Atmosphere (Fog & Lighting) during Rain
    if (this.scene.background && this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(this.rainyBgColor, delta * 0.5);
    }
    if (this.scene.fog && this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(this.rainyFogColor, delta * 0.5);
      const targetFog = 0.025 + this.currentIntensity * 0.015;
      this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetFog, delta * 0.5);
    }
    if (this.sunLight) {
      const targetSun = THREE.MathUtils.lerp(this.baseSunIntensity, this.rainySunIntensity, this.currentIntensity);
      this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, targetSun, delta * 0.5);
    }
    if (this.ambientLight) {
      const targetAmb = THREE.MathUtils.lerp(this.baseAmbientIntensity, this.rainyAmbientIntensity, this.currentIntensity);
      this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, targetAmb, delta * 0.5);
    }

    // 3. Fall Physics for Rain Drops
    const activeDropCount = Math.floor(this.drops.length * this.currentIntensity);
    const mapWidth = this.cols * this.tileSize;
    const mapDepth = this.rows * this.tileSize;

    for (let i = 0; i < this.drops.length; i++) {
      const drop = this.drops[i];

      if (i >= activeDropCount) {
        drop.mesh.visible = false;
        continue;
      }

      drop.mesh.visible = true;

      // Move down with wind angle
      drop.mesh.position.y -= drop.speed * delta;
      drop.mesh.position.x -= 1.8 * delta; // Wind tilt
      drop.mesh.position.z += 0.6 * delta;

      const { col, row } = this.worldToGrid(drop.mesh.position.x, drop.mesh.position.z);
      const targetY = this.getTileBaseY(col, row);

      // Check if rain drop hit ground / water level
      if (drop.mesh.position.y <= targetY) {
        // Trigger splash or ripple if inside or near map bounds
        if (Math.random() < 0.25 + this.currentIntensity * 0.2) {
          this.triggerImpact(drop.mesh.position.x, drop.mesh.position.z, targetY);
        }

        // Recycle drop back up to cloud sky
        drop.mesh.position.y = 12 + Math.random() * 6;
        drop.mesh.position.x = (Math.random() - 0.5) * (mapWidth + 6);
        drop.mesh.position.z = (Math.random() - 0.5) * (mapDepth + 6);
      }
    }

    // 4. Update Micro Splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const sp = this.splashes[i];
      sp.life += delta;
      if (sp.life >= sp.maxLife) {
        this.splashGroup.remove(sp.mesh);
        sp.mesh.geometry.dispose();
        this.splashes.splice(i, 1);
      } else {
        sp.mesh.position.y += sp.velY * delta;
        sp.velY -= 12 * delta; // Gravity
        const progress = sp.life / sp.maxLife;
        sp.mesh.scale.setScalar(Math.max(0.01, (1 - progress) * 1.0));
      }
    }

    // 5. Update Water Ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.life += delta;
      if (rip.life >= rip.maxLife) {
        this.splashGroup.remove(rip.mesh);
        rip.mesh.geometry.dispose();
        this.ripples.splice(i, 1);
      } else {
        const progress = rip.life / rip.maxLife;
        const scale = 1.0 + progress * 2.8;
        rip.mesh.scale.set(scale, 1, scale);
        (rip.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - progress);
      }
    }
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.rainGroup.visible = enabled && this.currentIntensity > 0.02;
  }

  public dispose() {
    this.scene.remove(this.rainGroup);
    this.scene.remove(this.splashGroup);

    this.drops.forEach((d) => d.mesh.geometry.dispose());
    this.splashes.forEach((s) => s.mesh.geometry.dispose());
    this.ripples.forEach((r) => r.mesh.geometry.dispose());

    this.dropGeo.dispose();
    this.dropMat.dispose();
    this.splashGeo.dispose();
    this.splashMat.dispose();
    this.ringGeo.dispose();

    this.drops = [];
    this.splashes = [];
    this.ripples = [];
  }
}
