// ============================================================================
// STATION 04 (V3): 西藏布达拉宫 · 穿山见宫 · 经幡雪山环形腾空 (TIBET LHASA POTALA PALACE)
// Standardized Soarin' Over China V3 3D Station Module
// Upgrades:
// - 540 GPU-instanced traditional Tibetan white-walled flat-roofed valley houses & courtyard compounds
// - 300 GPU-instanced Lhasa valley poplar/willow/cypress park & riverside trees
// - Shimmering cobalt-silver braided Lhasa River & alluvial gravel sandbars across valley floor
// - 24 catenary strings (636 flags) of foreground diagonal & hillside 5-color Lungta prayer flags
//   with NB 2.1 sacred Wind-Horse woodblock cloth PBR + wind-flutter & backlit translucency shader
// - Full 360° Two-Tier Tibetan Foothill & Himalayan Glacier Snow-Peak Horizon Amphitheater
// - Volumetric sunlit plateau cumulus clouds along mountain pass, snow peaks & golden-roof exit
// - C2-stabilized concentric outer-ring helical camera (0.0° roll, 17.0s choreography)
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  smoothstep01,
  quintic01,
  createHeroTrajectory,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

// ----------------------------------------------------------------------------
// Helper: Build Authentic Tibetan Battered-Wall Building Prototype Geometry
// Zone IDs stored in `aZone` attribute:
//   0 = White inward-battering masonry wall (receives procedural Tibetan windows)
//   1 = Dark-maroon Bianma brushwood upper frieze
//   2 = Crisp whitewashed cornice & parapet trim
//   3 = Warm sandy-earth flat Tibetan Aga roof deck
// ----------------------------------------------------------------------------
function makeBatteredBoxPart(cx, cy, cz, wx, wy, wz, taperTop, zoneId) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const count = pos.count;
  const aZone = new Float32Array(count);
  const aLocalUV = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const px = pos.getX(i); // -0.5 .. +0.5
    const py = pos.getY(i); // -0.5 .. +0.5
    const pz = pos.getZ(i); // -0.5 .. +0.5
    const isTop = py > 0.0;
    const scaleXZ = isTop ? taperTop : 1.0;
    const vx = cx + px * wx * scaleXZ;
    const vy = cy + (py + 0.5) * wy;
    const vz = cz + pz * wz * scaleXZ;
    pos.setXYZ(i, vx, vy, vz);

    const nx = nrm.getX(i);
    const ny = nrm.getY(i);
    const nz = nrm.getZ(i);

    let zId = zoneId;
    if (zoneId === 0 && ny > 0.7) zId = 3; // top face of wall block = flat Aga terrace
    aZone[i] = zId;

    // Wall-local meter coordinates for procedural Tibetan black-framed windows
    const horizCoord = Math.abs(nx) > 0.5 ? (pz + 0.5) * wz : (px + 0.5) * wx;
    const vertCoord = (py + 0.5) * wy;
    aLocalUV[i * 2 + 0] = horizCoord;
    aLocalUV[i * 2 + 1] = vertCoord;
  }
  g.computeVertexNormals();
  g.setAttribute('aZone', new THREE.BufferAttribute(aZone, 1));
  g.setAttribute('aLocalUV', new THREE.BufferAttribute(aLocalUV, 2));
  return g;
}

function createTibetanTownHouseProto() {
  const parts = [
    // Main 2.5-story battered white Tibetan block
    makeBatteredBoxPart(-0.6, 0.0, 0.0, 5.6, 4.4, 4.6, 0.89, 0),
    makeBatteredBoxPart(-0.6, 4.4, 0.0, 5.05, 0.72, 4.15, 0.98, 1),
    makeBatteredBoxPart(-0.6, 5.12, 0.0, 5.32, 0.22, 4.42, 1.00, 2),
    makeBatteredBoxPart(-0.6, 5.02, 0.0, 4.92, 0.34, 4.02, 1.00, 3),
    // Stepped 1.5-story side wing
    makeBatteredBoxPart(3.1, 0.0, 0.35, 3.4, 3.0, 3.8, 0.91, 0),
    makeBatteredBoxPart(3.1, 3.0, 0.35, 3.12, 0.52, 3.48, 0.98, 1),
    makeBatteredBoxPart(3.1, 3.52, 0.35, 3.32, 0.18, 3.68, 1.00, 2),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function createTibetanCourtyardCompoundProto() {
  const parts = [
    // North 3-story main Tibetan family/monastic hall
    makeBatteredBoxPart(0.0, 0.0, -2.6, 8.2, 5.2, 4.4, 0.88, 0),
    makeBatteredBoxPart(0.0, 5.2, -2.6, 7.30, 0.82, 3.92, 0.98, 1),
    makeBatteredBoxPart(0.0, 6.02, -2.6, 7.65, 0.24, 4.25, 1.00, 2),
    makeBatteredBoxPart(0.0, 5.92, -2.6, 7.15, 0.36, 3.80, 1.00, 3),
    // West & East lower side galleries
    makeBatteredBoxPart(-3.3, 0.0, 1.2, 2.4, 3.1, 4.8, 0.92, 0),
    makeBatteredBoxPart(-3.3, 3.1, 1.2, 2.24, 0.46, 4.45, 0.99, 1),
    makeBatteredBoxPart(3.3, 0.0, 1.2, 2.4, 3.1, 4.8, 0.92, 0),
    makeBatteredBoxPart(3.3, 3.1, 1.2, 2.24, 0.46, 4.45, 0.99, 1),
    // South enclosed white courtyard wall + central crimson/maroon gate lintel
    makeBatteredBoxPart(0.0, 0.0, 3.7, 8.6, 2.0, 0.65, 0.94, 0),
    makeBatteredBoxPart(0.0, 2.0, 3.7, 8.3, 0.28, 0.72, 1.00, 1),
    makeBatteredBoxPart(0.0, 2.28, 3.7, 2.2, 0.48, 0.86, 1.00, 1),
    // Courtyard inner stone deck
    makeBatteredBoxPart(0.0, 0.0, 0.9, 6.8, 0.25, 5.6, 1.00, 3),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function createTibetanBuildingMaterial(whiteStoneTex) {
  const mat = new THREE.MeshStandardMaterial({
    map: whiteStoneTex,
    roughness: 0.78,
    metalness: 0.02,
  });
  mat.customProgramCacheKey = () => 'potala_lhasa_valley_tibetan_town_v3';
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `attribute float aZone;
       attribute vec2 aLocalUV;
       varying float vZone;
       varying vec2 vLocUV;
       varying vec3 vObjNrm;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vZone = aZone;
       vLocUV = aLocalUV;
       vObjNrm = objectNormal;`
    );
    shader.fragmentShader =
      `varying float vZone;
       varying vec2 vLocUV;
       varying vec3 vObjNrm;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       if (vZone < 0.5) {
         // Luminous whitewashed Tibetan masonry wall + crisp black-framed trapezoidal window grid!
         vec3 wallBase = diffuseColor.rgb * vec3(1.03, 1.01, 0.97);
         if (abs(vObjNrm.y) < 0.35 && vLocUV.y > 1.15) {
           float cellX = fract(vLocUV.x / 1.45);
           float cellY = fract((vLocUV.y - 1.05) / 1.42);
           float inWinX = step(0.28, cellX) * step(cellX, 0.72);
           float inWinY = step(0.22, cellY) * step(cellY, 0.78);
           float inFrameX = step(0.20, cellX) * step(cellX, 0.80);
           float inFrameY = step(0.18, cellY) * step(cellY, 0.85);
           float winPane = inWinX * inWinY;
           float blkFrame = max(0.0, inFrameX * inFrameY - winPane);
           float redLintel = step(0.18, cellX) * step(cellX, 0.82) * step(0.78, cellY) * step(cellY, 0.88);
           wallBase = mix(wallBase, vec3(0.07, 0.075, 0.09), blkFrame * 0.92);
           wallBase = mix(wallBase, vec3(0.55, 0.13, 0.11), redLintel * 0.90);
           wallBase = mix(wallBase, vec3(0.035, 0.04, 0.055), winPane * 0.95);
         }
         diffuseColor.rgb = wallBase;
       } else if (vZone < 1.5) {
         // Dark maroon-ochre Bianma parapet frieze
         diffuseColor.rgb *= vec3(0.42, 0.11, 0.10);
       } else if (vZone < 2.5) {
         // Crisp white roof cornice coping
         diffuseColor.rgb = vec3(0.98, 0.97, 0.94);
       } else {
         // Warm sandy-earth flat Tibetan Aga terrace roof
         diffuseColor.rgb *= vec3(0.76, 0.70, 0.61);
       }`
    );
  };
  return mat;
}

function createValleyTreeProto() {
  const parts = [];
  const rawTrunk = new THREE.CylinderGeometry(0.16, 0.26, 2.2, 6);
  rawTrunk.translate(0, 1.1, 0);
  const trunk = rawTrunk.index ? rawTrunk.toNonIndexed() : rawTrunk;
  if (trunk !== rawTrunk) rawTrunk.dispose();
  const tCol = new Float32Array(trunk.attributes.position.count * 3);
  for (let i = 0; i < trunk.attributes.position.count; i++) {
    tCol[i * 3 + 0] = 0.30;
    tCol[i * 3 + 1] = 0.23;
    tCol[i * 3 + 2] = 0.16;
  }
  trunk.setAttribute('color', new THREE.BufferAttribute(tCol, 3));
  parts.push(trunk);

  const lobes = [
    [0.0, 3.1, 0.0, 1.45, 1.85, 1.45, [0.22, 0.44, 0.18]],
    [0.55, 2.6, 0.35, 1.10, 1.35, 1.10, [0.26, 0.48, 0.20]],
    [-0.50, 2.7, -0.30, 1.15, 1.40, 1.15, [0.19, 0.40, 0.16]],
    [0.0, 4.3, 0.0, 1.00, 1.35, 1.00, [0.30, 0.52, 0.22]],
  ];
  for (const [lx, ly, lz, sx, sy, sz, rgb] of lobes) {
    const rawG = new THREE.IcosahedronGeometry(1.0, 1);
    rawG.scale(sx, sy, sz);
    rawG.translate(lx, ly, lz);
    const g = rawG.index ? rawG.toNonIndexed() : rawG;
    if (g !== rawG) rawG.dispose();
    g.computeVertexNormals();
    const cArr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < g.attributes.position.count; i++) {
      const py = g.attributes.position.getY(i);
      const lift = 0.85 + 0.28 * THREE.MathUtils.clamp((py - 1.8) / 3.4, 0.0, 1.0);
      cArr[i * 3 + 0] = rgb[0] * lift;
      cArr[i * 3 + 1] = rgb[1] * lift;
      cArr[i * 3 + 2] = rgb[2] * lift;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cArr, 3));
    parts.push(g);
  }
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged;
}

