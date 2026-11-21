// ============================================================================
// V3 STATION 01: 万里长城 · 振铃破云日出 (THE GREAT WALL AT GOLDEN DAWN)
// Standardized Soarin' Over China 3D Station Module — V3 Lookdev & Cinema Upgrade
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  smoothstep01,
  quintic01,
  createSurfaceHeightSampler,
  createHeroTrajectory,
  applyHorizontalOffset,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station01_GreatWall_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 18.0;

  // Golden morning sun positioned in the upper-right forward horizon over the 5-layer Jinshanling ridges
  const SUN_POS = new THREE.Vector3(66.0, 62.0, -255.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  // 1. Radiant Golden-Sunrise Sea-of-Clouds 360° Sky Dome (`gw_sky_v3_panorama.jpg`) + Solar Corona + PMREM
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene1_gw/gw_sky_v3_panorama.jpg', resolve, undefined, reject);
  });
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;

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
        float h = clamp(d.y, -0.25, 1.0);
        vec3 ceruleanZenith = vec3(0.30, 0.56, 0.85);
        vec3 goldenHorizon  = vec3(0.96, 0.82, 0.56);
        vec3 cleanGrad = mix(goldenHorizon, ceruleanZenith, smoothstep(0.04, 0.44, h));
        vec3 col = mix(texCol * 0.96, cleanGrad, smoothstep(0.14, 0.52, h) * 0.46 + 0.10);

        float mu = max(0.0, dot(d, normalize(uSunDir)));
        float sunDisc = smoothstep(0.9986, 0.9997, mu);
        float innerGlow = pow(mu, 48.0) * 0.46;
        float wideHalo = pow(mu, 7.0) * 0.16;

        col += vec3(1.0, 0.82, 0.44) * wideHalo;
        col += vec3(1.0, 0.94, 0.74) * innerGlow;
        col += vec3(1.0, 0.98, 0.90) * sunDisc * 1.4;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(540, 60, 40), skyDomeMat);
  const phiTexSun = 2.0 * Math.PI * 0.6938;
  const thetaTexLocal = Math.atan2(-Math.cos(phiTexSun), -Math.sin(phiTexSun));
  const thetaWorldSun = Math.atan2(SUN_DIR.x, -SUN_DIR.z);
  skyDome.rotation.y = thetaTexLocal - thetaWorldSun;
  group.add(skyDome);

  let envTexture = null;
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(40, 28, 18), skyDomeMat);
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
    addCard([14, 10, -24], [20, 12], 0xffe4a8);
    addCard([-18, 14, 8], [16, 12], 0x9ac2f4);
    addCard([0, -14, 0], [32, 32], 0x5c7a42);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
  }

  // 2. Golden Sunrise Station Lighting Rig + Warm Watchtower Interior Lantern Glow
  const hemiLight = new THREE.HemisphereLight(0xb2d4ff, 0x5e7840, 0.68);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffe0a2, 3.10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -32;
  sunLight.shadow.camera.right = 32;
  sunLight.shadow.camera.top = 32;
  sunLight.shadow.camera.bottom = -32;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 170.0;
  sunLight.shadow.bias = -0.00035;
  group.add(sunLight);
  group.add(sunLight.target);

  const skyFillLight = new THREE.DirectionalLight(0x8ebaff, 0.68);
  skyFillLight.position.set(-70, 52, 60);
  group.add(skyFillLight);

  const cloudBounceLight = new THREE.DirectionalLight(0xffcb7e, 0.54);
  cloudBounceLight.position.set(16, -28, -24);
  group.add(cloudBounceLight);

  const lanternLight1 = new THREE.PointLight(0xffa838, 2.6, 13.0, 1.6);
  lanternLight1.position.set(-8.5, 31.2, 4.0);
  const lanternLight2 = new THREE.PointLight(0xffa838, 2.6, 13.0, 1.6);
  lanternLight2.position.set(-20.0, 50.4, -90.0);
  group.add(lanternLight1, lanternLight2);

  // 3. Soft Translucent Valley Mist + Towering 3D Volumetric Cumulus Banks + Radial Sunbeams + Omni Sunrise Mist
  const atmoUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: SUN_DIR },
  };

  const mistCarpetGeo = new THREE.PlaneGeometry(580, 580, 100, 100);
  mistCarpetGeo.rotateX(-Math.PI * 0.5);

  function addValleyMistLayer(yHeight, densityScale, speedScale, opacityBase) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: atmoUniforms.uTime,
        uSunDir: atmoUniforms.uSunDir,
        uScale: { value: densityScale },
        uSpeed: { value: speedScale },
        uOpacity: { value: opacityBase },
      },
      vertexShader: `
        #include <fog_pars_vertex>
        uniform float uTime;
        uniform float uScale;
        uniform float uSpeed;
        varying vec3 vWPos;
        varying float vPuff;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) { return 0.52 * vnoise(p) + 0.31 * vnoise(p * 2.13 + 4.1) + 0.17 * vnoise(p * 4.35 + 8.7); }
        void main() {
          vec3 pos = position;
          vec2 drift = vec2(-uTime * 1.15 * uSpeed, uTime * 0.45 * uSpeed);
          float n = fbm(pos.xz * uScale + drift);
          float billow = pow(smoothstep(0.28, 0.88, n), 1.25);
          pos.y += billow * 3.2;
          vPuff = billow;
          vec4 wp = modelMatrix * vec4(pos, 1.0);
          vWPos = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform float uScale;
        uniform float uSpeed;
        uniform float uOpacity;
        uniform vec3 uSunDir;
        varying vec3 vWPos;
        varying float vPuff;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) { return 0.52 * vnoise(p) + 0.30 * vnoise(p * 2.2 + 1.9) + 0.18 * vnoise(p * 4.7 + 5.3); }
        void main() {
          vec2 drift = vec2(-uTime * 1.15 * uSpeed, uTime * 0.45 * uSpeed);
          float detail = fbm(vWPos.xz * (uScale * 2.4) + drift * 1.2);
          float density = clamp(vPuff * 0.68 + detail * 0.40 - 0.18, 0.0, 1.0);
          vec3 coolMist  = vec3(0.76, 0.83, 0.90);
          vec3 pearlMist = vec3(0.97, 0.92, 0.82);
          vec3 goldRim   = vec3(1.00, 0.94, 0.78);
          vec3 col = mix(coolMist, pearlMist, smoothstep(0.15, 0.65, density));
          float sunAz = max(0.0, dot(normalize(vWPos - vec3(0.0, 20.0, 20.0)), normalize(uSunDir)));
          col = mix(col, goldRim, pow(sunAz, 2.2) * 0.48);

          float distFade = smoothstep(295.0, 115.0, length(vWPos.xz - vec2(0.0, -85.0)));
          float alpha = smoothstep(0.12, 0.72, density) * uOpacity * distFade;
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }
      `,
    });
    const m = new THREE.Mesh(mistCarpetGeo, mat);
    m.position.set(0.0, yHeight, -85.0);
    m.renderOrder = 2;
    group.add(m);
  }
  addValleyMistLayer(16.2, 0.022, 0.72, 0.44);
  addValleyMistLayer(19.2, 0.030, 0.95, 0.32);

  // Towering Puffy Sunlit Golden-Cream 3D Cumulus Cloud Banks (`volumetric_clouds.js`)
  // Sculpted with warm golden-cream sunlit tops & atmospheric slate-violet shadows so puffs have crisp 3D volume (ZERO white blowout!)
  const cumulusSystem = createVolumetricCloudSystem({
    sunDir: SUN_DIR,
    litColor: 0xfff5dc,
    shadowColor: 0x7688a6,
    rimColor: 0xffcb70,
    opacity: 0.64,
    seed: 202605,
    clusters: [
      // Towering Left Cumulus Wall (frames left side of wide vista & uphill climb!)
      { center: [-42.0, 44.0,   4.0], radius: [13, 18, 15], puffs: 24, scale: [12.0, 23.0] },
      { center: [-54.0, 52.0, -34.0], radius: [16, 22, 18], puffs: 26, scale: [14.0, 26.0] },
      { center: [-58.0, 54.0, -78.0], radius: [18, 22, 20], puffs: 24, scale: [14.0, 26.0] },
      { center: [-52.0, 58.0,-118.0], radius: [18, 22, 20], puffs: 24, scale: [15.0, 27.0] },
      // Towering Right Sunlit Cumulus Wall (`x ~ +46..+64`, leaving central sun & radial God-rays crisp!)
      { center: [ 46.0, 42.0,  -2.0], radius: [14, 17, 15], puffs: 22, scale: [12.0, 23.0] },
      { center: [ 58.0, 49.0, -44.0], radius: [17, 20, 18], puffs: 24, scale: [14.0, 26.0] },
      { center: [ 62.0, 53.0, -94.0], radius: [18, 21, 20], puffs: 24, scale: [15.0, 27.0] },
      // Soft Valley Cumulus Ribbons (`y ~ 17..23m` weaving between emerald mountain ridges)
      { center: [ 16.0, 19.0, -18.0], radius: [15,  4.5, 15], puffs: 16, scale: [ 9.5, 17.0] },
      { center: [-28.0, 18.8, -28.0], radius: [15,  4.5, 15], puffs: 16, scale: [ 9.5, 17.0] },
      { center: [ 18.0, 20.5, -68.0], radius: [18,  5.5, 18], puffs: 18, scale: [10.5, 19.0] },
      { center: [-36.0, 21.5, -72.0], radius: [18,  5.5, 18], puffs: 18, scale: [10.5, 19.0] },
      { center: [ 28.0, 24.5,-134.0], radius: [26,  6.5, 22], puffs: 20, scale: [12.0, 22.0] },
      { center: [-38.0, 25.5,-138.0], radius: [26,  6.5, 22], puffs: 20, scale: [12.0, 22.0] },
      // Dense Towering Golden Exit Cloud Bank (`z ~ -110..-140, y ~ 53..68m`) for Beat 4 `穿过迷雾`!
      { center: [ -8.5, 55.0,-112.0], radius: [15, 11, 10], puffs: 24, scale: [11.0, 20.0] },
      { center: [ -3.5, 60.0,-124.0], radius: [22, 14, 14], puffs: 28, scale: [13.0, 24.0] },
      { center: [  2.0, 63.5,-138.0], radius: [26, 15, 15], puffs: 28, scale: [14.0, 26.0] },
    ],
  });
  group.add(cumulusSystem.mesh);

  // Blazing Golden Crepuscular Sunbeams (Radial God-Ray Fan streaming from `SUN_POS` across the 5 mountain ridges!)
  {
    const rayMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: { uTime: atmoUniforms.uTime },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
          float beam = pow(max(0.0, across), 2.5);
          float along = smoothstep(0.0, 0.28, vUv.y) * smoothstep(1.0, 0.22, vUv.y);
          float shimmer = 0.88 + 0.12 * sin(uTime * 1.2 + vUv.x * 8.0);
          float a = beam * along * shimmer * 0.088;
          gl_FragColor = vec4(vec3(1.0, 0.84, 0.44) * a, a);
        }
      `,
    });
    const rayTargets = [
      [-68, 22, -125, 20, 230],
      [-42, 24, -110, 22, 225],
      [-18, 28,  -92, 22, 215],
      [  4, 26,  -85, 22, 210],
      [ 26, 25,  -95, 22, 210],
      [ 50, 27, -115, 24, 215],
      [ 76, 29, -135, 24, 220],
      [ -8, 24,  -28, 20, 230],
    ];
    for (const [tx, ty, tz, w, len] of rayTargets) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
      const targetV = new THREE.Vector3(tx, ty, tz);
      m.position.copy(targetV.clone().lerp(SUN_POS, 0.50));
      m.lookAt(SUN_POS);
      m.rotateX(Math.PI * 0.5);
      m.renderOrder = 5;
      group.add(m);
    }
  }

  // Gemini Omni 1.1 Sunrise Mist Video Veils (`gw_omni_sunrise_mist.mp4`, normal-blended warm gold so ZERO white blowout!)
  const omniMist = createLoopingVideoTexture('./assets/soarin_scene1_gw/gw_omni_sunrise_mist.mp4');
  const omniMistMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uVid: { value: omniMist.vTex },
      uTint: { value: new THREE.Color(0xffdfa6) },
      uOpacity: { value: 0.30 },
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
        float fx = smoothstep(0.04, 0.32, vUv.x) * smoothstep(0.96, 0.68, vUv.x);
        float fy = smoothstep(0.06, 0.28, vUv.y) * smoothstep(0.94, 0.72, vUv.y);
        float alpha = smoothstep(0.05, 0.56, luma) * fx * fy * uOpacity;
        if (alpha < 0.004) discard;
        vec3 col = mix(vec3(0.88, 0.84, 0.82), uTint, smoothstep(0.15, 0.75, luma));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  for (const cfg of [
    { pos: [ 12.0, 22.0,  -8.0], scale: [30, 14], rotY: -0.22 },
    { pos: [-16.0, 23.5, -28.0], scale: [32, 15], rotY:  0.18 },
    { pos: [-24.0, 33.5, -64.0], scale: [36, 17], rotY:  0.26 },
    { pos: [-10.0, 54.0,-106.0], scale: [44, 22], rotY:  0.06 },
    { pos: [ -4.0, 60.0,-122.0], scale: [54, 26], rotY: -0.06 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniMistMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rotY;
    m.renderOrder = 4;
    group.add(m);
  }

  // 4. Load V3 Great Wall & 5-Layer Jinshanling Forested Mountain GLB + 700 GPU-Instanced Trees!
  const layoutRes = await fetch('./assets/soarin_scene1_gw/great_wall_stage_layout.json');
  const stageLayout = await layoutRes.json();

  const gwGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene1_gw/great_wall_hero_stage.glb', resolve, undefined, reject);
  });

  const gwMatsConfigured = new Set();
  let protoPineBarkGeo = null, protoPineBarkMat = null;
  let protoPineNeedlesGeo = null, protoPineNeedlesMat = null;
  let protoForestGeo = null, protoForestMat = null;
  let protoAutumnGeo = null, protoAutumnMat = null;
  let stageTris = 0;

  gwGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name === 'Proto_Pine_Bark') { protoPineBarkGeo = obj.geometry; protoPineBarkMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Pine_Needles') { protoPineNeedlesGeo = obj.geometry; protoPineNeedlesMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Forest_Canopy') { protoForestGeo = obj.geometry; protoForestMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Autumn_Foliage') { protoAutumnGeo = obj.geometry; protoAutumnMat = obj.material; obj.visible = false; return; }

    const isLantern = obj.name.includes('WarmLanterns');
    obj.castShadow = !isLantern;
    obj.receiveShadow = !isLantern;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    const m = obj.material;
    if (m && !gwMatsConfigured.has(m.uuid)) {
      gwMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      const isFoliageMat =
        m.name &&
        (m.name.includes('PineNeedles') ||
          m.name.includes('ForestCanopy') ||
          m.name.includes('SunlitCrown') ||
          m.name.includes('MountainForest'));
      if (isFoliageMat) {
        // Eliminate whitish sky specular glare so emerald-olive mountain forests stay rich & saturated!
        m.envMapIntensity = 0.20;
        m.roughness = 0.92;
        m.metalness = 0.0;
        if (m.sheen !== undefined) m.sheen = 0.0;
      }
      if (
        m.name &&
        (m.name.includes('PineNeedles') || m.name.includes('ForestCanopy') || m.name.includes('SunlitCrown'))
      ) {
        m.customProgramCacheKey = () => 'gw_v3_foliage_breeze_' + m.name;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             #ifdef USE_INSTANCING
               vec3 fwPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
             #else
               vec3 fwPos = (modelMatrix * vec4(position, 1.0)).xyz;
             #endif
             float sway = sin(uTime * 2.1 + fwPos.x * 0.35 + fwPos.z * 0.32) * 0.065;
             transformed.x += sway;
             transformed.z += cos(uTime * 1.7 + fwPos.y * 0.45) * 0.045;`
          );
        };
        m.needsUpdate = true;
      }
    }
  });
  group.add(gwGltf.scene);

  // Configure prototype foliage materials too (since prototypes returned early before material config!)
  for (const pm of [protoPineNeedlesMat, protoForestMat, protoAutumnMat]) {
    if (!pm || gwMatsConfigured.has(pm.uuid)) continue;
    gwMatsConfigured.add(pm.uuid);
    for (const tk of ['map', 'normalMap', 'roughnessMap']) {
      if (pm[tk]) pm[tk].anisotropy = maxAniso;
    }
    pm.envMapIntensity = 0.20;
    pm.roughness = 0.92;
    pm.metalness = 0.0;
    if (pm.sheen !== undefined) pm.sheen = 0.0;
    pm.customProgramCacheKey = () => 'gw_v3_foliage_breeze_' + pm.name;
    pm.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = atmoUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
           vec3 fwPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
         #else
           vec3 fwPos = (modelMatrix * vec4(position, 1.0)).xyz;
         #endif
         float sway = sin(uTime * 2.1 + fwPos.x * 0.35 + fwPos.z * 0.32) * 0.065;
         transformed.x += sway;
         transformed.z += cos(uTime * 1.7 + fwPos.y * 0.45) * 0.045;`
      );
    };
    pm.needsUpdate = true;
  }

  // Build 700 GPU-Instanced Lush Forest Canopy Pads, Sunlit Crowns & Cliff Pines
  const dummyTree = new THREE.Object3D();
  if (protoPineBarkGeo && protoPineNeedlesGeo && stageLayout.scatter_pines?.length) {
    const nP = stageLayout.scatter_pines.length;
    const instBark = new THREE.InstancedMesh(protoPineBarkGeo, protoPineBarkMat, nP);
    const instNeedles = new THREE.InstancedMesh(protoPineNeedlesGeo, protoPineNeedlesMat, nP);
    instBark.castShadow = false; instBark.receiveShadow = true;
    instNeedles.castShadow = false; instNeedles.receiveShadow = true;
    stageLayout.scatter_pines.forEach((it, i) => {
      dummyTree.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummyTree.rotation.set(0, it.yaw, 0);
      dummyTree.scale.setScalar(it.scale);
      dummyTree.updateMatrix();
      instBark.setMatrixAt(i, dummyTree.matrix);
      instNeedles.setMatrixAt(i, dummyTree.matrix);
    });
    instBark.instanceMatrix.needsUpdate = true;
    instNeedles.instanceMatrix.needsUpdate = true;
    stageTris += nP * ((protoPineBarkGeo.index.count + protoPineNeedlesGeo.index.count) / 3);
    group.add(instBark, instNeedles);
  }
  if (protoForestGeo && stageLayout.scatter_forest?.length) {
    const nF = stageLayout.scatter_forest.length;
    const instFor = new THREE.InstancedMesh(protoForestGeo, protoForestMat, nF);
    instFor.castShadow = false; instFor.receiveShadow = true;
    stageLayout.scatter_forest.forEach((it, i) => {
      dummyTree.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummyTree.rotation.set(0, it.yaw, 0);
      dummyTree.scale.setScalar(it.scale);
      dummyTree.updateMatrix();
      instFor.setMatrixAt(i, dummyTree.matrix);
    });
    instFor.instanceMatrix.needsUpdate = true;
    stageTris += nF * (protoForestGeo.index.count / 3);
    group.add(instFor);
  }
  if (protoAutumnGeo && stageLayout.scatter_autumn?.length) {
    const nA = stageLayout.scatter_autumn.length;
    const instAut = new THREE.InstancedMesh(protoAutumnGeo, protoAutumnMat, nA);
    instAut.castShadow = false; instAut.receiveShadow = true;
    stageLayout.scatter_autumn.forEach((it, i) => {
      dummyTree.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummyTree.rotation.set(0, it.yaw, 0);
      dummyTree.scale.setScalar(it.scale);
      dummyTree.updateMatrix();
      instAut.setMatrixAt(i, dummyTree.matrix);
    });
    instAut.instanceMatrix.needsUpdate = true;
    stageTris += nA * (protoAutumnGeo.index.count / 3);
    group.add(instAut);
  }

  // 5. V3 Stabilized Cinema Choreography & Closed-Loop Two-Wheel Rampart Surface-Riding Director (18.0s)
  const sampleWalkwayY = createSurfaceHeightSampler(
    gwGltf.scene,
    (nm) => nm.includes('SteppedRamparts')
  );

  const wallSpine = stageLayout.main_wall_spine_gltf;
  function evalWallSpineXZ(zQuery) {
    for (let i = 0; i < wallSpine.length - 1; i++) {
      const a = wallSpine[i];
      const b = wallSpine[i + 1];
      if ((zQuery <= a[2] && zQuery >= b[2]) || (zQuery >= a[2] && zQuery <= b[2])) {
        const u = (zQuery - a[2]) / (b[2] - a[2] || -1e-4);
        const sx = THREE.MathUtils.lerp(a[0], b[0], u);
        const syEst = THREE.MathUtils.lerp(a[1], b[1], u);
        const syHit = sampleWalkwayY(sx, zQuery, syEst + 3.5, syEst + 0.36);
        const dx = b[0] - a[0];
        const dz = b[2] - a[2];
        const hLen = Math.hypot(dx, dz) || 1.0;
        return { x: sx, y: syHit, fx: dx / hLen, fz: dz / hLen, syEst };
      }
    }
    return { x: -12.0, y: 30.0, fx: 0.0, fz: -1.0, syEst: 30.0 };
  }

  const WHEEL_R = 0.28;
  const WHEEL_HALF_BASE = 0.528;

  // Pre-bake C-infinity Smooth Step-Crest Envelope Ramp (`smoothWalkwayProfile`) so riding up the
  // stepped Great Wall stone staircase has ZERO stair-step chatter/bumping (`长城上时候不应该颠簸`)
  // while keeping both tires smoothly kissing the upper step noses!
  const WALK_Z_MAX = 4.0;
  const WALK_Z_MIN = -90.0;
  const WALK_SAMPLES = 471; // 0.20m spacing
  const walkStepZ = (WALK_Z_MAX - WALK_Z_MIN) / (WALK_SAMPLES - 1);
  const rawWalkX = new Float32Array(WALK_SAMPLES);
  const rawWalkY = new Float32Array(WALK_SAMPLES);
  for (let i = 0; i < WALK_SAMPLES; i++) {
    const zS = WALK_Z_MAX - i * walkStepZ;
    const sp = evalWallSpineXZ(zS);
    rawWalkX[i] = sp.x;
    rawWalkY[i] = sp.y;
  }
  // Soft local step-nose crest envelope (±0.8m) so tires glide across step crests without dipping into risers
  const crestWalkY = new Float32Array(WALK_SAMPLES);
  for (let i = 0; i < WALK_SAMPLES; i++) {
    let ymax = rawWalkY[i];
    for (let d = -4; d <= 4; d++) {
      const j = Math.min(WALK_SAMPLES - 1, Math.max(0, i + d));
      const cand = rawWalkY[j] - Math.abs(d) * 0.035;
      if (cand > ymax) ymax = cand;
    }
    crestWalkY[i] = ymax;
  }
  // 2-pass wide 29-tap Gaussian smoothing (±2.8m half-window -> >99.999% stair-step ripple rejection!)
  function gaussianSmooth1D(arr, halfTap = 14, sigma = 6.2) {
    const out = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      let sum = 0.0, wSum = 0.0;
      for (let d = -halfTap; d <= halfTap; d++) {
        const j = Math.min(arr.length - 1, Math.max(0, i + d));
        const w = Math.exp(-0.5 * (d * d) / (sigma * sigma));
        sum += arr[j] * w;
        wSum += w;
      }
      out[i] = sum / wSum;
    }
    return out;
  }
  const smoothWalkX = gaussianSmooth1D(gaussianSmooth1D(rawWalkX, 14, 6.0), 12, 5.0);
  const smoothWalkY = gaussianSmooth1D(gaussianSmooth1D(crestWalkY, 15, 6.8), 13, 5.6);

  function evalSmoothWalkway(zQuery) {
    const u = THREE.MathUtils.clamp((WALK_Z_MAX - zQuery) / (WALK_Z_MAX - WALK_Z_MIN), 0.0, 1.0);
    const f = u * (WALK_SAMPLES - 1);
    const i0 = Math.min(WALK_SAMPLES - 2, Math.max(0, Math.floor(f)));
    const a = f - i0;
    const x = smoothWalkX[i0] + (smoothWalkX[i0 + 1] - smoothWalkX[i0]) * a;
    const y = smoothWalkY[i0] + (smoothWalkY[i0 + 1] - smoothWalkY[i0]) * a;
    return { x, y };
  }

  function sampleTwoWheelWalkwayPose(zCenter) {
    const pC = evalSmoothWalkway(zCenter);
    const pAhead = evalSmoothWalkway(zCenter - 0.65);
    const pBehind = evalSmoothWalkway(zCenter + 0.65);
    const dx = pAhead.x - pBehind.x;
    const dz = -1.30;
    const hLen = Math.hypot(dx, dz) || 1.0;
    const fx = dx / hLen;
    const fz = dz / hLen;

    const pF = evalSmoothWalkway(zCenter + fz * WHEEL_HALF_BASE);
    const pR = evalSmoothWalkway(zCenter - fz * WHEEL_HALF_BASE);
    const yF = pF.y;
    const yR = pR.y;
    const sinAlpha = THREE.MathUtils.clamp((yF - yR) / (2.0 * WHEEL_HALF_BASE), -0.55, 0.55);
    const cosAlpha = Math.sqrt(Math.max(0.2, 1.0 - sinAlpha * sinAlpha));
    const yRoot = 0.5 * (yF + yR) + WHEEL_R * (1.0 - cosAlpha) + 0.004;
    return { x: pC.x, yRoot, yF, yR, fx, fz, sinAlpha, cosAlpha };
  }

  const heroKeyframes = [
    { t:  0.0, pos: [ 16.2, 44.2,  31.8] }, // Enters rapidly from right-rear into sunrise wide vista
    { t:  1.4, pos: [  9.6, 42.0,  22.2] }, // Hero foreground arrival overlooking Great Wall & sunrise! (QA t=1.4s)
    { t:  3.0, pos: [  4.0, 35.8,  10.8] }, // Descending gracefully toward sunlit east flank of Watchtower #1
    { t:  4.5, pos: [  1.5, 32.0,   2.2] }, // Banking cleanly past Watchtower #1's Xieshan flying eaves! (QA t=4.5s)
    { t:  5.4, pos: [ -2.2, 27.1,  -6.2] }, // Aligning smoothly over the Great Wall walkway
  ];

  const rideZStart = -12.5;
  const rideZEnd = -61.5;
  const rideSteps = 12;
  for (let k = 0; k <= rideSteps; k++) {
    const f = k / rideSteps;
    const tRide = THREE.MathUtils.lerp(6.15, 11.40, f);
    const zRide = THREE.MathUtils.lerp(rideZStart, rideZEnd, f);
    const wp = sampleTwoWheelWalkwayPose(zRide);
    heroKeyframes.push({ t: tRide, pos: [wp.x, wp.yRoot, zRide] });
  }

  heroKeyframes.push(
    { t: 12.60, pos: [-16.2, 46.2, -68.5] }, // Early liftoff ~20m BEFORE Watchtower #2, rising well above East parapet!
    { t: 13.80, pos: [-10.2, 51.8, -77.5] }, // Soaring wide East of Watchtower #2 (`x=-10.2` > 6m clear of tower & roof eaves!)
    { t: 15.00, pos: [ -8.4, 55.2, -88.5] }, // Gliding cleanly past Watchtower #2 into golden sunrise sky
    { t: 16.40, pos: [ -6.2, 58.2,-103.0] }, // Approaching towering 3D golden cumulus mist bank
    { t: 18.00, pos: [ -2.2, 61.8,-126.5] }  // Piercing deep through golden sunrise mist (`穿过迷雾`)!
  );

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.24,
    bankGain: 0.45,
    maxBankRad: 0.24,
    surfaceConstraintFn: (t, outPos) => {
      const rideWeight = quintic01(5.90, 6.40, t) * (1.0 - quintic01(11.15, 11.60, t));
      if (rideWeight > 0.001) {
        const wp = sampleTwoWheelWalkwayPose(outPos.z);
        outPos.x = THREE.MathUtils.lerp(outPos.x, wp.x, rideWeight * 0.96);
        outPos.y = THREE.MathUtils.lerp(outPos.y, wp.yRoot, rideWeight);
      }
    },
  });

  const GW_GAZE = [
    { t:  0.0, yaw:  0.18, pitch: -0.04 },
    { t:  2.4, yaw:  0.22, pitch:  0.04 },
    { t:  5.7, yaw:  0.02, pitch:  0.14 },
    { t:  8.4, yaw: -0.16, pitch: -0.06 },
    { t: 11.2, yaw:  0.04, pitch: -0.12 },
    { t: 13.5, yaw:  0.08, pitch: -0.18 },
    { t: 16.2, yaw:  0.00, pitch: -0.10 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const vExactSlopeTang = new THREE.Vector3();
  const tmpHeroSample = new THREE.Vector3();
  const tmpTangSample = new THREE.Vector3();
  const tmpHorizSample = new THREE.Vector3();
  const camWideA = new THREE.Vector3();
  const lookWideA = new THREE.Vector3();
  const camRound = new THREE.Vector3();
  const lookRound = new THREE.Vector3();
  const camRide = new THREE.Vector3();
  const lookRide = new THREE.Vector3();
  const camOutro = new THREE.Vector3();
  const lookOutro = new THREE.Vector3();
  const tmpFTire = new THREE.Vector3();
  const tmpRTire = new THREE.Vector3();
  const qGroundPitch = new THREE.Quaternion();
  const localPitchAxisX = new THREE.Vector3(1, 0, 0);

  // Stabilized C-infinity Gaussian IMAX Hero Camera Director (`FOV = 48°–52°`, `2.7m–4.4m` hero distance, `0.0°` roll!)
  // Guarantees Pelican + Rocket Bike is ALWAYS the unmistakable star protagonist (`36%–48%` of frame height)
  // while framing Watchtower #1, the stepped stone walkway, Upper Watchtower #2, 5 green mountain ridges & golden cumulus!
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpHeroSample, tmpTangSample, tmpHorizSample);

    // Beat 1 (0.0–2.2s): Brief Sunrise Opening (`cam ~ 6.2m -> 3.25m`) as Pelican flies right into hero foreground!
    const wIntro = quintic01(0.0, 1.55, tc);
    const introRight = THREE.MathUtils.lerp(-1.2, 1.62, wIntro);
    const introUp    = THREE.MathUtils.lerp( 1.85, 0.92, wIntro);
    const introBack  = THREE.MathUtils.lerp( 5.80,-2.65, wIntro);
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, introRight, introUp, introBack, camWideA);
    applyHorizontalOffset(
      tmpHeroSample,
      tmpHorizSample,
      THREE.MathUtils.lerp(-3.8, -1.25, wIntro),
      THREE.MathUtils.lerp(-1.2,  0.22, wIntro),
      THREE.MathUtils.lerp(18.0,  7.50, wIntro),
      lookWideA
    );

    // Beat 2 (2.2–6.2s): Sunlit East 3/4 Side-Profile Hero Tracking (`D ~ 3.18m`, `FOV = 51°`)
    // Looks across the large (`~43%` frame height!) Pelican at Watchtower #1's full Xieshan roof & the stepped walkway!
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, 2.45, 0.74, -2.05, camRound);
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, -2.10, 1.38, 5.50, lookRound);

    // Beat 3 (6.2–11.4s): Uphill Walkway IMAX 3/4 Hero Companion Tracking (`D ~ 3.45m`, `FOV = 52°`)
    const rideProg = quintic01(6.2, 11.3, tc);
    const rightRide = THREE.MathUtils.lerp(1.26, 1.16, rideProg);
    const upRide    = THREE.MathUtils.lerp(1.24, 1.18, rideProg);
    const backRide  = THREE.MathUtils.lerp(-3.32, -3.18, rideProg);
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, rightRide, upRide, backRide, camRide);
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, -0.68, 1.54, 9.5, lookRide);

    // Beat 4 (11.4–18.0s): Early Liftoff & Soaring Clear East of Watchtower #2 Into Golden Cumulus Mist!
    const wOut = quintic01(11.4, 17.8, tc);
    const outRight = THREE.MathUtils.lerp(1.68, 2.10, wOut);
    const outUp    = THREE.MathUtils.lerp(0.86, 1.05, wOut);
    const outBack  = THREE.MathUtils.lerp(-2.75, -3.75, wOut);
    applyHorizontalOffset(tmpHeroSample, tmpHorizSample, outRight, outUp, outBack, camOutro);
    applyHorizontalOffset(
      tmpHeroSample,
      tmpHorizSample,
      THREE.MathUtils.lerp(-1.05, -0.85, wOut),
      THREE.MathUtils.lerp( 0.62,  0.52, wOut),
      THREE.MathUtils.lerp( 7.50,  9.50, wOut),
      lookOutro
    );

    const b12 = quintic01(1.85, 3.55, tc);
    const b23 = quintic01(5.15, 6.65, tc);
    const b34 = quintic01(11.20, 12.90, tc);

    outPos.copy(camWideA).lerp(camRound, b12).lerp(camRide, b23).lerp(camOutro, b34);
    outLook.copy(lookWideA).lerp(lookRound, b12).lerp(lookRide, b23).lerp(lookOutro, b34);

    const fov12 = THREE.MathUtils.lerp(49.5, 51.0, b12);
    const fov23 = THREE.MathUtils.lerp(fov12, 52.0, b23);
    return THREE.MathUtils.lerp(fov23, 52.0, b34);
  }, DURATION, 0.28);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    cumulusSystem.update(tGlobal);

    const groundRide01 = quintic01(5.90, 6.40, tCycle) * (1.0 - quintic01(11.15, 11.60, tCycle));
    const liftoffBoost = quintic01(11.15, 12.35, tCycle);
    const preLandCruise = 1.0 - quintic01(5.45, 6.35, tCycle);

    const thrust = preLandCruise * 1.05 + groundRide01 * 0.16 + liftoffBoost * 1.88 * (1.0 - groundRide01 * 0.5);
    const windStrength = THREE.MathUtils.lerp(1.08, 1.60, liftoffBoost);
    const pedalRate = groundRide01 > 0.2 ? 7.8 : 5.5 + liftoffBoost * 2.2;
    const wheelieRad = 0.115 * Math.exp(-Math.pow((tCycle - 11.55) / 0.48, 2.0));

    const rawBank = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    if (groundRide01 > 0.01) {
      const wp = sampleTwoWheelWalkwayPose(pHero.z);
      vExactSlopeTang.set(wp.fx * wp.cosAlpha, wp.sinAlpha, wp.fz * wp.cosAlpha).normalize();
      vTang.lerp(vExactSlopeTang, groundRide01).normalize();
    }
    const bankRad = rawBank * (1.0 - groundRide01 * 0.96);

    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate,
      groundRide01,
      wheelieRad,
      nightLamp01: 0.05,
      tCycle,
      gazeSchedule: GW_GAZE,
      cycleLen: DURATION,
    });

    // Smooth C-infinity step-crest envelope lock (zero stair-step chatter!)
    if (groundRide01 > 0.001) {
      const wpNow = sampleTwoWheelWalkwayPose(pHero.z);
      pelicanRig.root.position.y = THREE.MathUtils.lerp(pelicanRig.root.position.y, wpNow.yRoot, groundRide01);
    }

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 76.0);

    if (camMode === 'arch_watchtower_macro') {
      camera.fov = 32;
      camera.position.set(7.2, 34.0, 17.5);
      camera.lookAt(-8.5, 33.4, 4.0);
      camera.updateProjectionMatrix();
      return { beatText: '建筑微距 · 明代双层歇山顶箭楼、暖光宫灯与圆润砖石拱券' };
    }
    if (camMode === 'arch_battlements_macro') {
      camera.fov = 34;
      camera.position.set(4.5, 30.8, 0.5);
      camera.lookAt(-6.2, 27.0, -22.0);
      camera.updateProjectionMatrix();
      return { beatText: '景观微距 · 条石马道阶梯、雉堞垛口与层峦叠嶂苍翠群山' };
    }

    applyStabilizedCam(tCycle, camera);

    const mistExit01 = quintic01(15.3, 17.9, tCycle);
    omniMistMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.26, 0.54, mistExit01);
    cumulusSystem.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.64, 0.86, mistExit01);

    let beatText = '第一幕 · 金色日出苍翠群山大远景 · 飞行员鹈鹕骑车轻盈飞入';
    if (tCycle >= 2.6 && tCycle < 6.1) {
      beatText = '第二幕 · 随鹈鹕平滑运镜绕过明代箭楼 · 双轮精准落定长城栈道';
    } else if (tCycle >= 6.1 && tCycle < 13.1) {
      beatText = '第三幕 · 沿条石栈道奋力向上骑行 · 星尘尾迹直抵高处烽火台前';
    } else if (tCycle >= 13.1) {
      beatText = '第四幕 · 烽火台前腾空飞起 · 拉升壮阔远景穿过金色云雾';
    }
    return { beatText, fogDensityOverride: THREE.MathUtils.lerp(0.0014, 0.0062, mistExit01) };
  }

  function measureRideDiagnostics(tQuery, pelicanRig) {
    const tC = THREE.MathUtils.clamp(tQuery, 0.0, DURATION);
    const wp = sampleTwoWheelWalkwayPose(pelicanRig.root.position.z);
    const fTire = pelicanRig.localToWorld(0, 0, WHEEL_HALF_BASE, new THREE.Vector3());
    const rTire = pelicanRig.localToWorld(0, 0, -WHEEL_HALF_BASE, new THREE.Vector3());
    const yGroundF = sampleWalkwayY(fTire.x, fTire.z, fTire.y + 3.0, wp.yF);
    const yGroundR = sampleWalkwayY(rTire.x, rTire.z, rTire.y + 3.0, wp.yR);
    return {
      t: tC,
      heroPos: pelicanRig.root.position.toArray().map((v) => +v.toFixed(4)),
      frontTireErrCm: +((fTire.y - yGroundF) * 100.0).toFixed(3),
      rearTireErrCm: +((rTire.y - yGroundR) * 100.0).toFixed(3),
      spineLateralOffsetCm: +((pelicanRig.root.position.x - wp.x) * 100.0).toFixed(2),
    };
  }

  await applyStationHdPbrUpgrade(1, group, renderer);

  return {
    id: 1,
    slug: 'great_wall',
    nameZh: '万里长城',
    titleZh: '万里长城 · 振铃破云日出',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.78,
    fogColor: new THREE.Color(0xf0dcb8),
    fogDensity: 0.0014,
    exposure: 1.02,
    transitionColor: '#f8dfa8',
    omniVideos: [omniMist.vid],
    stageTris: Math.round(stageTris),
    measureRideDiagnostics,
    update,
  };
}
