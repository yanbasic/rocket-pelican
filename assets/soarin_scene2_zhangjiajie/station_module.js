// ============================================================================
// STATION 02 (V3.2): 张家界武陵源 · 奇峰云瀑穿行落水入漓江
// (ZHANGJIAJIE WULINGYUAN STEPPED SANDSTONE PILLARS, CURTAIN WATERFALLS & PLUNGE POOL)
// Standardized Soarin' Over China 3D Station Module
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  quintic01,
  createHeroTrajectory,
  applyHorizontalOffset,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

function createCurvedWaterfallCurtainGeo(width, height, lipCurveDepth = 1.65, segX = 24, segY = 28) {
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i); // 0..1 across width
    const v = uv.getY(i); // 0 at bottom -> 1 at top lip
    let x = pos.getX(i);
    let y = pos.getY(i);
    // Curve backward (-Z in local plane space) at the top lip so water rolls naturally over the stepped rock crest!
    const topLip = Math.pow(Math.max(0.0, (v - 0.78) / 0.22), 1.8);
    // Multi-stream 3D corrugated water-curtain relief + gentle outward splash flare near bottom
    const corrugation = Math.sin(u * Math.PI * 7.0) * 0.42 + Math.cos(u * Math.PI * 13.0) * 0.18;
    const botFlare = Math.pow(Math.max(0.0, (0.32 - v) / 0.32), 1.5) * 1.15;
    const z = -topLip * lipCurveDepth + corrugation * (1.0 - topLip * 0.6) + botFlare;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station02_Zhangjiajie_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 16.0;

  // Radiant golden-apricot morning sun on the ahead-left sky (matches `s2_zhangjiajie_ref_board.jpg`
  // AND directly bathes the Right Grand Stepped Sandstone Cliff Wall & Wide Curtain Waterfall in warm sunlight!)
  const SUN_POS = new THREE.Vector3(-88.0, 70.0, -220.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  // 1. Seamless 360° V3 Golden-Mist Wulingyuan Panorama Sky Dome + Sun Corona + PMREM EnvMap
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene2_zhangjiajie/zjj_sky_v3_panorama.jpg', resolve, undefined, reject);
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
        vec3 rawTex = texture2D(uSkyMap, vUv).rgb;

        float h = clamp(d.y, -0.25, 1.0);
        float mu = max(0.0, dot(d, normalize(uSunDir)));

        vec3 warmCerulean = vec3(0.48, 0.70, 0.91);
        vec3 creamMistLow = vec3(0.96, 0.89, 0.75);
        vec3 sunGold      = vec3(1.00, 0.90, 0.68);
        vec3 horizonCol   = mix(creamMistLow, sunGold, pow(mu, 1.5) * 0.86);
        vec3 cleanGrad    = mix(horizonCol, warmCerulean, smoothstep(0.05, 0.58, h));

        // Preserve NB 2.1 distant misty Wulingyuan spire silhouettes & golden cloud sea in panorama!
        vec3 col = mix(rawTex, cleanGrad, 0.28);

        float sunDisc   = smoothstep(0.9980, 0.9995, mu);
        float innerGlow = pow(mu, 32.0) * 0.68;
        float wideHalo  = pow(mu, 4.8) * 0.34;
        float horizonWarm = exp(-pow(abs(d.y - 0.08) * 4.8, 2.0)) * pow(mu, 1.8) * 0.26;

        col += vec3(1.00, 0.86, 0.60) * (wideHalo + horizonWarm);
        col += vec3(1.00, 0.95, 0.82) * innerGlow;
        col += vec3(1.00, 0.99, 0.94) * sunDisc * 1.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(540, 56, 36), skyDomeMat);
  skyDome.rotation.y = -Math.atan2(SUN_DIR.z, SUN_DIR.x) - Math.PI * 0.5;
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
    addCard([-18, 14, -22], [20, 14], 0xffe2ad);
    addCard([+18, 14, +12], [18, 12], 0xaed0f8);
    addCard([0, -14, 0],    [36, 36], 0xe8d5b8);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
  }

  // 2. Pixar Feature-Film Multi-Light Atmospheric Rig
  const hemiLight = new THREE.HemisphereLight(0xc4ddff, 0xe4c292, 0.72);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffe2ab, 3.10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -44;
  sunLight.shadow.camera.right = 44;
  sunLight.shadow.camera.top = 44;
  sunLight.shadow.camera.bottom = -44;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 210.0;
  sunLight.shadow.bias = -0.00035;
  group.add(sunLight);
  group.add(sunLight.target);

  const canyonFillLight = new THREE.DirectionalLight(0xcce0ff, 0.90);
  canyonFillLight.position.set(62, 56, 88);
  group.add(canyonFillLight);

  const valleyBounceLight = new THREE.DirectionalLight(0xffdfad, 0.58);
  valleyBounceLight.position.set(-10, -42, -26);
  group.add(valleyBounceLight);

  // 3. Sunlit Golden Valley Sea of Clouds + 3D Volumetric Cumulus Cloud Banks (`volumetric_clouds.js`)
  const atmoUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: SUN_DIR },
  };

  const cloudCarpetGeo = new THREE.PlaneGeometry(660, 660, 220, 220);
  cloudCarpetGeo.rotateX(-Math.PI * 0.5);

  function addCloudLayer(yHeight, densityScale, speedScale, opacityBase) {
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
          vec2 drift = vec2(uTime * 1.05 * uSpeed, -uTime * 0.58 * uSpeed);
          float n = fbm(pos.xz * uScale + drift);
          float billow = pow(smoothstep(0.16, 0.86, n), 1.25);
          pos.y += billow * 6.8;
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
          // Part cleanly around the Emerald Canyon Plunge River Pool (X ~ 1.0, Z ~ -67)
          vec2 poolDelta = (vWPos.xz - vec2(1.0, -67.0)) * vec2(1.10, 0.65);
          float poolPart = smoothstep(14.5, 31.0, length(poolDelta));

          vec2 drift = vec2(uTime * 1.05 * uSpeed, -uTime * 0.58 * uSpeed);
          float detail = fbm(vWPos.xz * (uScale * 2.7) + drift * 1.3);
          float density = clamp(vPuff * 0.80 + detail * 0.38 - 0.12, 0.0, 1.0);
          vec2 toSunXZ = normalize(uSunDir.xz);
          float sunGrad = fbm((vWPos.xz + toSunXZ * 7.5) * uScale + drift);
          float rimLit = clamp((vPuff - sunGrad) * 2.85 + 0.48, 0.0, 1.0);

          vec3 warmSlateShadow = vec3(0.74, 0.76, 0.82);
          vec3 creamGoldBody   = vec3(0.96, 0.90, 0.78);
          vec3 sunlitIvoryCrest= vec3(1.00, 0.97, 0.88);
          vec3 col = mix(warmSlateShadow, creamGoldBody, smoothstep(0.16, 0.58, density));
          col = mix(col, sunlitIvoryCrest, smoothstep(0.34, 0.84, rimLit * density + 0.16));

          float sunAzimuth = max(0.0, dot(normalize(vWPos - vec3(0.0, 22.0, 10.0)), normalize(uSunDir)));
          col += vec3(0.16, 0.10, 0.03) * pow(sunAzimuth, 2.6) * smoothstep(0.32, 0.85, density);

          float distFade = smoothstep(325.0, 150.0, length(vWPos.xz - vec2(0.0, -56.0)));
          float alpha = smoothstep(0.08, 0.58, density) * uOpacity * distFade * poolPart;
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }
      `,
    });
    const m = new THREE.Mesh(cloudCarpetGeo, mat);
    m.position.set(0.0, yHeight, -56.0);
    m.renderOrder = 2;
    group.add(m);
  }
  addCloudLayer(19.6, 0.018, 0.65, 0.92);
  addCloudLayer(22.0, 0.025, 0.88, 0.52);

  // Fluffy Sunlit Cream-Gold 3D Volumetric Cumulus Cloud Sea (`y ~ 22..31m` — strictly below flight camera
  // so foreground cliff pines & roaring waterfalls are 100% crisp, parting around the Emerald Plunge Pool!)
  const cloudClusters = [
    { center: [ -4.0, 25.5, +18.0], radius: [18, 4.8, 12], puffs: 24, scale: [12, 22] },
    { center: [ +2.5, 25.0,  +6.0], radius: [18, 4.8, 12], puffs: 26, scale: [12, 22] },
    { center: [ -6.5, 25.2,  -6.5], radius: [18, 5.0, 13], puffs: 26, scale: [12, 22] },
    { center: [ +6.5, 24.8,  -8.0], radius: [16, 4.8, 12], puffs: 26, scale: [11, 21] },
    { center: [ +1.5, 25.5, -19.0], radius: [20, 5.2, 13], puffs: 26, scale: [12, 22] },
    { center: [ -7.0, 26.0, -34.0], radius: [18, 5.2, 12], puffs: 22, scale: [11, 21] },
    { center: [ +8.0, 25.8, -36.0], radius: [18, 5.2, 12], puffs: 20, scale: [11, 21] },
    // Flanking cloud banks around (NOT inside!) the Emerald Canyon Plunge Pool (`Z = -52..-86, |X| > 25m`)
    { center: [-31.0, 25.5, -52.0], radius: [18, 5.8, 15], puffs: 22, scale: [12, 23] },
    { center: [+31.0, 25.5, -54.0], radius: [18, 5.8, 15], puffs: 22, scale: [12, 23] },
    { center: [-32.0, 24.8, -74.0], radius: [20, 5.8, 16], puffs: 22, scale: [12, 23] },
    { center: [+32.0, 24.8, -76.0], radius: [20, 5.8, 16], puffs: 22, scale: [12, 23] },
    // Shimmering river-mist bank beyond the plunge pool (`转镜头，到漓江`)
    { center: [-10.0, 24.5,-104.0], radius: [24, 6.2, 16], puffs: 24, scale: [13, 25] },
    { center: [+12.0, 24.8,-108.0], radius: [24, 6.2, 16], puffs: 24, scale: [13, 25] },
    // Vast Sunlit West/Left & East Spire Sea-of-Clouds (matches `s2_zhangjiajie_ref_board.jpg`!)
    { center: [-52.0, 27.5,  -4.0], radius: [28, 6.5, 24], puffs: 28, scale: [15, 28] },
    { center: [-64.0, 28.5, -38.0], radius: [30, 6.8, 26], puffs: 28, scale: [16, 30] },
    { center: [-60.0, 29.0, -82.0], radius: [32, 7.0, 26], puffs: 28, scale: [16, 31] },
    { center: [-48.0, 30.0,-134.0], radius: [34, 7.2, 26], puffs: 28, scale: [17, 33] },
    { center: [+62.0, 27.5, -14.0], radius: [28, 6.5, 24], puffs: 24, scale: [15, 28] },
    { center: [+68.0, 28.5, -56.0], radius: [30, 6.8, 26], puffs: 24, scale: [16, 30] },
    { center: [  0.0, 30.0,-148.0], radius: [38, 7.5, 24], puffs: 28, scale: [18, 33] },
  ];
  const volClouds = createVolumetricCloudSystem({
    clusters: cloudClusters,
    sunDir: SUN_DIR,
    litColor: 0xfff1cf,
    shadowColor: 0x8f9aae,
    rimColor: 0xffd382,
    opacity: 0.62,
    seed: 202606,
  });
  group.add(volClouds.mesh);

  // Dedicated Billowing White Waterfall Plunge-Spray Volumetric Mist Clusters (`#ffffff` foam mist at waterfall bases!)
  const waterfallMistClouds = createVolumetricCloudSystem({
    clusters: [
      { center: [+14.2, 23.8,  -7.2], radius: [ 7.5, 4.2,  8.5], puffs: 24, scale: [ 7.5, 14.0] }, // Right Curtain Waterfall base boil!
      { center: [+15.5, 34.5,  -7.2], radius: [ 4.5, 3.2,  6.8], puffs: 14, scale: [ 5.5, 10.5] }, // Right Curtain mid-stepped splash mist!
      { center: [ -5.4, 23.5, -49.5], radius: [ 7.0, 4.2,  6.5], puffs: 20, scale: [ 7.5, 13.5] }, // Twin-Stream Waterfall Pillar base mist!
      { center: [+14.2, 22.8, -63.0], radius: [ 5.5, 3.0,  5.5], puffs: 14, scale: [ 6.0, 11.0] }, // East Plunge-Pool Waterfall base mist!
    ],
    sunDir: SUN_DIR,
    litColor: 0xffffff,
    shadowColor: 0xc2d8ea,
    rimColor: 0xfff8e6,
    opacity: 0.68,
    seed: 8802,
  });
  group.add(waterfallMistClouds.mesh);

  // Volumetric Golden Morning God-Rays Streaming Across the Canyon & Underneath the 26m Sky-Arch!
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
          float beam = pow(max(0.0, across), 2.3);
          float along = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.16, vUv.y);
          float shimmer = 0.86 + 0.14 * sin(uTime * 1.5 + vUv.x * 8.5);
          float a = beam * along * shimmer * 0.090;
          gl_FragColor = vec4(vec3(1.00, 0.90, 0.62) * a, a);
        }
      `,
    });
    for (const [tx, ty, tz, w, len] of [
      [ +9.5, 39.0,  -7.0, 22, 195],
      [  0.0, 43.0, -28.0, 26, 200],
      [ -9.5, 46.0, -47.0, 24, 210],
      [ +2.5, 28.0, -66.0, 26, 205],
    ]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
      const targetV = new THREE.Vector3(tx, ty, tz);
      m.position.copy(targetV.clone().lerp(SUN_POS, 0.42));
      m.lookAt(SUN_POS);
      m.rotateX(Math.PI * 0.5);
      group.add(m);
    }
  }

  // 4. Multi-Layered Omni 1.1 Wide Roaring Curtain Waterfall (`zjj_omni_curtain_waterfall.mp4`)
  //    + Twin-Stream Pillar Waterfall (`zjj_omni_waterfall_mist.mp4`)!
  const omniCurtain = createLoopingVideoTexture('./assets/soarin_scene2_zhangjiajie/zjj_omni_curtain_waterfall.mp4');
  const omniWaterfall = createLoopingVideoTexture('./assets/soarin_scene2_zhangjiajie/zjj_omni_waterfall_mist.mp4');
  const omniCloud = createLoopingVideoTexture('./assets/soarin_scene2_zhangjiajie/zjj_omni_cloud_stream.mp4');

  const curtainWaterfallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniCurtain.vTex },
      uTime: atmoUniforms.uTime,
      uOpacity: { value: 0.95 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec3 vc = texture2D(uVid, vUv).rgb;
        float luma = dot(vc, vec3(0.299, 0.587, 0.114));

        // Rich frothy white multi-stream cascades plunging vertically (vUv.y + uTime)!
        float n1 = vnoise(vec2(vUv.x * 34.0, vUv.y * 9.5 + uTime * 5.8));
        float n2 = vnoise(vec2(vUv.x * 72.0 + 3.7, vUv.y * 21.0 + uTime * 9.5));
        float multiStream = 0.48 + 0.52 * sin(vUv.x * 28.0 + n1 * 2.0);
        float procFoam = (0.36 + 0.64 * (n1 * 0.58 + n2 * 0.42)) * (0.58 + 0.42 * multiStream);
        float baseMist = exp(-pow((vUv.y - 0.18) * 3.6, 2.0)) * (0.55 + 0.35 * n1);

        // Smooth 4-edge feathering with wide bottom mist fade so ZERO straight bottom edge ever shows!
        float fx = smoothstep(0.03, 0.18, vUv.x) * smoothstep(0.97, 0.82, vUv.x);
        float fy = smoothstep(0.02, 0.26, vUv.y) * smoothstep(0.995, 0.91, vUv.y);
        float edgeMask = fx * fy;

        float omniStrength = smoothstep(0.04, 0.52, luma);
        float alpha = clamp((omniStrength * 0.72 + procFoam * 0.68 + baseMist * 0.55) * edgeMask * uOpacity, 0.0, 0.96);
        vec3 warmMistShadow = vec3(0.80, 0.86, 0.90);
        vec3 roaringWhite   = vec3(1.00, 0.99, 0.96);
        vec3 col = mix(warmMistShadow, roaringWhite, clamp(procFoam * 0.75 + omniStrength * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  // 3D Curved Over-the-Lip Wide Curtain Waterfall anchored on the skewed Right Grand Stepped Cliff (`X=+15.4, Z=-7.5, Y=33.5`)!
  {
    const mainCurtainGeo = createCurvedWaterfallCurtainGeo(16.2, 30.5, 1.85, 26, 28);
    const mainCurtain = new THREE.Mesh(mainCurtainGeo, curtainWaterfallMat);
    mainCurtain.position.set(15.2, 33.4, -7.4);
    // Oriented perpendicular to the skewed cliff face (`-Math.PI * 0.38`) so Beat 1 & Beat 2 cameras see full roaring width!
    mainCurtain.rotation.y = -Math.PI * 0.38;
    mainCurtain.renderOrder = 5;
    group.add(mainCurtain);

    const subCurtainGeo = createCurvedWaterfallCurtainGeo(13.5, 30.0, 1.45, 20, 24);
    const subCurtain = new THREE.Mesh(subCurtainGeo, curtainWaterfallMat);
    subCurtain.position.set(15.8, 33.2, -8.2);
    subCurtain.rotation.y = -Math.PI * 0.52;
    subCurtain.renderOrder = 5;
    group.add(subCurtain);
  }

  // Luminous Turquoise-White Ribbon Waterfall for Tall Twin-Stream Pillar #10 & East Plunge-Pool Cliff #12
  const ribbonWaterfallMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniWaterfall.vTex },
      uTime: atmoUniforms.uTime,
      uOpacity: { value: 0.92 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        vec3 vc = texture2D(uVid, vUv).rgb;
        float luma = dot(vc, vec3(0.299, 0.587, 0.114));
        float centerAxis = abs(vUv.x - 0.5);
        float streamWidth = mix(0.38, 0.18, smoothstep(0.10, 0.90, vUv.y));
        float coreMask = smoothstep(streamWidth, streamWidth * 0.16, centerAxis);
        float n1 = vnoise(vec2(vUv.x * 32.0, vUv.y * 13.0 + uTime * 6.0));
        float n2 = vnoise(vec2(vUv.x * 66.0 + 3.1, vUv.y * 28.0 + uTime * 9.6));
        float streak = n1 * 0.58 + n2 * 0.42;
        float procRibbon = coreMask * (0.36 + 0.64 * pow(streak, 1.25));
        float plungeMist = exp(-pow(length((vUv - vec2(0.5, 0.18)) * vec2(1.8, 3.0)), 2.0)) * (0.50 + 0.35 * n1);

        float fx = smoothstep(0.04, 0.26, vUv.x) * smoothstep(0.96, 0.74, vUv.x);
        float fy = smoothstep(0.03, 0.26, vUv.y) * smoothstep(0.99, 0.89, vUv.y);
        float omniStrength = smoothstep(0.06, 0.58, luma);
        float alpha = clamp((omniStrength * 0.68 + procRibbon * 0.68 + plungeMist * 0.56) * fx * fy * uOpacity, 0.0, 0.95);
        vec3 icyTurquoise = vec3(0.58, 0.84, 0.96);
        vec3 foamWhite    = vec3(0.99, 1.00, 1.00);
        vec3 col = mix(icyTurquoise, foamWhite, clamp(streak * 0.76 + omniStrength * 0.45, 0.0, 1.0));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const twinRibbonGeo = createCurvedWaterfallCurtainGeo(8.2, 39.5, 1.20, 16, 22);
  for (const [pos, rotY] of [
    // Tall Twin-Stream Waterfall Pillar #10 (`[-9.8, *, -53.5]`, summit=61.5m -> twin streams facing southeast toward Sky-Arch!)
    [[ -3.2, 38.2, -50.0],  Math.PI * 0.22], // Twin Stream A facing Sky-Arch camera!
    [[ -3.4, 38.2, -50.0],  Math.PI * 0.40],
    [[ -6.0, 38.2, -47.3],  Math.PI * 0.14], // Twin Stream B facing Sky-Arch camera!
    [[ -6.2, 38.2, -47.3],  Math.PI * 0.32],
    // East Plunge-Pool Waterfall (`Pillar_12` at [+21.2, *, -63.0], plunging straight into the Emerald River Pool!)
    [[+14.4, 36.8, -63.0], -Math.PI * 0.36],
    [[+14.2, 36.8, -63.0], -Math.PI * 0.18],
  ]) {
    const m = new THREE.Mesh(twinRibbonGeo, ribbonWaterfallMat);
    m.position.set(...pos);
    m.rotation.y = rotY;
    m.renderOrder = 5;
    group.add(m);
  }

  // Radially Feathered Omni Valley Mist Ribbons (`ZERO` rectangular horizontal/vertical card lines!)
  const omniCloudMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniCloud.vTex },
      uTint: { value: new THREE.Color(0xfff1d6) },
      uOpacity: { value: 0.26 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r2 = dot(p, p);
        if (r2 >= 1.0) discard;
        float radialMask = pow(1.0 - r2, 2.2);
        vec3 c = texture2D(uVid, vUv).rgb;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        float w = smoothstep(0.05, 0.52, luma) * radialMask * uOpacity;
        gl_FragColor = vec4(c * uTint * w, w);
      }
    `,
  });
  for (const cfg of [
    { pos: [ +9.0, 27.0,  -7.0], scale: [34, 16], rotY: -0.35 },
    { pos: [ -2.5, 29.0, -24.0], scale: [36, 16], rotY:  0.10 },
    { pos: [ -9.0, 27.0, -45.0], scale: [34, 16], rotY:  0.22 },
    { pos: [ -5.0, 24.5, -94.0], scale: [46, 20], rotY:  0.35 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniCloudMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rotY;
    m.renderOrder = 4;
    group.add(m);
  }

  // 5. Load V3.2 Sculptural Zhangjiajie Stage GLB + 172 Background Spires & 650 Dark-Emerald Cliff Pines
  const layoutRes = await fetch('./assets/soarin_scene2_zhangjiajie/zhangjiajie_stage_layout.json');
  const stageLayout = await layoutRes.json();

  const zjjGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene2_zhangjiajie/zhangjiajie_hero_stage.glb', resolve, undefined, reject);
  });

  const zjjMatsConfigured = new Set();
  let protoSpireRockGeo = null, protoSpireRockMat = null;
  let protoSpireCapGeo = null, protoSpireCapMat = null;
  let protoPineBarkGeo = null, protoPineBarkMat = null;
  let protoPineNeedlesGeo = null, protoPineNeedlesMat = null;
  let protoShrubGeo = null, protoShrubMat = null;
  let stageTris = 0;

  zjjGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name === 'Proto_Karst_Spire_Rock') { protoSpireRockGeo = obj.geometry; protoSpireRockMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Karst_Spire_Cap')  { protoSpireCapGeo = obj.geometry;  protoSpireCapMat = obj.material;  obj.visible = false; return; }
    if (obj.name === 'Proto_Pine_Bark')        { protoPineBarkGeo = obj.geometry;  protoPineBarkMat = obj.material;  obj.visible = false; return; }
    if (obj.name === 'Proto_Pine_Needles')     { protoPineNeedlesGeo = obj.geometry; protoPineNeedlesMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Summit_Shrub')     { protoShrubGeo = obj.geometry;     protoShrubMat = obj.material;     obj.visible = false; return; }

    obj.castShadow = true;
    obj.receiveShadow = true;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    const m = obj.material;
    if (m && !zjjMatsConfigured.has(m.uuid)) {
      zjjMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      if (m.name && (m.name.includes('PineNeedles') || m.name.includes('MossyCaprock'))) {
        const isPine = m.name.includes('PineNeedles');
        if (isPine) {
          // Deep rich forest dark-emerald matching `s2_zhangjiajie_ref_board.jpg`!
          m.color.setRGB(0.28, 0.50, 0.24);
          m.roughness = 0.80;
        } else {
          m.color.setRGB(0.32, 0.54, 0.26);
        }
        m.customProgramCacheKey = () => 'zjj_v32_dark_emerald_' + m.name;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.uniforms.uSunDir = atmoUniforms.uSunDir;
          if (isPine) {
            shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               vec3 fwPos = (modelMatrix * vec4(position, 1.0)).xyz;
               float sway = sin(uTime * 2.3 + fwPos.x * 0.42 + fwPos.z * 0.36) * 0.055;
               transformed.x += sway;
               transformed.z += cos(uTime * 1.85 + fwPos.y * 0.48) * 0.040;`
            );
          }
          const rimGain = isPine ? '0.52' : '0.32';
          shader.fragmentShader = 'uniform vec3 uSunDir;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
             vec3 sunV = normalize((viewMatrix * vec4(normalize(uSunDir), 0.0)).xyz);
             vec3 upV  = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
             vec3 viewD = normalize(vViewPosition);
             float nDotS = max(0.0, dot(normal, sunV));
             float nDotU = clamp(dot(normal, upV) * 0.5 + 0.5, 0.0, 1.0);
             float backLit = pow(max(0.0, dot(-viewD, sunV)), 2.4);
             float edgeRim = pow(1.0 - abs(dot(normal, viewD)), 2.2);
             // Crisp layered dark-emerald pine bough shadows + subtle sunlit olive-gold top rim!
             reflectedLight.indirectDiffuse *= mix(0.36, 0.96, nDotU);
             vec3 warmPineRim = vec3(0.26, 0.24, 0.05);
             float sunGlow = (pow(nDotS, 1.4) * 0.45 + edgeRim * (0.20 + 0.50 * backLit)) * ${rimGain};
             reflectedLight.directDiffuse += warmPineRim * sunGlow;`
          );
        };
        m.needsUpdate = true;
      }
    }
  });
  group.add(zjjGltf.scene);

  const dummy = new THREE.Object3D();
  if (protoSpireRockGeo && protoSpireCapGeo && stageLayout.scatter_spires?.length) {
    const nS = stageLayout.scatter_spires.length;
    const instRock = new THREE.InstancedMesh(protoSpireRockGeo, protoSpireRockMat, nS);
    const instCap  = new THREE.InstancedMesh(protoSpireCapGeo,  protoSpireCapMat,  nS);
    instRock.receiveShadow = true;
    instCap.receiveShadow = true;
    const spireRockTris = protoSpireRockGeo.index ? protoSpireRockGeo.index.count / 3 : protoSpireRockGeo.attributes.position.count / 3;
    const spireCapTris  = protoSpireCapGeo.index  ? protoSpireCapGeo.index.count / 3  : protoSpireCapGeo.attributes.position.count / 3;
    stageTris += nS * (spireRockTris + spireCapTris);

    stageLayout.scatter_spires.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.set(it.scaleXZ, it.scaleY, it.scaleXZ);
      dummy.updateMatrix();
      instRock.setMatrixAt(i, dummy.matrix);
      instCap.setMatrixAt(i, dummy.matrix);
    });
    instRock.instanceMatrix.needsUpdate = true;
    instCap.instanceMatrix.needsUpdate = true;
    group.add(instRock, instCap);
  }

  if (protoPineBarkGeo && protoPineNeedlesGeo && stageLayout.scatter_pines?.length) {
    const nP = stageLayout.scatter_pines.length;
    const instBark    = new THREE.InstancedMesh(protoPineBarkGeo, protoPineBarkMat, nP);
    const instNeedles = new THREE.InstancedMesh(protoPineNeedlesGeo, protoPineNeedlesMat, nP);
    instBark.castShadow = false; instBark.receiveShadow = false;
    instNeedles.castShadow = false; instNeedles.receiveShadow = false;
    stageLayout.scatter_pines.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      instBark.setMatrixAt(i, dummy.matrix);
      instNeedles.setMatrixAt(i, dummy.matrix);
    });
    instBark.instanceMatrix.needsUpdate = true;
    instNeedles.instanceMatrix.needsUpdate = true;
    group.add(instBark, instNeedles);
  }

  if (protoShrubGeo && stageLayout.scatter_shrubs?.length) {
    const nSh = stageLayout.scatter_shrubs.length;
    const instSh = new THREE.InstancedMesh(protoShrubGeo, protoShrubMat, nSh);
    instSh.castShadow = false; instSh.receiveShadow = false;
    stageLayout.scatter_shrubs.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      instSh.setMatrixAt(i, dummy.matrix);
    });
    instSh.instanceMatrix.needsUpdate = true;
    group.add(instSh);
  }

  // 6. Physically Realistic Emerald Canyon Plunge Pool (`Y = 20.8m`):
  //    Glossy Dual-Tire Capillary & Gravity Normal Waves + Expanding Touchdown Wave Packet +
  //    Curved 20-Segment Kelvin V-Wake + Upside-Down Wheel Reflections + Parabolic Micro-Droplets!
  const CANYON_WATER_Y = 20.8;
  const ZJJ_TRAIL_LEN = 20;
  const zjjWakeTrailArr = Array.from(
    { length: ZJJ_TRAIL_LEN },
    () => new THREE.Vector4(1.0, CANYON_WATER_Y, -61.5, 0.0)
  );
  const canyonWaterUniforms = {
    uTime: atmoUniforms.uTime,
    uSunDir: atmoUniforms.uSunDir,
    uSkyMap: { value: skyTex },
    uSplashPos: { value: new THREE.Vector3(1.0, CANYON_WATER_Y, -66.0) },
    uHeroFwd: { value: new THREE.Vector2(0.0, -1.0) },
    uHeroAboveWater: { value: 30.0 },
    uSplash01: { value: 0.0 },
    uTouchRipplePos: { value: new THREE.Vector2(1.30, -61.2) },
    uTouchRippleAge: { value: -1.0 },
    uWakeTrail: { value: zjjWakeTrailArr },
  };
  {
    const cwGeo = new THREE.PlaneGeometry(250, 230, 144, 144);
    cwGeo.rotateX(-Math.PI * 0.5);
    const cwMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: canyonWaterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += sin(wp.x * 0.18 + uTime * 0.9) * cos(wp.z * 0.16 - uTime * 0.7) * 0.012;
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform sampler2D uSkyMap;
        uniform vec3 uSplashPos;
        uniform vec2 uHeroFwd;
        uniform float uHeroAboveWater;
        uniform float uSplash01;
        uniform vec2 uTouchRipplePos;
        uniform float uTouchRippleAge;
        uniform vec4 uWakeTrail[${ZJJ_TRAIL_LEN}];
        varying vec3 vWPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float waveHeight(vec2 xz) {
          float t = uTime;
          float h = 0.0;
          // 4 cross-angled organic mountain-stream wave octaves (breaks up any CG flatness!)
          vec2 q1 = vec2(xz.x * 0.86 - xz.y * 0.50, xz.x * 0.50 + xz.y * 0.86);
          vec2 q2 = vec2(xz.x * 0.64 + xz.y * 0.77, -xz.x * 0.77 + xz.y * 0.64);
          h += (vnoise(q1 * 0.62 + vec2(t * 0.38, -t * 0.31)) - 0.5) * 0.072;
          h += (vnoise(q2 * 1.55 - vec2(t * 0.68, t * 0.52)) - 0.5) * 0.036;
          h += (vnoise(xz * 3.40 + vec2(t * 1.05, -t * 0.84)) - 0.5) * 0.018;
          h += (vnoise(q1 * 6.80 - vec2(t * 1.55, t * 1.25)) - 0.5) * 0.008;
          return h;
        }
        vec2 dirToEquirectUV(vec3 d) {
          float u = atan(d.z, d.x) / (2.0 * 3.14159265) + 0.5;
          float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5;
          return vec2(u, v);
        }

        void main() {
          vec2 xz = vWPos.xz;
          float eps = 0.075;
          float h0 = waveHeight(xz);
          float hx = waveHeight(xz + vec2(eps, 0.0));
          float hz = waveHeight(xz + vec2(0.0, eps));
          vec3 nrm = normalize(vec3(h0 - hx, eps * 2.05, h0 - hz));

          vec2 wakeGrad = vec2(0.0);
          float wakeFoam = 0.0;

          // Organic FBM domain warp so ZERO waves ever look like mechanical compass circles!
          float warpA = vnoise(xz * 1.15 + vec2(uTime * 0.45, -uTime * 0.35)) - 0.5;
          float warpB = vnoise(xz * 2.45 - vec2(uTime * 0.65, uTime * 0.55)) - 0.5;
          float organicWarp = warpA * 0.62 + warpB * 0.28;

          // Natural plunge-pool waterfall surface waves around Twin-Stream Waterfall base (14.2, -63.0)
          vec2 dWfVec = xz - vec2(14.2, -63.0);
          float dWf = length(dWfVec) + 1e-4;
          if (dWf < 30.0) {
            float rWf = dWf + organicWarp * 0.95;
            float wfOsc = sin(rWf * 4.2 - uTime * 8.2) * 0.6 + sin(rWf * 8.5 - uTime * 12.5) * 0.4;
            float wfEnv = exp(-dWf * 0.16) * smoothstep(30.0, 2.0, dWf);
            wakeGrad += (dWfVec / dWf) * (wfOsc * 0.18 * wfEnv);
            float wfLace = vnoise(xz * 5.2 - vec2(0.0, uTime * 4.2));
            wakeFoam += exp(-dWf * dWf * 0.055) * (0.45 + 0.55 * wfLace) * 0.55;
          }

          // Subtle Organic Touchdown Wave Packet right at initial water entry (decays smoothly in ~2.0s)
          if (uTouchRippleAge > 0.0 && uTouchRippleAge < 2.6) {
            vec2 dTouchVec = xz - uTouchRipplePos;
            float rTouch = length(dTouchVec) + 1e-4;
            if (rTouch < 14.0) {
              float rWarped = rTouch + organicWarp * 0.72;
              float rFront = 0.35 + uTouchRippleAge * 3.6;
              float pktEnv = exp(-pow((rWarped - rFront) * 0.95, 2.0))
                           * exp(-uTouchRippleAge * 1.05)
                           * smoothstep(13.0, 0.2, rTouch);
              float dispOsc = sin((rWarped - rFront) * 8.5 - uTouchRippleAge * 6.0);
              wakeGrad += (dTouchVec / rTouch) * (dispOsc * 0.22 * pktEnv);
            }
          }

          // Hydrodynamic Forward-Skim Bow Wave + Curved 20-Segment Kelvin V-Wake (NO vinyl circles ahead of bike!)
          if (uSplash01 > 0.005 && abs(xz.x - uSplashPos.x) < 26.0 && abs(xz.y - uSplashPos.z) < 40.0) {
            vec2 fwd = normalize(uHeroFwd + vec2(1e-5));
            vec2 rgt = vec2(-fwd.y, fwd.x);
            float lat = dot(xz - uSplashPos.xz, rgt);
            float lace1 = vnoise(xz * 7.5 + vec2(0.0, uTime * 3.6));
            float lace2 = vnoise(xz * 16.5 - vec2(uTime * 2.2, -uTime * 3.0));
            float lace = lace1 * 0.58 + lace2 * 0.42;

            // 1. Tight local bow-wave & rear-rooster disturbance strictly near & behind Front (+0.50m) / Rear (-0.52m) tires
            for (int wi = 0; wi < 2; wi++) {
              float wOff = (wi == 0) ? 0.50 : -0.52;
              vec2 tireXZ = uSplashPos.xz + fwd * wOff;
              vec2 dT = xz - tireXZ;
              float rT = length(dT) + 1e-4;
              float tireAlong = dot(dT, fwd);
              float tireLat = abs(dot(dT, rgt));

              // Doppler / Mach bow cutoff: moving tire cannot send rings far ahead (+fwd); energy trails aft!
              float machEnvelope = smoothstep(0.55, -0.35, tireAlong) * exp(-rT * 0.95) * smoothstep(3.8, 0.0, rT);
              float rTWarp = rT + organicWarp * 0.38;
              float oscBow = sin(rTWarp * 14.0 - uTime * 20.0) * 0.6 + sin(rTWarp * 7.5 - uTime * 12.0) * 0.4;
              wakeGrad += (dT / rT) * (oscBow * 0.28 * machEnvelope * uSplash01);

              // Narrow lacy white-jade foam strictly along the thin rubber tire contact slice (< 14cm)!
              float contactLine = exp(-tireLat * tireLat * 54.0)
                                * smoothstep(0.28, -0.06, tireAlong)
                                * smoothstep(-1.35, -0.15, tireAlong);
              wakeFoam += contactLine * smoothstep(0.22, 0.76, lace + 0.28) * 0.76 * uSplash01;
            }

            // 2. Curved 20-Segment Spline Kelvin V-Wake Arms + Broken Feathered Wavelets Trailing Aft!
            float minTrailD = 999.0;
            float trailAge = 1.0;
            float signedSide = sign(lat + 1e-4);
            vec2 bestSegPerp = rgt;
            for (int i = 0; i < ${ZJJ_TRAIL_LEN} - 1; i++) {
              vec4 a = uWakeTrail[i];
              vec4 b = uWakeTrail[i + 1];
              if (a.w < 0.02 && b.w < 0.02) continue;
              vec2 ab = b.xz - a.xz;
              float ab2 = max(1e-4, dot(ab, ab));
              float tSeg = clamp(dot(xz - a.xz, ab) / ab2, 0.0, 1.0);
              vec2 proj = a.xz + ab * tSeg;
              vec2 diff = xz - proj;
              float dSeg = length(diff);
              if (dSeg < minTrailD) {
                minTrailD = dSeg;
                trailAge = (float(i) + tSeg) / float(${ZJJ_TRAIL_LEN} - 1);
                bestSegPerp = dSeg > 1e-3 ? (diff / dSeg) : (rgt * signedSide);
              }
            }

            if (minTrailD < 12.0) {
              float aftFade = smoothstep(0.01, 0.08, trailAge);
              float warpedD = minTrailD + organicWarp * (0.22 + trailAge * 0.45);
              // Physical 19.5° Kelvin wake half-angle spreading gracefully behind the bicycle!
              float vSpread = 0.10 + trailAge * 4.65;
              float armDist = abs(warpedD - vSpread);
              float innerArmDist = abs(warpedD - vSpread * 0.54);

              float armMask = exp(-armDist * armDist * (4.6 - trailAge * 2.2)) * (1.0 - trailAge * 0.65) * aftFade;
              float innerArmMask = exp(-innerArmDist * innerArmDist * 5.2) * (1.0 - trailAge * 0.72) * aftFade;
              float centerTurbulence = exp(-minTrailD * minTrailD * 14.0) * (1.0 - trailAge * 0.58);

              // Feathered diagonal Kelvin wavelets ONLY inside/along the trailing V-wake!
              float kelvinWave = sin((warpedD - vSpread) * 13.5 - uTime * 16.0);
              float innerWave  = sin((warpedD - vSpread * 0.54) * 15.5 - uTime * 18.0);
              float centerRip  = (lace - 0.5) * 0.85 * centerTurbulence;
              wakeGrad += bestSegPerp * ((kelvinWave * armMask * 0.42 + innerWave * innerArmMask * 0.24 + centerRip * 0.32) * uSplash01);

              wakeFoam += armMask * smoothstep(0.32, 0.80, lace + 0.20) * 0.62 * uSplash01;
              wakeFoam += innerArmMask * smoothstep(0.40, 0.86, lace + 0.14) * 0.30 * uSplash01;
              wakeFoam += centerTurbulence * smoothstep(0.26, 0.76, lace + 0.24) * 0.64 * uSplash01;
            }
          }

          nrm = normalize(vec3(nrm.x - wakeGrad.x, nrm.y, nrm.z - wakeGrad.y));

          // Deep Velvety Emerald Canyon Plunge Pool Absorption + Sky/Cliff Fresnel Reflection
          float poolRad = length(xz - vec2(1.0, -68.0));
          float depth01 = smoothstep(58.0, 12.0, poolRad);
          vec3 shallowJade = vec3(0.068, 0.34, 0.25);
          vec3 midEmerald  = vec3(0.024, 0.21, 0.16);
          vec3 deepJade    = vec3(0.010, 0.115, 0.088);
          vec3 waterBody = mix(shallowJade, midEmerald, smoothstep(0.0, 0.55, depth01));
          waterBody = mix(waterBody, deepJade, smoothstep(0.45, 1.0, depth01));

          vec3 V = normalize(cameraPosition - vWPos);
          float NdotV = max(0.02, dot(nrm, V));
          float fresnel = 0.09 + 0.88 * pow(1.0 - NdotV, 3.4);

          vec3 reflDir = normalize(reflect(-V, nrm));
          reflDir.y = abs(reflDir.y) + 0.015;
          vec3 skyRefl = texture2D(uSkyMap, dirToEquirectUV(normalize(reflDir))).rgb * 0.90;
          vec3 sunD = normalize(uSunDir);
          float sunAlign = max(0.0, dot(normalize(vec3(reflDir.x, 0.0, reflDir.z)), normalize(vec3(sunD.x, 0.0, sunD.z))));
          vec3 goldenMistBoost = mix(vec3(0.26, 0.44, 0.40), vec3(0.95, 0.76, 0.44), pow(sunAlign, 2.0));
          vec3 envRefl = mix(skyRefl, goldenMistBoost, 0.34);

          // Natural Wave-Distorted Tinted Reflection of Pelican & Bicycle (soft emerald-blended colors, NO black ink rings!)
          if (uHeroAboveWater < 3.6 && abs(xz.x - uSplashPos.x) < 5.8 && abs(xz.y - uSplashPos.z) < 7.5) {
            vec2 fwd = normalize(uHeroFwd + vec2(1e-5));
            vec2 rgt = vec2(-fwd.y, fwd.x);
            vec2 camRel = cameraPosition.xz - uSplashPos.xz;
            // Strong wave-normal distortion so reflection shimmers naturally across ripples!
            vec2 pixRel = xz - uSplashPos.xz + nrm.xz * 0.48 + vec2(warpA, warpB) * 0.08;
            float camLat = dot(camRel, rgt);
            float pixLat = dot(pixRel, rgt);
            float denom = camLat - pixLat;
            if (abs(denom) > 0.05) {
              float uRay = pixLat / denom;
              if (uRay > 0.0 && uRay < 2.6) {
                float camH = max(0.25, cameraPosition.y - uSplashPos.y);
                float yVirt = uRay * camH - uHeroAboveWater;
                vec2 hitXZ = pixRel + uRay * (pixRel - camRel);
                float fCoord = dot(hitXZ, fwd);

                float dFW = length(vec2(fCoord - 0.50, yVirt - 0.33));
                float dRW = length(vec2(fCoord + 0.52, yVirt - 0.33));
                float tireRim = smoothstep(0.075, 0.018, abs(dFW - 0.31)) + smoothstep(0.075, 0.018, abs(dRW - 0.31));
                float frameBar = smoothstep(0.075, 0.020, abs(yVirt - 0.56)) * step(abs(fCoord), 0.48);
                vec2 pelEll = (vec2(fCoord + 0.05, yVirt - 0.98)) / vec2(0.42, 0.44);
                float pelBody = smoothstep(1.15, 0.65, length(pelEll));

                float atten = smoothstep(3.2, 0.25, uHeroAboveWater) * 0.34;
                vec3 reflTint = envRefl;
                reflTint = mix(reflTint, vec3(0.42, 0.46, 0.34), clamp(tireRim, 0.0, 1.0) * 0.55);   // Warm cream tire reflection
                reflTint = mix(reflTint, vec3(0.36, 0.14, 0.15), clamp(frameBar, 0.0, 1.0) * 0.65);  // Muted crimson frame reflection
                reflTint = mix(reflTint, vec3(0.56, 0.58, 0.50), clamp(pelBody, 0.0, 1.0) * 0.60);   // Soft ivory plumage reflection
                float maskTot = clamp(tireRim * 0.65 + frameBar * 0.65 + pelBody * 0.75, 0.0, 1.0) * atten;
                envRefl = mix(envRefl, reflTint, maskTot);
                waterBody *= (1.0 - maskTot * 0.28);
              }
            }
          }

          vec3 col = mix(waterBody, envRefl, fresnel);

          // Crisp Sunlit Specular Glints Dancing Across the Capillary & Kelvin Ripples!
          vec3 H = normalize(sunD + V);
          float NdotH = max(0.0, dot(nrm, H));
          float specTight = pow(NdotH, 160.0) * 1.45;
          float specSoft  = pow(NdotH, 28.0) * 0.26;
          col += vec3(1.00, 0.90, 0.62) * (specTight + specSoft);

          // Delicate sunlit white-jade lacy foam ONLY on thin tire slice & feathered V-wake!
          float foamMask = clamp(wakeFoam, 0.0, 0.84);
          vec3 foamCol = mix(vec3(0.84, 0.95, 0.91), vec3(1.00, 0.98, 0.93), clamp(foamMask * 1.15, 0.0, 1.0));
          col = mix(col, foamCol, foamMask);

          float edgeAlpha = smoothstep(115.0, 62.0, length(xz - vec2(0.0, -64.0)));
          gl_FragColor = vec4(col, edgeAlpha * 0.97);
        }
      `,
    });
    const canyonWaterMesh = new THREE.Mesh(cwGeo, cwMat);
    canyonWaterMesh.position.set(0.0, CANYON_WATER_Y, -64.0);
    canyonWaterMesh.renderOrder = 2;
    group.add(canyonWaterMesh);
  }

  // Physical Parabolic Sunlit Micro-Droplets kicked up by Front & Rear Bicycle Tires (NO plastic cylinder cup!)
  const ZJJ_DROP_COUNT = 168;
  const zjjWaterSkimGroup = new THREE.Group();
  zjjWaterSkimGroup.visible = false;
  group.add(zjjWaterSkimGroup);
  const zjjDropGeo = new THREE.OctahedronGeometry(0.0055, 0);
  zjjDropGeo.scale(0.85, 0.85, 2.0);
  const zjjDropMat = new THREE.MeshBasicMaterial({
    color: 0xfff4d6,
    transparent: true,
    opacity: 0.80,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const zjjDropMesh = new THREE.InstancedMesh(zjjDropGeo, zjjDropMat, ZJJ_DROP_COUNT);
  zjjDropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  zjjDropMesh.renderOrder = 8;
  zjjWaterSkimGroup.add(zjjDropMesh);

  let zjjDropSeed = 20207;
  const zjjDropRand = () => { zjjDropSeed = (zjjDropSeed * 16807) % 2147483647; return (zjjDropSeed - 1) / 2147483646; };
  const zjjDropState = Array.from({ length: ZJJ_DROP_COUNT }, (_, i) => {
    const isRear = i % 5 >= 2;
    const sideSign = i % 2 === 0 ? 1.0 : -1.0;
    return {
      z0: isRear ? -0.55 : +0.46,
      phase: zjjDropRand(),
      rate: 1.45 + zjjDropRand() * 1.25,
      vx: sideSign * (0.24 + Math.pow(zjjDropRand(), 1.2) * 0.92),
      vy: 0.95 + zjjDropRand() * 1.45,
      vz: -(2.1 + zjjDropRand() * 2.6),
      size: 0.65 + zjjDropRand() * 0.90,
    };
  });
  const zjjDummyDrop = new THREE.Object3D();
  const zjjDropLook = new THREE.Vector3();
  const zjjTrailSampleP = new THREE.Vector3();
  const zjjTrailSampleT = new THREE.Vector3();

  // Sunlit Golden Sparkle Slipstream Trail behind Pelican's Bicycle (matches `s2_zhangjiajie_ref_board.jpg`!)
  const WAKE_COUNT = 54;
  const wakePositions = new Float32Array(WAKE_COUNT * 3);
  const wakeSeeds = new Float32Array(WAKE_COUNT);
  for (let i = 0; i < WAKE_COUNT; i++) wakeSeeds[i] = i / WAKE_COUNT;
  const wakeGeo = new THREE.BufferGeometry();
  wakeGeo.setAttribute('position', new THREE.BufferAttribute(wakePositions, 3));
  wakeGeo.setAttribute('aFrac', new THREE.BufferAttribute(wakeSeeds, 1));
  const wakeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: atmoUniforms.uTime },
    vertexShader: `
      attribute float aFrac;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vAlpha = (1.0 - aFrac) * (0.65 + 0.35 * sin(uTime * 14.0 + aFrac * 42.0));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = mix(5.0, 1.4, aFrac) * (18.0 / max(2.8, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        if (r > 1.0) discard;
        float glow = pow(1.0 - r, 2.2) * vAlpha * 0.68;
        gl_FragColor = vec4(vec3(1.00, 0.88, 0.52) * glow, glow);
      }
    `,
  });
  const wakePoints = new THREE.Points(wakeGeo, wakeMat);
  wakePoints.visible = false;

  // 7. V3.5 IMAX Wide-Angle Hero Lens (`FOV = 50°–52°`, `D = 2.8m–3.3m`, Pelican = 39%–47% of frame!)
  const heroKeyframes = [
    { t:  0.0, pos: [ +2.4, 52.6, +31.5] }, // Emerge from golden mist past foreground lens
    { t:  2.4, pos: [ +2.0, 51.0, +19.5] }, // Wide IMAX hero reveal of Pavilion, Sky-Arch & Curtain Waterfall
    { t:  6.2, pos: [ +2.8, 46.8,  -9.5] }, // Soaring right beside Grand Stepped Curtain-Waterfall Cliff (`Z=-7.4`)!
    { t:  8.0, pos: [ +4.8, 45.6, -21.5] }, // Banking smoothly toward 26m Natural Stone Sky-Arch (`X=+6, Z=-33`)
    { t:  9.4, pos: [ +4.8, 44.8, -32.5] }, // Gliding under Sky-Arch framing Tall Twin-Stream Waterfall Pillar ahead!
    { t: 11.4, pos: [ +3.6, 35.2, -48.0] }, // Swooping down past Twin-Stream Waterfall Pillar toward emerald pool
    { t: 13.0, pos: [ +1.3, 21.0, -61.5] }, // Touching down into Emerald Canyon Plunge River Pool (Y = 20.8m)!
    { t: 14.5, pos: [ +0.9, 20.84,-71.5] }, // Skimming emerald ripples during silky horizontal camera turn
    { t: 16.0, pos: [ +1.2, 20.84,-82.0] }, // Seamless water-skim match-cut into Station 03 (Guilin Li River)!
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.30,
    bankGain: 0.56,
    maxBankRad: 0.28,
    surfaceConstraintFn: (t, outPos) => {
      const waterLock = quintic01(12.95, 13.65, t);
      if (waterLock > 0.001) {
        outPos.y = THREE.MathUtils.lerp(outPos.y, CANYON_WATER_Y + 0.03, waterLock);
      }
    },
  });

  const ZJJ_GAZE = [
    { t:  0.0, yaw:  0.14, pitch: -0.04 },
    { t:  2.8, yaw:  0.18, pitch:  0.02 },
    { t:  6.0, yaw:  0.24, pitch: -0.03 }, // Joyful 3/4 side-front glance toward lens & Curtain Waterfall!
    { t:  9.0, yaw: -0.10, pitch: -0.12 }, // Looking up at the 26m Sky-Arch & Tall Twin-Stream Waterfall Pillar!
    { t: 11.8, yaw:  0.04, pitch:  0.16 }, // Focusing down on the shimmering Emerald Canyon Plunge Pool!
    { t: 14.2, yaw:  0.22, pitch:  0.06 }, // Delighted glance toward camera during water-skim turn into Guilin!
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const tmpWake = new THREE.Vector3();

  // Unified Pelican-Relative Horizontal Offset Director (`right < 0` West/Left side throughout ->
  // ZERO centerline crossing, 0.0° roll, exact 2.8m–3.3m hero scale = 39%–47% frame height!)
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);

    // Phase weights (C2 quintic transitions)
    const wIntro  = quintic01(0.0, 2.6, tc);   // 4.4m -> 3.15m mist entry reveal
    const wFront1 = quintic01(3.0, 5.6, tc);   // Glide alongside left wing to 3/4 side-front for Curtain Waterfall!
    const wBack2  = quintic01(7.0, 9.0, tc);   // Glide smoothly back to 3/4 side-rear for 26m Sky-Arch & Twin Waterfall!
    const wTurn3  = quintic01(12.2, 15.8, tc); // Low water-skim horizontal camera turn (`转镜头，到漓江`)!

    // Smoothly bow out `rightOff` whenever `aheadOff` passes 0 so camera-to-Pelican distance stays ~2.85m–3.25m!
    const passWing1 = Math.sin(wFront1 * Math.PI);
    const passWing2 = Math.sin(wBack2 * Math.PI);
    const passWing3 = Math.sin(wTurn3 * Math.PI);

    // 1) Camera Position Offsets (meters in Pelican's horizontal frame: right, up, ahead)
    let rightOff = THREE.MathUtils.lerp(-0.92, -1.35, wIntro);
    rightOff = THREE.MathUtils.lerp(rightOff, -2.55, wFront1);
    rightOff = THREE.MathUtils.lerp(rightOff, -1.55, wBack2);
    rightOff = THREE.MathUtils.lerp(rightOff, -2.95, wTurn3);
    rightOff -= 0.45 * Math.max(passWing1, passWing2, passWing3 * 0.65);

    let aheadOff = THREE.MathUtils.lerp(-4.25, -2.75, wIntro);
    aheadOff = THREE.MathUtils.lerp(aheadOff, +1.55, wFront1); // t=6.2s: 3/4 side-front hero portrait + Curtain Waterfall + Golden Sky!
    aheadOff = THREE.MathUtils.lerp(aheadOff, -2.52, wBack2);  // t=9.4s: 3/4 side-rear through Sky-Arch!
    aheadOff = THREE.MathUtils.lerp(aheadOff, +1.35, wTurn3);  // t=14.0s..16s: sweeping horizontal water pan!

    let upOff = THREE.MathUtils.lerp(0.96, 0.82, wIntro);
    upOff = THREE.MathUtils.lerp(upOff, 0.64, wFront1);
    upOff = THREE.MathUtils.lerp(upOff, 0.78, wBack2);
    upOff = THREE.MathUtils.lerp(upOff, 0.88, wTurn3);

    applyHorizontalOffset(tmpH, tmpHz, rightOff, upOff, aheadOff, outPos);
    outPos.y = Math.max(CANYON_WATER_Y + 0.88, outPos.y);

    // 2) LookAt Offsets (anchors Pelican + Bike at 38%–48% height in foreground while framing landmarks!)
    let lookRight = THREE.MathUtils.lerp(+0.20, +0.35, wIntro); // Frames Pavilion (L), Arch (C), Waterfall (R)
    lookRight = THREE.MathUtils.lerp(lookRight, +1.65, wFront1); // Frames Curtain Waterfall (L), 3/4-Front Pelican (C), Golden Sky & Pines (R)!
    lookRight = THREE.MathUtils.lerp(lookRight, -0.45, wBack2);  // Frames Twin Waterfall (L-C), Sky-Arch & Pelican (R-C)!
    lookRight = THREE.MathUtils.lerp(lookRight, +1.95, wTurn3);  // Sweeps horizontally across emerald splash & mist!

    let lookAhead = THREE.MathUtils.lerp(+3.20, +2.40, wIntro);
    lookAhead = THREE.MathUtils.lerp(lookAhead, -2.15, wFront1);
    lookAhead = THREE.MathUtils.lerp(lookAhead, +2.80, wBack2);
    lookAhead = THREE.MathUtils.lerp(lookAhead, -0.95, wTurn3);

    let lookUp = THREE.MathUtils.lerp(0.58, 0.58, wIntro);
    lookUp = THREE.MathUtils.lerp(lookUp, 0.54, wFront1);
    lookUp = THREE.MathUtils.lerp(lookUp, 0.58, wBack2);
    lookUp = THREE.MathUtils.lerp(lookUp, 0.48, wTurn3);

    applyHorizontalOffset(tmpH, tmpHz, lookRight, lookUp, lookAhead, outLook);

    const fov = THREE.MathUtils.lerp(52.5, 50.5, wIntro);
    return THREE.MathUtils.lerp(fov, 50.0, Math.max(wFront1, wTurn3));
  }, DURATION, 0.32);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    volClouds.update(tGlobal);
    waterfallMistClouds.update(tGlobal);

    const waterTouch01 = quintic01(12.80, 13.55, tCycle);
    const slalomBoost = quintic01(6.2, 8.2, tCycle) * (1.0 - waterTouch01);
    const thrust = THREE.MathUtils.lerp(1.06, 1.54, slalomBoost) * (1.0 - waterTouch01 * 0.75);
    const windStrength = THREE.MathUtils.lerp(1.14, 1.48, slalomBoost);

    const rawBank = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    const bankRad = rawBank * (1.0 - waterTouch01 * 0.85);

    const heroAboveWater = Math.max(0.0, pHero.y - CANYON_WATER_Y);
    canyonWaterUniforms.uSplashPos.value.set(pHero.x, CANYON_WATER_Y, pHero.z);
    canyonWaterUniforms.uHeroFwd.value.set(vHoriz.x, vHoriz.z).normalize();
    canyonWaterUniforms.uHeroAboveWater.value = heroAboveWater;
    canyonWaterUniforms.uSplash01.value = waterTouch01;

    // Expanding physical gravity-wave ring packet anchored at exact touchdown point (t = 12.92s)
    if (tCycle >= 12.88) {
      heroTrack.evaluate(12.92, zjjTrailSampleP, zjjTrailSampleT);
      canyonWaterUniforms.uTouchRipplePos.value.set(zjjTrailSampleP.x, zjjTrailSampleP.z);
      canyonWaterUniforms.uTouchRippleAge.value = tCycle - 12.88;
    } else {
      canyonWaterUniforms.uTouchRippleAge.value = -1.0;
    }

    if (tCycle >= 12.2) {
      for (let i = 0; i < ZJJ_TRAIL_LEN; i++) {
        const tHist = Math.max(0.0, tCycle - i * 0.13);
        heroTrack.evaluate(tHist, zjjTrailSampleP, zjjTrailSampleT);
        const hAbove = Math.max(0.0, zjjTrailSampleP.y - CANYON_WATER_Y);
        const wContact = 1.0 - quintic01(0.08, 1.15, hAbove);
        zjjWakeTrailArr[i].set(zjjTrailSampleP.x, CANYON_WATER_Y, zjjTrailSampleP.z, wContact);
      }
    } else {
      for (let i = 0; i < ZJJ_TRAIL_LEN; i++) {
        zjjWakeTrailArr[i].w = 0.0;
      }
    }

    zjjWaterSkimGroup.visible = waterTouch01 > 0.012;
    if (zjjWaterSkimGroup.visible) {
      zjjWaterSkimGroup.position.set(pHero.x, CANYON_WATER_Y + 0.012, pHero.z);
      zjjWaterSkimGroup.rotation.set(0.0, Math.atan2(vHoriz.x, vHoriz.z), 0.0);
      zjjDropMat.opacity = 0.82 * waterTouch01;
      const gravity = 5.5;
      for (let i = 0; i < ZJJ_DROP_COUNT; i++) {
        const dp = zjjDropState[i];
        const s = (dp.phase + tGlobal * dp.rate) % 1.0;
        const age = s * 0.56;
        const px = dp.vx * age;
        const py = Math.max(-0.02, dp.vy * age - 0.5 * gravity * age * age);
        const pz = dp.z0 + dp.vz * age;
        zjjDummyDrop.position.set(px, py, pz);
        zjjDropLook.set(px + dp.vx * 0.15, py + (dp.vy - gravity * age) * 0.15, pz + dp.vz * 0.15);
        zjjDummyDrop.lookAt(zjjDropLook);
        const sc = dp.size * Math.sin(Math.PI * s) * waterTouch01;
        zjjDummyDrop.scale.setScalar(Math.max(0.001, sc));
        zjjDummyDrop.updateMatrix();
        zjjDropMesh.setMatrixAt(i, zjjDummyDrop.matrix);
      }
      zjjDropMesh.instanceMatrix.needsUpdate = true;
    }

    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: waterTouch01 > 0.3 ? 6.8 : 5.5 + slalomBoost * 1.8,
      groundRide01: waterTouch01,
      nightLamp01: 0.08,
      tCycle,
      gazeSchedule: ZJJ_GAZE,
      cycleLen: DURATION,
    });

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 86.0);

    if (camMode === 'arch_pavilion_waterfall_macro') {
      camera.fov = 44;
      camera.position.set(-4.5, 49.5, 6.0);
      camera.lookAt(16.0, 42.0, -7.5);
      camera.updateProjectionMatrix();
      return { beatText: '层理绝壁飞瀑微距 · 水平层理石英砂岩绝壁、平顶奇松与宽幅咆哮白练飞瀑' };
    }
    if (camMode === 'geo_skyarch_qiankun_macro') {
      camera.fov = 44;
      camera.position.set(2.8, 47.5, -18.5);
      camera.lookAt(-6.5, 44.5, -48.0);
      camera.updateProjectionMatrix();
      return { beatText: '天生石桥与双叠飞瀑天柱微距 · 26m 天下第一桥巨拱与平顶奇松双流飞瀑天柱' };
    }

    applyStabilizedCam(tCycle, camera);

    const mistIntro = 1.0 - quintic01(0.0, 1.8, tCycle);
    const waterMistOutro = quintic01(14.5, 15.95, tCycle);

    let beatText = '第一幕 · 穿过迷雾进入张家界仍持远景 · 层理绝壁飞瀑、平顶奇松与金色云海全景';
    if (tCycle >= 3.6 && tCycle < 11.4) {
      beatText = '第二幕 · 稳定追随鹈鹕穿梭砂岩天柱、宽幅飞瀑绝壁与天生石桥巨拱';
    } else if (tCycle >= 11.4) {
      beatText = '第三幕 · 俯冲落入峡谷碧水激起层层水花 · 丝滑转镜无缝衔入桂林漓江';
    }
    return {
      beatText,
      fogDensityOverride: 0.0016 + mistIntro * 0.0032 + waterMistOutro * 0.0034,
    };
  }

  await applyStationHdPbrUpgrade(2, group, renderer);

  return {
    id: 2,
    slug: 'zhangjiajie',
    nameZh: '张家界奇峰',
    titleZh: '张家界武陵源 · 奇峰云瀑穿行落水入漓江',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.86,
    fogColor: new THREE.Color(0xf5ebd8),
    fogDensity: 0.0016,
    exposure: 1.00,
    transitionColor: '#d4efe0',
    omniVideos: [omniCurtain.vid, omniWaterfall.vid, omniCloud.vid],
    stageTris: Math.round(stageTris),
    update,
  };
}