function buildRibbonGeometry(ctrlPts, halfWidthFn, yConst, samples = 140) {
  const curve = new THREE.CatmullRomCurve3(
    ctrlPts.map(([x, z]) => new THREE.Vector3(x, yConst, z)),
    false,
    'catmullrom',
    0.45
  );
  const pos = new Float32Array((samples + 1) * 2 * 3);
  const uvs = new Float32Array((samples + 1) * 2 * 2);
  const indices = [];

  const pt = new THREE.Vector3();
  const tang = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPoint(u, pt);
    curve.getTangent(u, tang);
    side.set(-tang.z, 0, tang.x).normalize();
    const hw = halfWidthFn(u);

    const vi = i * 2;
    pos[vi * 3 + 0] = pt.x - side.x * hw;
    pos[vi * 3 + 1] = yConst;
    pos[vi * 3 + 2] = pt.z - side.z * hw;
    uvs[vi * 2 + 0] = 0.0;
    uvs[vi * 2 + 1] = u * 18.0;

    pos[(vi + 1) * 3 + 0] = pt.x + side.x * hw;
    pos[(vi + 1) * 3 + 1] = yConst;
    pos[(vi + 1) * 3 + 2] = pt.z + side.z * hw;
    uvs[(vi + 1) * 2 + 0] = 1.0;
    uvs[(vi + 1) * 2 + 1] = u * 18.0;

    if (i < samples) {
      const a = vi;
      const b = vi + 1;
      const c = vi + 2;
      const d = vi + 3;
      // Right-handed +Y upward normal: (b - a) x (c - a) = (+side) x (+tang) = +Y!
      indices.push(a, b, c, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return { geo, curve };
}

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station04_PotalaPalace_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 17.0;
  const customDisposables = [];

  // High-Altitude Tibetan Plateau Sun (shining from East-South-East-Up so Potala's grand facade,
  // 24K Golden Roofs, Lhasa Valley Town, Lhasa River, Snow Peaks & Pelican gleam!)
  const SUN_POS = new THREE.Vector3(148.0, 128.0, 118.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  const loadTex = (path, srgb = true) =>
    new Promise((resolve, reject) => {
      texLoader.load(
        path,
        (t) => {
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = maxAniso;
          resolve(t);
        },
        undefined,
        reject
      );
    });

  // 1. Deep Cobalt-Sapphire Tibetan Sky Dome + Solar Halo + PMREM Environment Map
  const [skyTex, whiteStoneTex, valleySandTex] = await Promise.all([
    loadTex('./assets/soarin_scene4_potala/pt_sky_panorama.jpg', true),
    loadTex('./assets/soarin_scene4_potala/pt_white_stone_albedo.jpg', true),
    loadTex('./assets/soarin_scene4_potala/pt_valley_ground_albedo.jpg', true),
  ]);
  skyTex.wrapT = THREE.ClampToEdgeWrapping;
  customDisposables.push(skyTex, whiteStoneTex, valleySandTex);

  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSkyMap: { value: skyTex },
      uSunDir: { value: SUN_DIR },
    },
    vertexShader: `
      varying vec3 vWorldDir;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSkyMap;
      uniform vec3 uSunDir;
      varying vec3 vWorldDir;
      varying vec2 vUv;
      void main() {
        vec3 d = normalize(vWorldDir);
        vec3 texCol = texture2D(uSkyMap, vUv).rgb;
        float h = clamp(d.y, -0.2, 1.0);

        // Authentic 3700m Lhasa deep cobalt-sapphire zenith -> vivid cerulean mountain horizon
        // Matches s4_potala_ref_board.jpg 1:1 so dazzling white Himalayan snow peaks pop with razor-sharp contrast!
        vec3 deepSapphireZenith = vec3(0.015, 0.115, 0.44);
        vec3 cobaltUpperMid     = vec3(0.035, 0.220, 0.65);
        vec3 azureLowerMid      = vec3(0.095, 0.390, 0.82);
        vec3 crispSkyHorizon    = vec3(0.28,  0.58,  0.92);

        vec3 cleanGrad = mix(crispSkyHorizon, azureLowerMid, smoothstep(-0.02, 0.12, h));
        cleanGrad = mix(cleanGrad, cobaltUpperMid, smoothstep(0.10, 0.36, h));
        cleanGrad = mix(cleanGrad, deepSapphireZenith, smoothstep(0.32, 0.78, h));

        vec3 col = cleanGrad;

        float mu = max(0.0, dot(d, normalize(uSunDir)));
        float sunDisc = smoothstep(0.9985, 0.9997, mu);
        float innerGlow = pow(mu, 56.0) * 0.65;
        float wideHalo = pow(mu, 8.0) * 0.14;
        col += vec3(0.85, 0.94, 1.00) * wideHalo;
        col += vec3(1.00, 0.98, 0.90) * innerGlow;
        col += vec3(1.00, 0.99, 0.96) * sunDisc * 1.9;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(540, 56, 36), skyDomeMat);
  skyDome.rotation.y = -Math.atan2(SUN_DIR.z, SUN_DIR.x) + Math.PI * 0.35;
  group.add(skyDome);

  let envTexture = null;
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(42, 28, 18), skyDomeMat);
    envSky.rotation.y = skyDome.rotation.y;
    envScene.add(envSky);
    const addCard = (pos, size, color) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(size[0], size[1]),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      );
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    addCard([22, 20, 18],   [26, 18], 0xfff0c2);
    addCard([-14, 28, -10], [28, 22], 0xffebb8);
    addCard([-22, 14, -18], [18, 14], 0x8ec0ff);
    addCard([0, -15, 0],    [36, 36], 0xf0ece4);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
    envScene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== skyDomeMat) o.material.dispose();
    });
  }

  // 2. High-Altitude Tibetan Plateau Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xaad0ff, 0xd8bd9c, 0.80);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e0, 3.35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -46;
  sunLight.shadow.camera.right = 46;
  sunLight.shadow.camera.top = 46;
  sunLight.shadow.camera.bottom = -46;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 210.0;
  sunLight.shadow.bias = -0.00035;
  group.add(sunLight);
  group.add(sunLight.target);

  const cobaltFillLight = new THREE.DirectionalLight(0x88bcff, 0.88);
  cobaltFillLight.position.set(-85, 65, -35);
  group.add(cobaltFillLight);

  const snowBounceLight = new THREE.DirectionalLight(0xf6f2ea, 0.62);
  snowBounceLight.position.set(18, -32, 42);
  group.add(snowBounceLight);

  const atmoUniforms = {
    uTime: { value: 0.0 },
    uWindBoost: { value: 1.0 },
    uSunDir: { value: SUN_DIR },
  };

  // 3. Load V3 Potala Palace + 360° Himalayan Peaks + Valley Basin + Foreground Lungta GLB!
  const ptGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene4_potala/potala_hero_stage.glb', resolve, undefined, reject);
  });

  const ptMatsConfigured = new Set();
  let stageTris = 0;

  ptGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const isSnowPeakMesh = obj.name && obj.name.includes('Himalayan_SnowPeaks');
    const isValleyGround = obj.name && obj.name.includes('LhasaValley_Ground');
    obj.castShadow = !isSnowPeakMesh && !isValleyGround;
    obj.receiveShadow = !isSnowPeakMesh;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    const m = obj.material;
    if (m && !ptMatsConfigured.has(m.uuid)) {
      ptMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }

      // Radiant 24K Hammered Temple Gold on all 5 Golden Palace Roofs, Emblems & Stupa Spires!
      if (m.name && m.name.includes('GildedGold')) {
        m.metalness = 0.65;
        m.roughness = 0.26;
        m.envMapIntensity = 1.48;
        m.emissive = new THREE.Color(0x523505);
        m.emissiveIntensity = 0.28;
      }

      // V3 Two-Tier Tibetan Arid Foothill + Himalayan Glacier-Snow + Aerial-Perspective Shader
      // Matches `s4_potala_ref_board.jpg` 1:1 (warm sunlit ochre-slate foothills below + gleaming snow peaks above!)
      if (m.name && m.name.includes('SnowPeaks')) {
        m.fog = false;
        if (m.normalScale) m.normalScale.set(0.28, 0.28);
        m.customProgramCacheKey = () => 'potala_himalayan_glacier_peaks_v3';
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uSunDir = atmoUniforms.uSunDir;
          shader.vertexShader =
            'varying vec3 vPeakWPos;\nvarying vec3 vPeakWNrm;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vPeakWPos = (modelMatrix * vec4(position, 1.0)).xyz;
             vPeakWNrm = normalize(mat3(modelMatrix) * objectNormal);`
          );
          shader.fragmentShader =
            `uniform vec3 uSunDir;
             varying vec3 vPeakWPos;
             varying vec3 vPeakWNrm;
             float pkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
             float pkNoise(vec2 p) {
               vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
               return mix(mix(pkHash(i), pkHash(i + vec2(1.0, 0.0)), f.x),
                          mix(pkHash(i + vec2(0.0, 1.0)), pkHash(i + vec2(1.0, 1.0)), f.x), f.y);
             }
             float pkFbm(vec2 p) {
               return 0.52 * pkNoise(p) + 0.31 * pkNoise(p * 2.17 + vec2(3.7, 1.9)) + 0.17 * pkNoise(p * 4.65 + vec2(8.3, 5.1));
             }\n` + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <colorspace_fragment>',
            `#include <colorspace_fragment>
             vec3 wn = normalize(vPeakWNrm);
             vec2 uvCouloir = vec2(vPeakWPos.x * 0.052 + vPeakWPos.z * 0.026, vPeakWPos.z * 0.052 - vPeakWPos.y * 0.036);
             float c0 = pkFbm(uvCouloir);
             float cx = pkFbm(uvCouloir + vec2(0.08, 0.0));
             float cz = pkFbm(uvCouloir + vec2(0.0, 0.08));
             float ridgeRib = 1.0 - abs(c0 * 2.0 - 1.0);
             vec3 microN = normalize(wn + vec3((c0 - cx) * 2.6, 0.0, (c0 - cz) * 2.6));

             float nLow  = pkFbm(vPeakWPos.xz * 0.022);
             float nFine = pkFbm(vPeakWPos.xz * 0.15 + vec2(6.1, 2.8));

             // Generous Himalayan snow cover across upper ~65% of all rear peaks (y > 46m),
             // while lower folded Lhasa foothills (y < 44m) display warm sunlit Tibetan ochre-slate ridges!
             float snowLineY = 46.0 + (nLow - 0.5) * 14.0 - ridgeRib * 10.0;
             float altSnow   = smoothstep(snowLineY - 9.0, snowLineY + 11.0, vPeakWPos.y);
             float slopeSnow = smoothstep(0.14, 0.42, wn.y + (nFine - 0.48) * 0.16 + ridgeRib * 0.16);
             float summitSnow = smoothstep(56.0, 82.0, vPeakWPos.y) * smoothstep(0.10, 0.30, wn.y + ridgeRib * 0.18);
             float snowMask  = clamp(altSnow * slopeSnow * 1.32 + summitSnow * 0.92, 0.0, 1.0);
             snowMask = smoothstep(0.12, 0.76, snowMask);

             vec3 mtnSunDir = normalize(vec3(0.78, 0.40, 0.48));
             float sunFacing = dot(microN, mtnSunDir);
             float sunMix = smoothstep(-0.14, 0.26, sunFacing);

             vec3 snowShadow = vec3(0.42, 0.62, 0.90) * (0.94 + 0.09 * ridgeRib);
             vec3 snowSunlit = vec3(0.99, 0.995, 1.00) * (0.97 + 0.04 * nFine);
             vec3 glacierCol = min(vec3(1.0), mix(snowShadow, snowSunlit, sunMix));

             float highSlateMix = smoothstep(34.0, 62.0, vPeakWPos.y);
             float rockTex = clamp(dot(gl_FragColor.rgb, vec3(0.3333)), 0.24, 0.68);
             vec3 foothillSunlit = vec3(0.52, 0.45, 0.40) * (0.84 + 0.40 * rockTex);
             vec3 foothillShadow = vec3(0.24, 0.32, 0.46) * (0.82 + 0.38 * rockTex);
             vec3 alpineSunlit   = vec3(0.34, 0.43, 0.58) * (0.82 + 0.44 * rockTex);
             vec3 alpineShadow   = vec3(0.18, 0.27, 0.45) * (0.82 + 0.40 * rockTex);
             vec3 rockSunlit = mix(foothillSunlit, alpineSunlit, highSlateMix);
             vec3 rockShadow = mix(foothillShadow, alpineShadow, highSlateMix);
             vec3 rockCol = mix(rockShadow, rockSunlit, sunMix);

             vec3 peakCol = mix(rockCol, glacierCol, snowMask);

             float camDist = length(vPeakWPos - cameraPosition);
             float aerialHaze = smoothstep(195.0, 380.0, camDist) * 0.20;
             float valleyFoot = smoothstep(13.5, 7.6, vPeakWPos.y) * 0.22;
             peakCol = mix(peakCol, vec3(0.54, 0.74, 0.95), clamp(aerialHaze + valleyFoot * 0.25, 0.0, 0.26));
             gl_FragColor.rgb = peakCol;`
          );
        };
        m.needsUpdate = true;
      }

      // V3 Fluttering 5-Color Tibetan Lungta Cloth Shader (`pt_lungta_cloth` Wind-Horse PBR + Sunlit Translucency!)
      if (m.name && m.name.includes('PrayerFlags')) {
        m.side = THREE.DoubleSide;
        m.roughness = 0.74;
        m.customProgramCacheKey = () => 'potala_prayer_flags_wind_v3';
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.uniforms.uWindBoost = atmoUniforms.uWindBoost;
          shader.uniforms.uSunDir = atmoUniforms.uSunDir;
          shader.vertexShader =
            'uniform float uTime;\nuniform float uWindBoost;\nvarying vec3 vFlagWPos;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec3 flagWPos = (modelMatrix * vec4(position, 1.0)).xyz;
             vFlagWPos = flagWPos;
             float freeMask = smoothstep(0.02, 0.22, uv.y) * (0.30 + 0.70 * uv.y);
             float flagSeed = flagWPos.x * 1.85 + flagWPos.z * 2.35 + flagWPos.y * 0.95;
             float mountainGust = (0.90 + 0.38 * sin(uTime * 3.4 + flagWPos.x * 0.30 - flagWPos.z * 0.25)) * uWindBoost;
             float travelWave = sin(uTime * 13.5 - uv.y * 6.2 - uv.x * 4.5 + flagSeed);
             float fineFlutter = sin(uTime * 23.0 - uv.y * 11.5 + uv.x * 8.0 + flagSeed * 1.7);
             float clothWave = (travelWave * 0.72 + fineFlutter * 0.28) * mountainGust;

             transformed.x += (0.145 + 0.125 * clothWave) * freeMask;
             transformed.z += (-0.075 + 0.105 * travelWave * mountainGust) * freeMask;
             transformed.y += (0.062 * abs(travelWave) + 0.038 * fineFlutter) * freeMask;`
          );
          shader.fragmentShader =
            'uniform vec3 uSunDir;\nvarying vec3 vFlagWPos;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `// Sunlit woven cotton backlit translucency so foreground Lungta flags glow vividly against cobalt sky!
             vec3 viewToFlag = normalize(vFlagWPos - cameraPosition);
             float backScatter = 0.35 + 0.65 * pow(max(0.0, dot(viewToFlag, normalize(uSunDir))), 2.2);
             gl_FragColor.rgb *= (1.06 + 0.22 * backScatter);
             #include <dithering_fragment>`
          );
        };
        m.needsUpdate = true;
      }

      if (m.name && m.name.includes('HillsideCypress')) {
        m.customProgramCacheKey = () => 'potala_cypress_breeze_v3';
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec3 swPos = (modelMatrix * vec4(position, 1.0)).xyz;
             transformed.x += sin(uTime * 2.6 + swPos.x * 0.5 + swPos.z * 0.4) * 0.055;
             transformed.z += cos(uTime * 2.1 + swPos.y * 0.6) * 0.040;`
          );
        };
        m.needsUpdate = true;
      }
    }
  });
  group.add(ptGltf.scene);
  ptGltf.scene.updateMatrixWorld(true);

  // Blazing-fast O(1) 256x256 2D Elevation Grid (< 2ms total!) rasterized directly from
  // `MarpoRi_RedHill`, `Himalayan_SnowPeaks`, and `LhasaValley_Ground` world vertices so
  // placing 540 Tibetan valley buildings + 300 trees executes instantaneously with ZERO CPU stall!
  const GRID_N = 256;
  const GRID_MIN = -230.0;
  const GRID_SPAN = 460.0;
  const hillMaxGrid = new Float32Array(GRID_N * GRID_N);
  const valleyYGrid = new Float32Array(GRID_N * GRID_N);
  valleyYGrid.fill(7.50);

  const tmpV = new THREE.Vector3();
  ptGltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const nm = o.name || '';
    const isHill = nm.includes('MarpoRi_RedHill') || nm.includes('Himalayan_SnowPeaks');
    const isVal = nm.includes('LhasaValley_Ground');
    if (!isHill && !isVal) return;
    const posAttr = o.geometry.attributes.position;
    const mw = o.matrixWorld;
    for (let i = 0; i < posAttr.count; i++) {
      tmpV.fromBufferAttribute(posAttr, i).applyMatrix4(mw);
      const gx = Math.floor(((tmpV.x - GRID_MIN) / GRID_SPAN) * GRID_N);
      const gz = Math.floor(((tmpV.z - GRID_MIN) / GRID_SPAN) * GRID_N);
      if (gx < 0 || gx >= GRID_N || gz < 0 || gz >= GRID_N) continue;
      if (isHill) {
        // Dilate 1 cell (~1.8m) so building footprints stay cleanly outside rock skirts
        for (let dz = -1; dz <= 1; dz++) {
          const zz = gz + dz;
          if (zz < 0 || zz >= GRID_N) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = gx + dx;
            if (xx < 0 || xx >= GRID_N) continue;
            const idx = zz * GRID_N + xx;
            if (tmpV.y > hillMaxGrid[idx]) hillMaxGrid[idx] = tmpV.y;
          }
        }
      } else if (isVal) {
        valleyYGrid[gz * GRID_N + gx] = tmpV.y;
      }
    }
  });

  function sampleRedHillOrMountainY(x, z) {
    const gx = Math.floor(((x - GRID_MIN) / GRID_SPAN) * GRID_N);
    const gz = Math.floor(((z - GRID_MIN) / GRID_SPAN) * GRID_N);
    if (gx < 0 || gx >= GRID_N || gz < 0 || gz >= GRID_N) return 99.0;
    return hillMaxGrid[gz * GRID_N + gx];
  }
  function sampleValleyFloorY(x, z) {
    const gx = Math.floor(((x - GRID_MIN) / GRID_SPAN) * GRID_N);
    const gz = Math.floor(((z - GRID_MIN) / GRID_SPAN) * GRID_N);
    if (gx < 0 || gx >= GRID_N || gz < 0 || gz >= GRID_N) return 7.50;
    return valleyYGrid[gz * GRID_N + gx];
  }

  // ==========================================================================
  // 4. SHIMMERING BLUE-SILVER LHASA RIVER & BRAIDED SANDBAR RIBBON (`拉萨河与河心沙洲`)
  //    Winds prominently across East/SE valley (right in Beat 1's view like `s4_potala_ref_board.jpg`!)
  //    and wraps gracefully around North-East & North valley plain!
  // ==========================================================================
  const mainRiverCtrl = [
    [ 108.0,   88.0],
    [  74.0,   36.0],
    [  52.0,  -12.0],
    [  44.0,  -58.0],
    [  28.0,  -98.0],
    [ -20.0, -124.0],
    [ -86.0, -132.0],
    [-156.0, -116.0],
    [-205.0,  -75.0],
  ];
  const braidRiverCtrl = [
    [  98.0,   68.0],
    [  64.0,   14.0],
    [  62.0,  -38.0],
    [  50.0,  -82.0],
    [  10.0, -114.0],
    [ -46.0, -128.0],
  ];

  // Alluvial silver-cream gravel sandbar bed underneath the braided river (y=7.84m, cleanly above 7.50±0.20m terrain undulation!)
  const { geo: sandbarGeo, curve: mainRiverCurve } = buildRibbonGeometry(
    mainRiverCtrl,
    (u) => 17.5 + 5.0 * Math.sin(u * Math.PI * 2.2),
    7.84,
    150
  );
  const sandbarMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    uniforms: {
      uSandMap: { value: valleySandTex },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSandMap;
      varying vec2 vUv;
      varying vec3 vWPos;
      void main() {
        vec3 tex = texture2D(uSandMap, vWPos.xz * 0.05).rgb;
        vec3 gravel = mix(tex, vec3(0.86, 0.85, 0.81), 0.58);
        float edge = smoothstep(0.0, 0.24, vUv.x) * smoothstep(1.0, 0.76, vUv.x);
        float endFade = smoothstep(0.0, 0.06, vUv.y / 18.0) * smoothstep(1.0, 0.94, vUv.y / 18.0);
        gl_FragColor = vec4(gravel, edge * endFade * 0.92);
      }
    `,
  });
  const sandbarMesh = new THREE.Mesh(sandbarGeo, sandbarMat);
  sandbarMesh.renderOrder = 1;
  group.add(sandbarMesh);

  // Shimmering Sky-Blue & Sunlit Silver Lhasa River Water Shader
  const riverWaterMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      uTime: atmoUniforms.uTime,
      uSunDir: atmoUniforms.uSunDir,
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      varying vec2 vUv;
      varying vec3 vWPos;
      float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float rNoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), f.x),
                   mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec2 flowUv = vWPos.xz * 0.18 + vec2(-uTime * 0.35, -uTime * 0.22);
        float rip1 = rNoise(flowUv);
        float rip2 = rNoise(flowUv * 2.4 + vec2(uTime * 0.5, -uTime * 0.3));
        vec3 nrm = normalize(vec3((rip1 - 0.5) * 0.22, 1.0, (rip2 - 0.5) * 0.22));

        vec3 viewDir = normalize(cameraPosition - vWPos);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, nrm)), 2.6);

        // Deep Tibetan sky reflection + glacial turquoise-cerulean river core + sunlit silver-gold shimmer!
        vec3 glacialCore = vec3(0.18, 0.46, 0.74);
        vec3 skyReflect  = vec3(0.56, 0.79, 0.98);
        vec3 col = mix(glacialCore, skyReflect, clamp(0.38 + fresnel * 0.62, 0.0, 1.0));

        vec3 halfV = normalize(normalize(uSunDir) + viewDir);
        float spec = pow(max(0.0, dot(nrm, halfV)), 56.0);
        col += vec3(1.0, 0.98, 0.92) * (spec * 1.15 + smoothstep(0.66, 0.92, rip1 * 0.6 + rip2 * 0.4) * 0.18);

        float bankSoft = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float endFade = smoothstep(0.0, 0.05, vUv.y / 18.0) * smoothstep(1.0, 0.95, vUv.y / 18.0);
        gl_FragColor = vec4(col, bankSoft * endFade * 0.94);
      }
    `,
  });

  const { geo: mainWaterGeo } = buildRibbonGeometry(
    mainRiverCtrl,
    (u) => 12.2 + 3.8 * Math.cos(u * Math.PI * 3.0),
    7.92,
    150
  );
  const { geo: braidWaterGeo, curve: braidRiverCurve } = buildRibbonGeometry(
    braidRiverCtrl,
    (u) => 6.6 + 2.0 * Math.sin(u * Math.PI * 2.5),
    7.92,
    90
  );
  const mainWaterMesh = new THREE.Mesh(mainWaterGeo, riverWaterMat);
  const braidWaterMesh = new THREE.Mesh(braidWaterGeo, riverWaterMat);
  mainWaterMesh.renderOrder = 2;
  braidWaterMesh.renderOrder = 2;
  group.add(mainWaterMesh);
  group.add(braidWaterMesh);

  // Pre-sample river polyline points for fast O(1)-grid / distance exclusion when placing town houses!
  const riverSamplePts = [];
  for (let i = 0; i <= 90; i++) {
    const p = mainRiverCurve.getPoint(i / 90);
    riverSamplePts.push([p.x, p.z, 17.0]);
  }
  for (let i = 0; i <= 50; i++) {
    const p = braidRiverCurve.getPoint(i / 50);
    riverSamplePts.push([p.x, p.z, 10.5]);
  }
  function isInRiverCorridor(x, z) {
    for (let i = 0; i < riverSamplePts.length; i++) {
      const [rx, rz, rad] = riverSamplePts[i];
      const dx = x - rx;
      const dz = z - rz;
      if (dx * dx + dz * dz < rad * rad) return true;
    }
    return false;
  }

  // ==========================================================================
  // 5. SPRAWLING LHASA VALLEY TIBETAN TOWN (`540` GPU-INSTANCED TIBETAN HOUSES & COURTYARDS)
  //    + `300` GPU-INSTANCED LHASA VALLEY POPLAR/WILLOW/CYPRESS PARK TREES!
  // ==========================================================================
  const townHouseGeo = createTibetanTownHouseProto();
  const courtyardGeo = createTibetanCourtyardCompoundProto();
  const tibetanBldgMat = createTibetanBuildingMaterial(whiteStoneTex);
  const treeGeo = createValleyTreeProto();
  const treeMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0.02,
  });
  customDisposables.push(townHouseGeo, courtyardGeo, tibetanBldgMat, treeGeo, treeMat);

  let lSeed = 20260404;
  const lRand = () => {
    lSeed = (lSeed * 1664525 + 1013904223) >>> 0;
    return lSeed / 4294967296;
  };

  const houseTransforms = [];
  const courtyardTransforms = [];
  const treeTransforms = [];
  const placedFootprints = []; // [x, z, r]

  function canPlaceOnValley(x, z, minClearR, allowNearAvenue = true) {
    // Keep clear of main East-West Lhasa ceremonial boulevard in front of Potala (`z: 27..32`)
    if (!allowNearAvenue && Math.abs(z - 29.5) < 4.2 && x > -95.0 && x < 95.0) return false;
    if (isInRiverCorridor(x, z)) return false;

    // O(1) heightmap check against Marpo Ri Red Hill & 360° Himalayan foothills (valley plain sits at ~7.5m; hill rises >9.2m)
    const hillH = sampleRedHillOrMountainY(x, z);
    if (hillH > 9.15) return false;
    for (const [ox, oz] of [[minClearR, 0], [-minClearR, 0], [0, minClearR], [0, -minClearR]]) {
      if (sampleRedHillOrMountainY(x + ox, z + oz) > 9.45) return false;
    }

    for (let i = 0; i < placedFootprints.length; i++) {
      const [px, pz, pr] = placedFootprints[i];
      const dx = x - rxFix(px);
      const dz = z - pz;
      const minD = minClearR + pr;
      if (dx * dx + dz * dz < minD * minD) return false;
    }
    return true;
  }
  function rxFix(v) { return v; }

  // Dense Lhasa Valley Town Grid-With-Jitter Sampling across x:[-195..+195], z:[-175..+115]
  // Places 580+ multi-size Tibetan white-walled buildings & courtyards + 310+ lush valley trees!
  const candidateCells = [];
  for (let gx = -194; gx <= 194; gx += 6.6) {
    for (let gz = -176; gz <= 114; gz += 6.6) {
      const distPal = Math.hypot(gx + 18.0, gz + 20.0);
      if (distPal > 205.0) continue;
      candidateCells.push([gx + (lRand() - 0.5) * 2.8, gz + (lRand() - 0.5) * 2.8, distPal]);
    }
  }
  for (let i = candidateCells.length - 1; i > 0; i--) {
    const j = Math.floor(lRand() * (i + 1));
    const tmp = candidateCells[i];
    candidateCells[i] = candidateCells[j];
    candidateCells[j] = tmp;
  }
  candidateCells.sort((a, b) => (a[2] + lRand() * 38.0) - (b[2] + lRand() * 38.0));

  const TARGET_COURTYARDS = 250;
  const TARGET_HOUSES = 440;
  const TARGET_TREES = 320;

  for (const [cx, cz] of candidateCells) {
    const inNorthPark = cx > -48.0 && cx < -4.0 && cz > -86.0 && cz < -56.0;
    if (inNorthPark) continue;

    const wantCourtyard = courtyardTransforms.length < TARGET_COURTYARDS && (lRand() < 0.36 || houseTransforms.length >= TARGET_HOUSES);
    if (wantCourtyard) {
      const scXZ = 0.58 + lRand() * 0.42;
      const scY = 0.62 + lRand() * 0.44;
      if (canPlaceOnValley(cx, cz, 3.6 * scXZ, false)) {
        const groundY = sampleValleyFloorY(cx, cz);
        const baseYaw = lRand() < 0.62 ? 0.488 : 0.0;
        const yaw = baseYaw + (Math.floor(lRand() * 4) * Math.PI * 0.5) + (lRand() - 0.5) * 0.12;
        const shade = 0.92 + lRand() * 0.14;
        courtyardTransforms.push({ x: cx, y: groundY - 0.18, z: cz, sx: scXZ, sy: scY, sz: scXZ, yaw, shade });
        placedFootprints.push([cx, cz, 3.3 * scXZ]);
      }
    } else if (houseTransforms.length < TARGET_HOUSES) {
      const scXZ = 0.56 + lRand() * 0.48;
      const scY = 0.60 + lRand() * 0.52;
      if (canPlaceOnValley(cx, cz, 2.9 * scXZ, false)) {
        const groundY = sampleValleyFloorY(cx, cz);
        const baseYaw = lRand() < 0.65 ? 0.488 : 0.0;
        const yaw = baseYaw + (Math.floor(lRand() * 4) * Math.PI * 0.5) + (lRand() - 0.5) * 0.14;
        const shade = 0.91 + lRand() * 0.15;
        houseTransforms.push({ x: cx, y: groundY - 0.18, z: cz, sx: scXZ, sy: scY, sz: scXZ, yaw, shade });
        placedFootprints.push([cx, cz, 2.6 * scXZ]);
      }
    }
    if (houseTransforms.length >= TARGET_HOUSES && courtyardTransforms.length >= TARGET_COURTYARDS) break;
  }

  for (let attempt = 0; attempt < 4200 && treeTransforms.length < TARGET_TREES; attempt++) {
    let tx, tz;
    if (treeTransforms.length < 75) {
      tx = -50.0 + lRand() * 54.0;
      tz = -92.0 + lRand() * 38.0;
    } else if (treeTransforms.length < 155) {
      const rp = mainRiverCurve.getPoint(lRand());
      const sideSign = lRand() < 0.5 ? -1.0 : 1.0;
      tx = rp.x + sideSign * (25.5 + lRand() * 18.0);
      tz = rp.z + (lRand() - 0.5) * 18.0;
    } else if (treeTransforms.length < 210) {
      tx = -135.0 + lRand() * 260.0;
      tz = (lRand() < 0.5 ? 26.2 : 33.0) + (lRand() - 0.5) * 2.2;
    } else {
      tx = -188.0 + lRand() * 376.0;
      tz = -170.0 + lRand() * 282.0;
    }
    if (Math.hypot(tx + 18.0, tz + 20.0) > 202.0) continue;
    if (!canPlaceOnValley(tx, tz, 1.35, true)) continue;
    const groundY = sampleValleyFloorY(tx, tz);
    const sc = 0.65 + lRand() * 0.62;
    treeTransforms.push({ x: tx, y: groundY - 0.15, z: tz, sc, yaw: lRand() * Math.PI * 2.0 });
    placedFootprints.push([tx, tz, 1.15 * sc]);
  }

  const dummyM = new THREE.Object3D();
  const tmpCol = new THREE.Color();

  const instTownHouses = new THREE.InstancedMesh(townHouseGeo, tibetanBldgMat, houseTransforms.length);
  instTownHouses.castShadow = false;
  instTownHouses.receiveShadow = true;
  for (let i = 0; i < houseTransforms.length; i++) {
    const h = houseTransforms[i];
    dummyM.position.set(h.x, h.y, h.z);
    dummyM.rotation.set(0, h.yaw, 0);
    dummyM.scale.set(h.sx, h.sy, h.sz);
    dummyM.updateMatrix();
    instTownHouses.setMatrixAt(i, dummyM.matrix);
    tmpCol.setRGB(h.shade, h.shade * 0.99, h.shade * 0.96);
    instTownHouses.setColorAt(i, tmpCol);
  }
  instTownHouses.instanceMatrix.needsUpdate = true;
  if (instTownHouses.instanceColor) instTownHouses.instanceColor.needsUpdate = true;
  group.add(instTownHouses);
  stageTris += (townHouseGeo.index.count / 3) * houseTransforms.length;

  const instCourtyards = new THREE.InstancedMesh(courtyardGeo, tibetanBldgMat, courtyardTransforms.length);
  instCourtyards.castShadow = false;
  instCourtyards.receiveShadow = true;
  for (let i = 0; i < courtyardTransforms.length; i++) {
    const c = courtyardTransforms[i];
    dummyM.position.set(c.x, c.y, c.z);
    dummyM.rotation.set(0, c.yaw, 0);
    dummyM.scale.set(c.sx, c.sy, c.sz);
    dummyM.updateMatrix();
    instCourtyards.setMatrixAt(i, dummyM.matrix);
    tmpCol.setRGB(c.shade, c.shade * 0.99, c.shade * 0.95);
    instCourtyards.setColorAt(i, tmpCol);
  }
  instCourtyards.instanceMatrix.needsUpdate = true;
  if (instCourtyards.instanceColor) instCourtyards.instanceColor.needsUpdate = true;
  group.add(instCourtyards);
  stageTris += (courtyardGeo.index.count / 3) * courtyardTransforms.length;

  const instTrees = new THREE.InstancedMesh(treeGeo, treeMat, treeTransforms.length);
  instTrees.castShadow = false;
  instTrees.receiveShadow = false;
  for (let i = 0; i < treeTransforms.length; i++) {
    const tr = treeTransforms[i];
    dummyM.position.set(tr.x, tr.y, tr.z);
    dummyM.rotation.set(0, tr.yaw, 0);
    dummyM.scale.set(tr.sc, tr.sc * (0.92 + (i % 5) * 0.05), tr.sc);
    dummyM.updateMatrix();
    instTrees.setMatrixAt(i, dummyM.matrix);
  }
  instTrees.instanceMatrix.needsUpdate = true;
  group.add(instTrees);
  const treeProtoTris = treeGeo.index ? treeGeo.index.count / 3 : treeGeo.attributes.position.count / 3;
  stageTris += treeProtoTris * treeTransforms.length;

  // ==========================================================================
  // 6. VOLUMETRIC WHITE PLATEAU CUMULUS CLOUDS (`createVolumetricCloudSystem`)
  //    - Mountain Pass Entry Flanks (`穿过大山` at t=0..2s, clear of Potala sightline!)
  //    - 360° High Himalayan Horizon Cumulus Ring (matches `s4_potala_ref_board.jpg`!)
  //    - Golden-Roof Crown Exit Cloud Bank (`绕过宫殿，转眼来到故宫` at t=14.5..17.0s!)
  // ==========================================================================
  const cloudClusters = [
    // Mountain Pass Entry Portal Clouds (flanking high pass entry at t=0..1.4s, clear of Potala sightline!)
    { center: [ 68.0, 58.0,  68.0], radius: [16, 6.0, 13], puffs: 18, scale: [10.0, 20.0] },
    { center: [ 14.0, 64.0,  70.0], radius: [15, 5.5, 12], puffs: 16, scale: [ 9.5, 19.0] },
    // High Golden-Roof Exit Cumulus Bank (`t = 14.5..17.0s` transition to Beijing Forbidden City!)
    { center: [ -6.0, 77.5, -66.0], radius: [18, 6.2, 14], puffs: 20, scale: [10.0, 19.0] },
    { center: [ 16.0, 77.5, -20.5], radius: [18, 6.8, 15], puffs: 24, scale: [10.0, 21.0] },
    { center: [ 26.0, 79.0,  -6.0], radius: [20, 7.5, 16], puffs: 22, scale: [11.0, 23.0] },
    // Distant 360° Himalayan Crest Sunlit Cumulus Ring (hovering along snow ridges at y=98..112m, matching `s4_potala_ref_board.jpg`!)
    { center: [ -35.0, 102.0, -242.0], radius: [36, 7.5, 16], puffs: 18, scale: [16.0, 28.0] },
    { center: [  78.0, 100.0, -232.0], radius: [38, 7.5, 16], puffs: 18, scale: [16.0, 28.0] },
    { center: [ 188.0,  96.0, -148.0], radius: [34, 7.0, 16], puffs: 16, scale: [15.0, 26.0] },
    { center: [ 228.0,  94.0,  -15.0], radius: [34, 7.0, 16], puffs: 16, scale: [15.0, 26.0] },
    { center: [ 182.0,  95.0,  138.0], radius: [34, 7.0, 16], puffs: 15, scale: [15.0, 26.0] },
    { center: [-172.0,  98.0, -168.0], radius: [36, 7.5, 16], puffs: 16, scale: [16.0, 28.0] },
    { center: [-232.0,  96.0,  -25.0], radius: [34, 7.0, 16], puffs: 16, scale: [15.0, 26.0] },
    { center: [-182.0,  95.0,  130.0], radius: [34, 7.0, 16], puffs: 15, scale: [15.0, 26.0] },
    { center: [ -15.0,  94.0,  222.0], radius: [36, 7.0, 16], puffs: 15, scale: [15.0, 26.0] },
  ];

  const plateauClouds = createVolumetricCloudSystem({
    clusters: cloudClusters,
    sunDir: SUN_DIR,
    litColor: 0xffffff,
    shadowColor: 0x9cbbe8,
    rimColor: 0xfff8e6,
    opacity: 0.66,
    seed: 4048,
  });
  group.add(plateauClouds.mesh);

  // Subtle Crystalline Tibetan Sunbeam Rays slanting across Red Hill & Golden Roofs
  {
    const rayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: atmoUniforms.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float beam = pow(max(0.0, across), 2.8);
          float along = smoothstep(0.0, 0.26, vUv.y) * smoothstep(1.0, 0.20, vUv.y);
          float shimmer = 0.88 + 0.12 * sin(uTime * 1.5 + vUv.x * 8.0);
          float a = beam * along * shimmer * 0.042;
          gl_FragColor = vec4(vec3(0.96, 0.98, 1.00) * a, a);
        }
      `,
    });
    for (const [tx, ty, tz, w, len] of [
      [ -8, 28,  18, 22, 180],
      [-18, 46, -24, 28, 195],
      [-28, 68, -35, 30, 210],
    ]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
      const targetV = new THREE.Vector3(tx, ty, tz);
      m.position.copy(targetV.clone().lerp(SUN_POS, 0.42));
      m.lookAt(SUN_POS);
      m.rotateX(Math.PI * 0.5);
      group.add(m);
    }
  }

  // Omni `#000000` Sparkling Diamond-Dust & High-Altitude Snow Spindrift VFX Planes!
  const omniSpindrift = createLoopingVideoTexture('./assets/soarin_scene4_potala/pt_omni_snow_spindrift.mp4');
  const omniSpindriftMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniSpindrift.vTex },
      uTint: { value: new THREE.Color(0xfffaf0) },
      uOpacity: { value: 0.18 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uVid, vUv).rgb;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 cleanC = max(vec3(0.0), c - vec3(0.06));
        float fx = smoothstep(0.06, 0.34, vUv.x) * smoothstep(0.94, 0.68, vUv.x);
        float fy = smoothstep(0.08, 0.34, vUv.y) * smoothstep(0.92, 0.66, vUv.y);
        float w = smoothstep(0.08, 0.58, luma) * fx * fy * uOpacity;
        gl_FragColor = vec4(cleanC * uTint * (w * 1.35), w);
      }
    `,
  });
  for (const cfg of [
    { pos: [ -6.5, 29.0,  16.0], scale: [18,  9], rotY:  0.22 },
    { pos: [-52.0, 48.0, -22.0], scale: [22, 11], rotY: -0.35 },
    { pos: [-38.0, 66.0, -52.0], scale: [24, 12], rotY:  0.18 },
    { pos: [ -8.0, 72.5, -36.0], scale: [26, 13], rotY: -0.15 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniSpindriftMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rotY;
    m.renderOrder = 5;
    group.add(m);
  }

  // 240 Sparkling 3D Sunlit Diamond-Dust Ice Crystals drifting through the flight corridor!
  const DUST_COUNT = 240;
  const dustGeo = new THREE.OctahedronGeometry(0.038, 0);
  const dustMat = new THREE.MeshBasicMaterial({
    color: 0xfffdf5,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const dustInst = new THREE.InstancedMesh(dustGeo, dustMat, DUST_COUNT);
  dustInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(dustInst);

  let dSeed = 4040;
  const dRand = () => { dSeed = (dSeed * 16807) % 2147483647; return (dSeed - 1) / 2147483646; };
  const dustParticles = Array.from({ length: DUST_COUNT }, () => ({
    x0: -68.0 + dRand() * 88.0,
    y0: 22.0 + dRand() * 56.0,
    z0: -64.0 + dRand() * 108.0,
    vx: 1.4 + dRand() * 2.0,
    vy: -0.25 + dRand() * 0.6,
    vz: -0.8 + dRand() * 1.6,
    phase: dRand() * Math.PI * 2.0,
    size: 0.38 + dRand() * 0.88,
  }));
  const dummyDust = new THREE.Object3D();

  // ==========================================================================
  // 7. V3 EXACT USER CHOREOGRAPHY (`DURATION = 17.0s`, 0.0° Roll C2 Camera!)
  //    User Spec: "穿过大山，看到布达拉宫，从下面环形上骑行，绕过宫殿，转眼来到故宫"
  //    - 0.0s – 3.8s: Emerge through Mountain Pass & Left Foreground Diagonal 5-Color Lungta Flags!
  //    - 3.8s – 14.2s: Sweeping Upward Helical Ring Ride (`y = 20.8m -> 71.8m`) from foot of Marpo Ri
  //      curving around front Zigzag Stairs & Stupa Promontory Flags, West Bastion, NW Vista & 5 Golden Roofs!
  //    - 14.2s – 17.0s: Rounding the 24K Golden Roofs into sunlit cumulus clouds -> Forbidden City!
  // ==========================================================================
  const PALACE_CX = -28.8;
  const PALACE_CZ = -35.7;

  const heroKeyframes = [
    { t:  0.0, pos: [ 53.5, 49.2,  46.2] }, // Emerging high through the sunlit mountain pass saddle (`穿过大山`)!
    { t:  1.8, pos: [ 36.8, 46.8,  47.2] }, // Gliding Right-to-Left in full sunlit 3/4 side-profile past Rig A foreground 5-color Lungta flags!
    { t:  3.1, pos: [ 21.5, 34.5,  31.2] }, // Swooping smoothly East of the pass cairn toward the foot of Marpo Ri!
    { t:  4.4, pos: [  5.8, 23.2,  15.2] }, // Reaching the lower East base of Marpo Ri to initiate the upward helical ring!
    { t:  6.5, pos: [-17.5, 35.8,  15.8] }, // Climbing heroically across front Zigzag Stairs & Rig B Stupa-Promontory diagonal prayer flags!
    { t:  9.1, pos: [-71.5, 49.5, -16.5] }, // Curving smoothly outside the Western Cylindrical Bastion & West Palace flank (>6m clear)!
    { t: 11.0, pos: [-64.5, 60.2, -52.5] }, // Spiraling around North-West vista with 360° Himalayan glaciers & Lhasa River across horizon!
    { t: 13.3, pos: [-29.0, 69.5, -58.8] }, // Rounding North crown right alongside the 5 gleaming 24K Golden Palace Roofs!
    { t: 14.8, pos: [ -8.5, 71.8, -44.5] }, // Sweeping past East Golden Roofs (`GoldenRoof_1` & `GoldenRoof_3`)!
    { t: 17.0, pos: [ 15.5, 76.8, -16.5] }, // Gliding into luminous sunlit white cumulus clouds -> match-cut to Beijing Forbidden City!
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.36,
    bankGain: 0.42,
    maxBankRad: 0.20,
  });

  const PT_GAZE = [
    { t:  0.0, yaw:  0.18, pitch: -0.05 }, // Beholding Potala Palace & Lhasa valley as mountain pass opens!
    { t:  1.8, yaw: -0.22, pitch: -0.06 }, // Glancing toward camera/Potala Palace as Lungta prayer flags sweep past!
    { t:  4.2, yaw:  0.24, pitch: -0.06 }, // Looking inward/upward at the towering White Palace while spiraling up!
    { t:  6.8, yaw:  0.26, pitch: -0.04 }, // Admiring the foreground Lungta flags & crimson Red Palace!
    { t: 10.8, yaw:  0.24, pitch: -0.04 }, // Keeping gaze inward toward the Golden Roofs during the NW/N ring!
    { t: 14.5, yaw:  0.22, pitch:  0.02 }, // Marveling at the 5 gleaming 24K Golden Roofs right alongside!
    { t: 16.4, yaw:  0.00, pitch: -0.04 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const camIntro = new THREE.Vector3();
  const lookIntro = new THREE.Vector3();
  const camSpiral = new THREE.Vector3();
  const lookSpiral = new THREE.Vector3();

  // IMAX Wide-Angle Hero Camera Director (`FOV = 50.8° – 52.0°`, `~3.85m` True Visual-Center Distance, `0.0°` Roll):
  // Note: `pelicanRig.root` origin (`tmpH`) is at the bottom of the bicycle tires (`y = 0..2.25m`, visual center `+1.12m`).
  // Collinear optical-axis pitch locking guarantees Pelican + Bicycle sits cleanly at `centerY ~ +0.16` (ZERO head clipping!)
  // filling `~42%–48%` of the frame in ALL 4 shots while Potala Palace, foreground 5-color Lungta prayer flags,
  // 690-building Lhasa town, Lhasa River & 360° snow peaks fill the wide panoramic background!
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);
    const heroMidY = tmpH.y + 1.12;

    // Beat 1 (0.0s – 3.8s): 3.85m 3/4 side-front IMAX hero camera (`FOV = 52°`) framing Pelican gliding Right-to-Left
    // past Rig A's 5-color foreground diagonal Lungta flags with Potala Palace center-left & Lhasa River lower-right!
    const dIntroH = 3.85;
    camIntro.set(
      tmpH.x + 1.55,
      heroMidY + 0.35,
      tmpH.z + 3.52
    );
    const introLookDist = 18.0;
    // Optical axis passes 0.25m below `heroMidY` so Pelican centers cleanly around `y_ndc = +0.14` (zero top clipping!)
    const introAxisAtHeroY = heroMidY - 0.25;
    lookIntro.set(
      camIntro.x - 8.2,
      camIntro.y + (introAxisAtHeroY - camIntro.y) * (introLookDist / dIntroH),
      camIntro.z - 16.0
    );

    // Beat 2 & 3 (3.8s – 17.0s): Concentric outer-ring IMAX hero pursuit (`FOV = 50.8°`, `dHoriz = 3.85m..3.95m`)
    let rx = tmpH.x - PALACE_CX;
    let rz = tmpH.z - PALACE_CZ;
    const rLen = Math.hypot(rx, rz) || 1.0;
    rx /= rLen;
    rz /= rLen;

    const spiralProg = quintic01(4.2, 15.5, tc);
    const rawOut = THREE.MathUtils.lerp(2.95, 2.85, spiralProg);
    const rawTrail = THREE.MathUtils.lerp(1.45, 1.65, spiralProg);
    let ox = rx * rawOut - tmpHz.x * rawTrail;
    let oz = rz * rawOut - tmpHz.z * rawTrail;
    const oLen = Math.hypot(ox, oz) || 1.0;
    const dSpiralH = THREE.MathUtils.lerp(3.85, 3.95, spiralProg);
    ox = (ox / oLen) * dSpiralH;
    oz = (oz / oLen) * dSpiralH;

    // Camera sits slightly above `heroMidY` as we climb higher so Golden Roofs & Lhasa Valley Town shine below Pelican!
    const camUpFromMid = THREE.MathUtils.lerp(0.15, 0.72, spiralProg);
    camSpiral.set(
      tmpH.x + ox,
      heroMidY + camUpFromMid,
      tmpH.z + oz
    );

    const exitFwdBlend = quintic01(14.6, 16.8, tc);
    const inWeight = THREE.MathUtils.lerp(14.5, 10.8, exitFwdBlend);
    const fwdWeight = THREE.MathUtils.lerp(5.8, 7.5, exitFwdBlend);
    const lx = (tmpH.x - rx * inWeight + tmpHz.x * fwdWeight) - camSpiral.x;
    const lz = (tmpH.z - rz * inWeight + tmpHz.z * fwdWeight) - camSpiral.z;
    const lHorizDist = Math.hypot(lx, lz) || 16.0;

    // Pass optical axis 0.24m..0.34m below `heroMidY` so Pelican + Bicycle sits at `centerY ~ +0.16` (zero head clipping!)
    const axisAtHeroY = heroMidY - THREE.MathUtils.lerp(0.24, 0.34, spiralProg);
    lookSpiral.set(
      camSpiral.x + lx,
      camSpiral.y + (axisAtHeroY - camSpiral.y) * (lHorizDist / dSpiralH),
      camSpiral.z + lz
    );

    const bSpiral = quintic01(2.3, 4.6, tc);
    outPos.copy(camIntro).lerp(camSpiral, bSpiral);
    outLook.copy(lookIntro).lerp(lookSpiral, bSpiral);

    return THREE.MathUtils.lerp(52.0, 50.8, bSpiral);
  }, DURATION, 0.20);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);

    const climbBoost = quintic01(3.8, 14.5, tCycle);
    const thrust = THREE.MathUtils.lerp(0.95, 1.68, climbBoost);
    const windStrength = THREE.MathUtils.lerp(1.18, 1.60, climbBoost);

    atmoUniforms.uTime.value = tGlobal;
    atmoUniforms.uWindBoost.value = THREE.MathUtils.lerp(1.05, 1.42, climbBoost);
    plateauClouds.update(tGlobal);

    for (let i = 0; i < DUST_COUNT; i++) {
      const dp = dustParticles[i];
      const dx = ((dp.x0 + tGlobal * dp.vx + 68.0) % 88.0) - 68.0;
      const dy = dp.y0 + Math.sin(tGlobal * 1.8 + dp.phase) * 0.9;
      const dz = ((dp.z0 + tGlobal * dp.vz + 64.0) % 108.0) - 64.0;
      const twinkle = (0.45 + 0.55 * Math.abs(Math.sin(tGlobal * 5.5 + dp.phase))) * dp.size;
      dummyDust.position.set(dx, dy, dz);
      dummyDust.rotation.set(tGlobal * 2.2 + dp.phase, tGlobal * 1.7, dp.phase);
      dummyDust.scale.setScalar(twinkle);
      dummyDust.updateMatrix();
      dustInst.setMatrixAt(i, dummyDust.matrix);
    }
    dustInst.instanceMatrix.needsUpdate = true;

    const bankRad = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: 6.5 + climbBoost * 1.9,
      nightLamp01: 0.03,
      tCycle,
      gazeSchedule: PT_GAZE,
      cycleLen: DURATION,
    });

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 86.0);

    if (camMode === 'arch_facade_windows_macro') {
      pelicanRig.root.visible = false;
      camera.fov = 35;
      camera.position.set(7.8, 46.2, 9.8);
      camera.lookAt(-22.5, 51.2, -28.5);
      camera.updateProjectionMatrix();
      return { beatText: '建筑微距 · 布达拉宫收分白宫红宫、边玛墙与 392 扇黑框梯形藏窗' };
    }
    if (camMode === 'arch_golden_roofs_flags_macro') {
      pelicanRig.root.visible = false;
      camera.fov = 39;
      camera.position.set(-4.5, 25.8, 36.2);
      camera.lookAt(-14.5, 41.5, -8.5);
      camera.updateProjectionMatrix();
      return { beatText: '人文微距 · 尊胜白塔五彩隆达风马经幡与红宫鎏金铜瓦金顶群' };
    }
    pelicanRig.root.visible = true;

    applyStabilizedCam(tCycle, camera);

    let beatText = '第一幕 · 穿过大山云垭与前景五彩隆达经幡 · 布达拉宫、拉萨河谷藏式民居群与雪峰豁然现身';
    if (tCycle >= 3.8 && tCycle < 14.2) {
      beatText = '第二幕 · 自红山山麓环形向上骑行盘升 · 掠过白石阶、尊胜白塔经幡阵与白宫红宫全貌';
    } else if (tCycle >= 14.2) {
      beatText = '第三幕 · 环绕五大鎏金铜瓦金顶群穿入高原白云 · 金辉流转间转眼来到北京故宫';
    }
    return { beatText };
  }

  function dispose() {
    for (const d of customDisposables) {
      if (d && typeof d.dispose === 'function') {
        try { d.dispose(); } catch (e) {}
      }
    }
  }

  await applyStationHdPbrUpgrade(4, group, renderer);

  return {
    id: 4,
    slug: 'potala',
    nameZh: '西藏布达拉宫',
    titleZh: '西藏布达拉宫 · 经幡雪山环形腾空',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.92,
    fogColor: new THREE.Color(0x9ac4f8),
    fogDensity: 0.00048,
    exposure: 1.05,
    transitionColor: '#ffffff',
    omniVideos: [omniSpindrift.vid],
    stageTris: Math.round(stageTris),
    heroTrack,
    applyStabilizedCam,
    update,
    dispose,
  };
}
