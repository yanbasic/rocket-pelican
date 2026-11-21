// ============================================================================
// V3 STATION 05: 北京紫禁城 · 飞越太和殿与紫禁城琉璃金顶海
// (BEIJING FORBIDDEN CITY — IMPERIAL WAY GROUND RIDE -> TAIHEDIAN ROOF SOAR -> GOLDEN CLOUDS)
// Standardized Soarin' Over China V3 3D Station Module
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';
import {
  smoothstep01,
  quintic01,
  createSurfaceHeightSampler,
  createHeroTrajectory,
  applyHorizontalOffset,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';

function canalCenterZ(x) {
  // Matches Blender `canal_center_y(x) = -68.5 + 5.2 * pow(min(1, |x|/68), 1.85)` under `z_gltf = -y_bl`
  return 68.5 - 5.2 * Math.pow(Math.min(1.0, Math.abs(x) / 68.0), 1.85);
}

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station05_ForbiddenCity_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 16.0;

  // Warm Late-Afternoon Imperial Beijing Sun (Upper-Left West-Northwest/Southwest golden hour matching `s5_forbidden_city_ref_board.jpg`!)
  const SUN_POS = new THREE.Vector3(-210.0, 96.0, 28.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  // 1. V3 Golden-Hour Beijing Imperial Horizon 360° Sky Dome (`fc_sky_v3_panorama.jpg`, 256px tail cross-fade) + PMREM
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene5_forbiddencity/fc_sky_v3_panorama.jpg', resolve, undefined, reject);
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
        float h = clamp(d.y, -0.2, 1.0);
        vec3 royalZenith     = vec3(0.42, 0.64, 0.88);
        vec3 imperialHorizon = vec3(0.99, 0.85, 0.54);
        vec3 cleanGrad = mix(imperialHorizon, royalZenith, smoothstep(0.02, 0.52, h));
        vec3 col = mix(texCol * 1.05, cleanGrad, 0.24);

        float mu = max(0.0, dot(d, normalize(uSunDir)));
        float sunDisc = smoothstep(0.9980, 0.9997, mu);
        float innerGlow = pow(mu, 28.0) * 0.92;
        float wideHalo = pow(mu, 5.2) * 0.30;
        float horizonGold = exp(-pow(abs(d.y - 0.03) * 5.6, 2.0)) * 0.20;

        col += vec3(1.0, 0.82, 0.42) * (wideHalo + horizonGold);
        col += vec3(1.0, 0.94, 0.72) * innerGlow;
        col += vec3(1.0, 0.99, 0.92) * sunDisc * 2.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(650, 56, 36), skyDomeMat);
  skyDome.rotation.y = -Math.PI * 0.5;
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
    addCard([-22, 14,   8], [22, 14], 0xffd26a);
    addCard([ 18, 16, -12], [18, 12], 0x82aae2);
    addCard([  0, -14,  0], [38, 38], 0xedb03c);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.025).texture;
    pmrem.dispose();
    envScene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material !== skyDomeMat) o.material.dispose();
    });
  }

  // 2. Imperial Golden-Hour Station Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xd8e8ff, 0xebb65e, 0.72);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffe4aa, 3.35);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -56;
  sunLight.shadow.camera.right = 56;
  sunLight.shadow.camera.top = 48;
  sunLight.shadow.camera.bottom = -44;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 230.0;
  sunLight.shadow.bias = -0.00032;
  group.add(sunLight);
  group.add(sunLight.target);

  const skyFillLight = new THREE.DirectionalLight(0xaad0ff, 0.82);
  skyFillLight.position.set(82, 56, 72);
  group.add(skyFillLight);

  const goldenTileBounceLight = new THREE.DirectionalLight(0xffce5c, 0.84);
  goldenTileBounceLight.position.set(-10, -32, -8);
  group.add(goldenTileBounceLight);

  const eaveGlowLight = new THREE.PointLight(0xffd05b, 0.0, 24.0, 1.35);
  group.add(eaveGlowLight);

  // 3. Load V3 Forbidden City Architectural GLB + Stage Layout JSON
  const layoutRes = await fetch('./assets/soarin_scene5_forbiddencity/forbiddencity_stage_layout.json');
  const stageLayout = await layoutRes.json();

  const fcGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene5_forbiddencity/forbiddencity_hero_stage.glb', resolve, undefined, reject);
  });

  // 4. Shimmering Water Surfaces: Bowed Inner Golden Water River (`内金水河`) + 4-Sided Outer Imperial Moat (`筒子河`)!
  const atmoUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: SUN_DIR },
  };

  // (4a) Bowed Inner Golden Water River (`内金水河`) beneath the 5 White-Marble Bridges
  {
    const waterGeo = new THREE.PlaneGeometry(151.5, 10.7, 92, 10);
    waterGeo.rotateX(-Math.PI * 0.5);
    const posAttr = waterGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = posAttr.getX(i);
      const localZ = posAttr.getZ(i);
      posAttr.setZ(i, canalCenterZ(wx) + localZ);
    }
    waterGeo.computeVertexNormals();

    const waterMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: atmoUniforms.uTime,
        uSunDir: atmoUniforms.uSunDir,
      },
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vWPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec3 vWPos;
        void main() {
          float w1 = sin(vWPos.x * 2.4 + vWPos.z * 3.1 - uTime * 2.5);
          float w2 = cos(vWPos.x * 4.3 - vWPos.z * 5.2 + uTime * 3.1);
          float w3 = sin((vWPos.x + vWPos.z) * 8.2 - uTime * 3.9);
          vec3 n = normalize(vec3((w1 * 0.5 + w2 * 0.5) * 0.055, 1.0, (w2 * 0.5 + w3 * 0.5) * 0.065));

          vec3 vDir = normalize(cameraPosition - vWPos);
          float fres = pow(1.0 - max(0.0, dot(n, vDir)), 3.0);

          vec3 deepCanal = vec3(0.12, 0.24, 0.21);
          vec3 skyRefl   = vec3(0.95, 0.78, 0.44);
          vec3 col = mix(deepCanal, skyRefl, clamp(0.26 + fres * 0.72, 0.0, 1.0));

          vec3 reflDir = reflect(-vDir, n);
          float sunSpec = pow(max(0.0, dot(reflDir, normalize(uSunDir))), 42.0);
          float broadSheen = pow(max(0.0, dot(reflDir, normalize(uSunDir))), 6.5);
          col += vec3(1.0, 0.85, 0.45) * broadSheen * 0.42;
          col += vec3(1.0, 0.96, 0.80) * sunSpec * 1.80;

          float bridgeOcc = 1.0;
          bridgeOcc *= smoothstep(1.8, 4.2, abs(vWPos.x));
          bridgeOcc *= smoothstep(1.4, 3.4, abs(abs(vWPos.x) - 12.8));
          bridgeOcc *= smoothstep(1.3, 3.1, abs(abs(vWPos.x) - 25.5));
          col *= mix(0.46, 1.0, bridgeOcc);

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    });
    const canalWaterMesh = new THREE.Mesh(waterGeo, waterMat);
    canalWaterMesh.position.y = -0.42;
    group.add(canalWaterMesh);
  }

  // (4b) Wide 4-Sided Emerald-Jade & Golden-Reflecting Imperial Moat (`筒子河`, 50m wide!)
  if (stageLayout.moat_bounds) {
    const mb = stageLayout.moat_bounds;
    const moatMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: atmoUniforms.uTime,
        uSunDir: atmoUniforms.uSunDir,
        uInnerX: { value: mb.x_in },
      },
      vertexShader: `
        #include <fog_pars_vertex>
        varying vec3 vWPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform float uInnerX;
        varying vec3 vWPos;
        void main() {
          float r1 = sin(vWPos.x * 0.85 + vWPos.z * 0.65 - uTime * 1.7);
          float r2 = cos(vWPos.x * 1.95 - vWPos.z * 1.55 + uTime * 2.2);
          float r3 = sin((vWPos.x - vWPos.z) * 3.8 + uTime * 2.9);
          vec3 n = normalize(vec3((r1 * 0.5 + r2 * 0.5) * 0.048, 1.0, (r2 * 0.5 + r3 * 0.5) * 0.052));

          vec3 vDir = normalize(cameraPosition - vWPos);
          float fres = pow(1.0 - max(0.0, dot(n, vDir)), 2.9);

          vec3 emeraldMoat = vec3(0.09, 0.22, 0.19);
          vec3 goldenSky   = vec3(0.92, 0.78, 0.48);
          float nearWall = 1.0 - smoothstep(1.0, 12.0, abs(abs(vWPos.x) - uInnerX));
          vec3 wallRefl = vec3(0.42, 0.17, 0.13);

          vec3 col = mix(emeraldMoat, goldenSky, clamp(0.18 + fres * 0.68, 0.0, 1.0));
          col = mix(col, wallRefl, nearWall * 0.22);

          vec3 reflDir = reflect(-vDir, n);
          float sunSpec = pow(max(0.0, dot(reflDir, normalize(uSunDir))), 36.0);
          float sheen = pow(max(0.0, dot(reflDir, normalize(uSunDir))), 5.5);
          col += vec3(1.0, 0.84, 0.44) * sheen * 0.34;
          col += vec3(1.0, 0.96, 0.82) * sunSpec * 1.45;

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    });

    const xMid = 0.5 * (mb.x_in + mb.x_out);
    const wMoat = mb.x_out - mb.x_in;
    const zSouthIn = -mb.ys_in;
    const zSouthOut = -mb.ys_out;
    const zNorthIn = -mb.yn_in;
    const zNorthOut = -mb.yn_out;
    const nsLen = zSouthIn - zNorthIn;
    const nsMidZ = 0.5 * (zSouthIn + zNorthIn);
    const ewFullW = 2.0 * mb.x_out;

    for (const [cx, cz, sx, sz] of [
      [-xMid, nsMidZ, wMoat, nsLen],
      [+xMid, nsMidZ, wMoat, nsLen],
      [0.0, 0.5 * (zSouthIn + zSouthOut), ewFullW, zSouthOut - zSouthIn],
      [0.0, 0.5 * (zNorthIn + zNorthOut), ewFullW, zNorthIn - zNorthOut],
    ]) {
      const g = new THREE.PlaneGeometry(sx, sz, 24, 24);
      g.rotateX(-Math.PI * 0.5);
      const m = new THREE.Mesh(g, moatMat);
      m.position.set(cx, mb.moat_water_y_gltf ?? -0.45, cz);
      group.add(m);
    }
  }

  // 5. Luminous Pixar Sunlit Golden-Cream Volumetric Cumulus Clouds (`createVolumetricCloudSystem`)
  //    Clean ivory-gold highlights & warm pearl-apricot underside (ZERO muddy dark smoke!) framing the Northern Horizon
  //    at `z ~ -68..-150, y ~ 36..58m` for a seamless golden cloud crest transition into Dunhuang!
  const cloudSys = createVolumetricCloudSystem({
    sunDir: SUN_DIR,
    litColor: 0xfffaf0,
    shadowColor: 0xe8d0a6,
    rimColor: 0xffe8a2,
    opacity: 0.44,
    seed: 202605,
    clusters: [
      // Flanking Golden Cumulus Wisps (`z ~ -68..-98, y ~ 36..48m`) keeping central palace vista crystal-clear at t=11.4s!
      { center: [-46.0, 40.0,  -72.0], radius: [20, 5.0, 12], puffs: 14, scale: [10.0, 18.0] },
      { center: [ 48.0, 40.0,  -75.0], radius: [20, 5.0, 12], puffs: 14, scale: [10.0, 18.0] },
      { center: [-88.0, 46.0,  -98.0], radius: [28, 6.5, 16], puffs: 16, scale: [13.0, 24.0] },
      { center: [ 92.0, 46.0,  -98.0], radius: [28, 6.5, 16], puffs: 16, scale: [13.0, 24.0] },
      // Crest-into-Dunhuang Golden Horizon Cloud Bank (`z ~ -92..-155, y ~ 38..56m`, met during 12.6..16.0s!)
      { center: [-22.0, 42.5,  -96.0], radius: [24, 5.5, 14], puffs: 16, scale: [11.0, 21.0] },
      { center: [ 24.0, 42.5,  -98.0], radius: [24, 5.5, 14], puffs: 16, scale: [11.0, 21.0] },
      { center: [  0.0, 49.0, -128.0], radius: [38, 7.5, 18], puffs: 22, scale: [15.0, 28.0] },
      { center: [-58.0, 52.0, -145.0], radius: [36, 7.5, 18], puffs: 18, scale: [15.0, 28.0] },
      { center: [ 62.0, 52.0, -145.0], radius: [36, 7.5, 18], puffs: 18, scale: [15.0, 28.0] },
    ],
  });
  group.add(cloudSys.mesh);

  // 6. Diagonal Warm Golden Crepuscular Sunbeam Shafts + Subtle Omni `fc_omni_golden_motes.mp4` + 3D Floating Gold Dust
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
          float beam = pow(max(0.0, across), 2.4);
          float along = smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.14, vUv.y);
          float shimmer = 0.88 + 0.12 * sin(uTime * 1.2 + vUv.x * 7.5);
          float a = beam * along * shimmer * 0.085;
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.48) * a, a);
        }
      `,
    });
    for (const [tx, ty, tz, w, len] of [
      [  0, 12,  66, 28, 210],
      [  2, 16,  28, 32, 220],
      [  0, 28,  -8, 38, 230],
      [-52, 22, -24, 34, 225],
      [ 48, 22, -45, 34, 225],
      [ -4, 26, -74, 32, 225],
      [  8, 28,-128, 36, 235],
    ]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
      const targetV = new THREE.Vector3(tx, ty, tz);
      m.position.copy(targetV.clone().lerp(SUN_POS, 0.44));
      m.lookAt(SUN_POS);
      m.rotateX(Math.PI * 0.5);
      group.add(m);
    }
  }

  const omniMotes = createLoopingVideoTexture('./assets/soarin_scene5_forbiddencity/fc_omni_golden_motes.mp4');
  const omniMotesMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniMotes.vTex },
      uTint: { value: new THREE.Color(0xffe8aa) },
      uOpacity: { value: 0.14 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 raw = texture2D(uVid, vUv).rgb;
        vec3 c = max(vec3(0.0), raw - vec3(0.14));
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        float fx = smoothstep(0.12, 0.34, vUv.x) * smoothstep(0.92, 0.72, vUv.x);
        float fy = smoothstep(0.12, 0.32, vUv.y) * smoothstep(0.90, 0.66, vUv.y);
        float w = smoothstep(0.04, 0.52, luma) * fx * fy * uOpacity;
        gl_FragColor = vec4(c * uTint * 1.35 * w, w);
      }
    `,
  });
  for (const cfg of [
    { pos: [-18.0, 14.5,  52.0], scale: [26, 13], rotY:  0.22 },
    { pos: [ 18.5, 18.5,  22.0], scale: [24, 12], rotY: -0.26 },
    { pos: [-22.0, 26.0,  -4.0], scale: [26, 13], rotY:  0.20 },
    { pos: [ 22.0, 34.0, -34.0], scale: [28, 14], rotY: -0.18 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniMotesMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rotY;
    m.renderOrder = 4;
    group.add(m);
  }

  // 340 Floating 3D Imperial Golden Sun-Dust Motes
  {
    const MOTE_COUNT = 340;
    const moteGeo = new THREE.PlaneGeometry(0.16, 0.16);
    const moteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: atmoUniforms.uTime },
      vertexShader: `
        attribute vec3 aOffset;
        attribute float aPhase;
        uniform float uTime;
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          vUv = uv;
          vec3 wCenter = aOffset;
          wCenter.y += sin(uTime * 0.85 + aPhase * 6.28) * 0.85;
          wCenter.x += cos(uTime * 0.62 + aPhase * 9.1) * 0.65;
          vTwinkle = 0.45 + 0.55 * sin(uTime * 2.8 + aPhase * 19.0);
          vec4 mvCenter = viewMatrix * modelMatrix * vec4(wCenter, 1.0);
          mvCenter.xy += position.xy * (0.7 + 0.6 * vTwinkle);
          gl_Position = projectionMatrix * mvCenter;
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        varying float vTwinkle;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float g = pow(max(0.0, 1.0 - r), 2.5) * vTwinkle * 0.56;
          gl_FragColor = vec4(vec3(1.0, 0.88, 0.50) * g, g);
        }
      `,
    });
    const instMoteGeo = new THREE.InstancedBufferGeometry();
    instMoteGeo.index = moteGeo.index;
    instMoteGeo.attributes.position = moteGeo.attributes.position;
    instMoteGeo.attributes.uv = moteGeo.attributes.uv;
    moteGeo.dispose();
    const offsets = new Float32Array(MOTE_COUNT * 3);
    const phases = new Float32Array(MOTE_COUNT);
    let mSeed = 5050;
    const mRand = () => { mSeed = (mSeed * 16807) % 2147483647; return (mSeed - 1) / 2147483646; };
    for (let i = 0; i < MOTE_COUNT; i++) {
      offsets[i * 3 + 0] = (mRand() - 0.5) * 84.0;
      offsets[i * 3 + 1] = 3.5 + mRand() * 42.0;
      offsets[i * 3 + 2] = 84.0 - mRand() * 210.0;
      phases[i] = mRand();
    }
    instMoteGeo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    instMoteGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
    const motesMesh = new THREE.Mesh(instMoteGeo, moteMat);
    motesMesh.frustumCulled = false;
    motesMesh.renderOrder = 5;
    group.add(motesMesh);
  }

  // 7. Configure Forbidden City Materials + Build GPU-Instanced Populations
  const fcMatsConfigured = new Set();
  const protos = {};
  let stageTris = 0;

  fcGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const m = obj.material;
    if (m && !fcMatsConfigured.has(m.uuid)) {
      fcMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      if (m.name && m.name.includes('ImperialYellowTiles')) {
        m.color.setRGB(1.16, 0.78, 0.18);
        m.roughnessMap = null;
        if ('clearcoat' in m) {
          m.clearcoat = 0.28;
          m.clearcoatRoughness = 0.24;
        }
        m.roughness = 0.36;
        m.metalness = 0.15;
        m.envMapIntensity = 0.84;
        m.needsUpdate = true;
      }
      if (m.name && m.name.includes('GildedBronze')) {
        m.metalness = 0.90;
        m.roughness = 0.22;
        m.envMapIntensity = 1.65;
        m.needsUpdate = true;
      }
      if (m.name && m.name.includes('WhiteMarble')) {
        m.envMapIntensity = 0.95;
        m.needsUpdate = true;
      }
      if (m.name && m.name.includes('CypressFoliage')) {
        m.customProgramCacheKey = () => 'fc_cypress_breeze_' + m.name;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec3 fwPos = (modelMatrix * vec4(position, 1.0)).xyz;
             float sway = sin(uTime * 2.0 + fwPos.x * 0.35 + fwPos.z * 0.35) * 0.055;
             transformed.x += sway;`
          );
        };
        m.needsUpdate = true;
      }
    }

    if (obj.name.startsWith('Proto_')) {
      protos[obj.name] = { geo: obj.geometry, mat: obj.material };
      obj.visible = false;
      return;
    }

    obj.castShadow = true;
    obj.receiveShadow = true;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  group.add(fcGltf.scene);

  const countGeoTris = (geo) => (geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3);
  const dummy = new THREE.Object3D();

  // (7a) 132 GPU-Instanced East & West Six Palaces Golden-Roofed Courtyard Halls (`东西六宫琉璃黄瓦院落海`)
  if (protos.Proto_SixPalace_Roof && stageLayout.scatter_six_palaces?.length) {
    const arr = stageLayout.scatter_six_palaces;
    const n = arr.length;
    const instM = new THREE.InstancedMesh(protos.Proto_SixPalace_Marble.geo, protos.Proto_SixPalace_Marble.mat, n);
    const instC = new THREE.InstancedMesh(protos.Proto_SixPalace_Crimson.geo, protos.Proto_SixPalace_Crimson.mat, n);
    const instR = new THREE.InstancedMesh(protos.Proto_SixPalace_Roof.geo, protos.Proto_SixPalace_Roof.mat, n);
    for (const im of [instM, instC, instR]) { im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; }
    arr.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw || 0, 0);
      const sc = Array.isArray(it.scale) ? it.scale : [it.scale, it.scale, it.scale];
      dummy.scale.set(sc[0], sc[1], sc[2]);
      dummy.updateMatrix();
      instM.setMatrixAt(i, dummy.matrix);
      instC.setMatrixAt(i, dummy.matrix);
      instR.setMatrixAt(i, dummy.matrix);
    });
    instM.instanceMatrix.needsUpdate = true;
    instC.instanceMatrix.needsUpdate = true;
    instR.instanceMatrix.needsUpdate = true;
    group.add(instM, instC, instR);
    stageTris += n * (countGeoTris(protos.Proto_SixPalace_Marble.geo) + countGeoTris(protos.Proto_SixPalace_Crimson.geo) + countGeoTris(protos.Proto_SixPalace_Roof.geo));
  }

  // (7b) 174 GPU-Instanced Old Beijing `Hutong / Siheyuan` Grey-Tile City Blocks outside the Moat
  if (protos.Proto_Hutong_Roof && stageLayout.scatter_hutongs?.length) {
    const arr = stageLayout.scatter_hutongs;
    const n = arr.length;
    const instW = new THREE.InstancedMesh(protos.Proto_Hutong_Wall.geo, protos.Proto_Hutong_Wall.mat, n);
    const instR = new THREE.InstancedMesh(protos.Proto_Hutong_Roof.geo, protos.Proto_Hutong_Roof.mat, n);
    instW.receiveShadow = true; instR.receiveShadow = true;
    instW.frustumCulled = false; instR.frustumCulled = false;
    arr.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw || 0, 0);
      const sc = Array.isArray(it.scale) ? it.scale : [it.scale, it.scale, it.scale];
      dummy.scale.set(sc[0], sc[1], sc[2]);
      dummy.updateMatrix();
      instW.setMatrixAt(i, dummy.matrix);
      instR.setMatrixAt(i, dummy.matrix);
    });
    instW.instanceMatrix.needsUpdate = true;
    instR.instanceMatrix.needsUpdate = true;
    group.add(instW, instR);
    stageTris += n * (countGeoTris(protos.Proto_Hutong_Wall.geo) + countGeoTris(protos.Proto_Hutong_Roof.geo));
  }

  // (7c) 24 GPU-Instanced Traditional Wooden Pleasure/Scull Boats (`筒子河摇橹画舫小木船`)
  let instBoatHull = null, instBoatCanopy = null;
  const boatItems = stageLayout.scatter_moat_boats || [];
  if (protos.Proto_MoatBoat_Hull && boatItems.length) {
    const n = boatItems.length;
    instBoatHull = new THREE.InstancedMesh(protos.Proto_MoatBoat_Hull.geo, protos.Proto_MoatBoat_Hull.mat, n);
    instBoatCanopy = new THREE.InstancedMesh(protos.Proto_MoatBoat_Canopy.geo, protos.Proto_MoatBoat_Canopy.mat, n);
    instBoatHull.frustumCulled = false; instBoatCanopy.frustumCulled = false;
    group.add(instBoatHull, instBoatCanopy);
    stageTris += n * (countGeoTris(protos.Proto_MoatBoat_Hull.geo) + countGeoTris(protos.Proto_MoatBoat_Canopy.geo));
  }

  // (7d) 172 GPU-Instanced Tiny Stylized Court Visitors & Ceremonial Guards + Crisp Afternoon Stone Shadows!
  if (protos.Proto_Visitor_Body && stageLayout.scatter_visitors?.length) {
    const arr = stageLayout.scatter_visitors;
    const n = arr.length;
    const instBody = new THREE.InstancedMesh(protos.Proto_Visitor_Body.geo, protos.Proto_Visitor_Body.mat, n);
    const instHead = new THREE.InstancedMesh(protos.Proto_Visitor_Head.geo, protos.Proto_Visitor_Head.mat, n);
    instBody.castShadow = false; instBody.receiveShadow = false; instBody.frustumCulled = false;
    instHead.castShadow = false; instHead.receiveShadow = false; instHead.frustumCulled = false;

    const shGeo = new THREE.PlaneGeometry(0.54, 2.45);
    shGeo.rotateX(-Math.PI * 0.5);
    shGeo.translate(0.0, 0.022, 1.10);
    const shMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 p = (vUv - vec2(0.5, 0.25)) * vec2(2.2, 1.35);
          float a = exp(-dot(p, p) * 2.8) * 0.44;
          gl_FragColor = vec4(0.09, 0.07, 0.11, a);
        }
      `,
    });
    const instShadow = new THREE.InstancedMesh(shGeo, shMat, n);
    instShadow.frustumCulled = false;
    const shadowYaw = Math.atan2(-SUN_DIR.x, -SUN_DIR.z);

    const colTmp = new THREE.Color();
    arr.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw || 0, 0);
      dummy.scale.setScalar(it.scale || 1.0);
      dummy.updateMatrix();
      instBody.setMatrixAt(i, dummy.matrix);
      instHead.setMatrixAt(i, dummy.matrix);
      const c = it.color || [0.58, 0.14, 0.13];
      colTmp.setRGB(c[0], c[1], c[2]);
      instBody.setColorAt(i, colTmp);

      dummy.rotation.set(0, shadowYaw, 0);
      dummy.scale.setScalar(it.scale || 1.0);
      dummy.updateMatrix();
      instShadow.setMatrixAt(i, dummy.matrix);
    });
    instBody.instanceMatrix.needsUpdate = true;
    instHead.instanceMatrix.needsUpdate = true;
    if (instBody.instanceColor) instBody.instanceColor.needsUpdate = true;
    instShadow.instanceMatrix.needsUpdate = true;
    group.add(instBody, instHead, instShadow);
    stageTris += n * (countGeoTris(protos.Proto_Visitor_Body.geo) + countGeoTris(protos.Proto_Visitor_Head.geo) + 2);
  }

  // (7e) ~400 GPU-Instanced Ancient Imperial Cypresses & Moat Promenade Trees
  if (protos.Proto_Cypress_Bark && protos.Proto_Cypress_Foliage && stageLayout.scatter_cypress?.length) {
    const arr = stageLayout.scatter_cypress;
    const nC = arr.length;
    const instBark = new THREE.InstancedMesh(protos.Proto_Cypress_Bark.geo, protos.Proto_Cypress_Bark.mat, nC);
    const instFol = new THREE.InstancedMesh(protos.Proto_Cypress_Foliage.geo, protos.Proto_Cypress_Foliage.mat, nC);
    instBark.castShadow = false; instBark.receiveShadow = false; instBark.frustumCulled = false;
    instFol.castShadow = false; instFol.receiveShadow = false; instFol.frustumCulled = false;
    arr.forEach((it, i) => {
      dummy.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummy.rotation.set(0, it.yaw, 0);
      dummy.scale.setScalar(it.scale);
      dummy.updateMatrix();
      instBark.setMatrixAt(i, dummy.matrix);
      instFol.setMatrixAt(i, dummy.matrix);
    });
    instBark.instanceMatrix.needsUpdate = true;
    instFol.instanceMatrix.needsUpdate = true;
    group.add(instBark, instFol);
    stageTris += nC * (countGeoTris(protos.Proto_Cypress_Bark.geo) + countGeoTris(protos.Proto_Cypress_Foliage.geo));
  }
  stageTris = Math.round(stageTris);

  // 8. V3 Ground-to-Roof Choreography (`DURATION = 16.0s`, Exact 3-Iteration `< 0.3cm` Tire-on-Stone Solver!)
  const sampleImperialGroundY = createSurfaceHeightSampler(
    fcGltf.scene,
    (nm) => nm.includes('Courtyard_PalacePaving') || nm.includes('WhiteMarble_Terraces_And_Bridges')
  );

  const WHEEL_HALF_BASE = 0.528;
  const TIRE_CLEARANCE_M = 0.0025; // Exact 2.5mm (< 1cm!) on both curved bridge & flat stone!

  // Exact coupled 2-wheel pitch & height solver: guarantees BOTH front & rear wheels sit at `ySurface + 2.5mm` even on curved arches!
  function solveExactTwoWheelPose(zCenter) {
    let s = 0.0;
    let c = 1.0;
    let yF = 0.08;
    let yR = 0.08;
    for (let it = 0; it < 3; it++) {
      yF = sampleImperialGroundY(0.0, zCenter - WHEEL_HALF_BASE * c, 8.0, 0.08);
      yR = sampleImperialGroundY(0.0, zCenter + WHEEL_HALF_BASE * c, 8.0, 0.08);
      s = THREE.MathUtils.clamp((yF - yR) / (2.0 * WHEEL_HALF_BASE), -0.65, 0.65);
      c = Math.sqrt(Math.max(0.01, 1.0 - s * s));
    }
    return {
      y: 0.5 * (yF + yR) + TIRE_CLEARANCE_M,
      sinPitch: s,
      cosPitch: c,
    };
  }

  const heroKeyframes = [
    { t:  0.0,  pos: [  0.0, solveExactTwoWheelPose(81.5).y,  81.5] },
    { t:  1.8,  pos: [  0.0, solveExactTwoWheelPose(68.5).y,  68.5] }, // Shot 1 (`t=1.8s`): Cresting arched Central Golden Water Bridge!
    { t:  3.6,  pos: [  0.0, solveExactTwoWheelPose(59.6).y,  59.6] }, // Touching smoothly onto flat Imperial Way courtyard!
    { t:  5.6,  pos: [  0.0, solveExactTwoWheelPose(49.8).y,  49.8] }, // Shot 2 (`t=5.6s`): Pedaling steadily on stone Imperial Way!
    { t:  7.55, pos: [  0.0, solveExactTwoWheelPose(41.2).y,  41.2] }, // Approaching foot of Cloud-Dragon marble terrace!
    { t:  9.4,  pos: [-12.5, 22.8,  16.0] },                           // Rockets ignite! Sweeping West-then-Northeast for iconic 3/4 side-profile!
    { t: 11.4,  pos: [ -3.0, 37.3,  -7.8] },                           // Shot 3 (`t=11.4s`): Soaring right over Taihedian's Golden Main Ridge (-9.0m)!
    { t: 13.4,  pos: [ +6.2, 41.6, -31.5] },                           // Gliding across the Sea of Golden Roofs & Moat
    { t: 14.8,  pos: [+11.8, 43.2, -48.5] },                           // Shot 4 (`t=14.8s`): Cresting into sunlit golden horizon cumulus!
    { t: 16.0,  pos: [+15.5, 42.8, -64.0] },                           // Seamless golden cloud match-cut to Dunhuang Crescent Moon Spring!
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.25,
    bankGain: 0.30,
    maxBankRad: 0.14,
    surfaceConstraintFn: (t, outPos) => {
      const groundLock = 1.0 - quintic01(7.55, 7.95, t);
      if (groundLock > 0.0001) {
        outPos.x = THREE.MathUtils.lerp(outPos.x, 0.0, groundLock);
        const solved = solveExactTwoWheelPose(outPos.z);
        outPos.y = THREE.MathUtils.lerp(outPos.y, solved.y, groundLock);
      }
    },
  });

  const FC_GAZE = [
    { t:  0.0, yaw: -0.32, pitch:  0.04 }, // Heroic glance toward companion camera & marble bridge ahead
    { t:  3.6, yaw: -0.36, pitch: -0.04 }, // Soulful Pixar eye contact with companion lens while pedaling toward Taihedian!
    { t:  7.4, yaw: -0.18, pitch: -0.16 }, // Excited upward gaze at Taihedian's golden roof as rockets ignite!
    { t: 11.2, yaw: -0.38, pitch:  0.06 }, // Warm Pixar eye-glint & smile toward companion camera over Taihedian's golden ridge!
    { t: 14.6, yaw: -0.28, pitch:  0.04 }, // Spotting warm golden desert clouds & Crescent Moon Spring ahead!
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const vWheelSlope = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const camGround = new THREE.Vector3();
  const lookGround = new THREE.Vector3();
  const camRoof = new THREE.Vector3();
  const lookRoof = new THREE.Vector3();

  // IMAX Dome Wide-Angle Hero Protagonist Camera (`FOV = 50°–51.5°`, `D = 2.95m–3.25m`, `0.0°` roll!):
  // Keeps Pelican + Bicycle as the unmistakable `42%–48%` star protagonist (beak & front tire pointing Screen-Right,
  // sunlit snowy plumage, blinking Pixar eye, aviator goggles & fluttering teal scarf front-and-center) while the wide
  // IMAX lens sweeps across the 5 bridges, 3-tier marble terrace, Taihedian, 132 Six Palaces roofs & Tongzihe Moat!
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);

    // Phase 1 (`0.0–7.6s`): Close IMAX low-angle 3/4 side-companion tracking (`D ≈ 2.98m`, `FOV = 50.5°`, `0.0°` roll)!
    const wG = quintic01(0.0, 7.5, tc);
    const rightOffG = THREE.MathUtils.lerp(1.88, 1.78, wG);
    const upOffG = THREE.MathUtils.lerp(0.84, 0.78, wG);
    const backOffG = THREE.MathUtils.lerp(-2.32, -2.24, wG);
    applyHorizontalOffset(tmpH, tmpHz, rightOffG, upOffG, backOffG, camGround);
    camGround.y = Math.max(sampleImperialGroundY(camGround.x, camGround.z, 8.0, 0.08) + 0.72, camGround.y);
    applyHorizontalOffset(
      tmpH,
      tmpHz,
      THREE.MathUtils.lerp(-1.25, -1.18, wG),
      THREE.MathUtils.lerp(1.36, 1.82, wG),
      8.5,
      lookGround
    );

    // Phase 2 (`7.6–16.0s`): Locked Pixar 3/4 Side-Profile IMAX Aerial Rig (`D ≈ 3.18m`, `FOV = 51.5° -> 50.0°`, `0.0°` roll)
    // matching `s5_forbidden_city_ref_board.jpg` Bottom-Left & Bottom-Right 1:1!
    // Both `camRoof` AND `lookRoof` are anchored in `applyHorizontalOffset(tmpH, tmpHz, ...)` so Pelican + full red bicycle
    // stays 100% unclipped at `x_screen ≈ 34%`, `44%–48%` of frame height across every single frame while looking North
    // across Taihedian's golden ridge, the 132 Six Palaces golden roofs, Jiaolou Watchtowers, Tongzihe Moat & Golden Clouds!
    const crestCloud = quintic01(12.6, 15.8, tc);
    const rightOffR = THREE.MathUtils.lerp(2.35, 2.25, crestCloud);
    const upOffR = THREE.MathUtils.lerp(0.80, 0.76, crestCloud);
    const backOffR = THREE.MathUtils.lerp(-2.05, -2.12, crestCloud);
    applyHorizontalOffset(tmpH, tmpHz, rightOffR, upOffR, backOffR, camRoof);
    applyHorizontalOffset(
      tmpH,
      tmpHz,
      THREE.MathUtils.lerp(-3.45, -3.25, crestCloud),
      THREE.MathUtils.lerp(-0.12, +0.18, crestCloud),
      THREE.MathUtils.lerp(6.15, 6.45, crestCloud),
      lookRoof
    );

    const b12 = quintic01(7.2, 9.6, tc);
    outPos.copy(camGround).lerp(camRoof, b12);
    outLook.copy(lookGround).lerp(lookRoof, b12);

    const fovRoof = THREE.MathUtils.lerp(51.5, 50.0, crestCloud);
    return THREE.MathUtils.lerp(50.5, fovRoof, b12);
  }, DURATION, 0.44);

  let lastWheelTelemetry = { frontClearanceCm: 0, rearClearanceCm: 0, groundRide01: 1, camRollDeg: 0, heroScreenHeightPct: 0 };
  const wFrontWorld = new THREE.Vector3();
  const wRearWorld = new THREE.Vector3();
  const wHeroTop = new THREE.Vector3();
  const wHeroBot = new THREE.Vector3();
  const camRightCheck = new THREE.Vector3();

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    cloudSys.update(tGlobal);

    if (instBoatHull && instBoatCanopy) {
      for (let i = 0; i < boatItems.length; i++) {
        const b = boatItems[i];
        const bob = Math.sin(tGlobal * 1.45 + b.phase) * 0.035;
        const roll = Math.cos(tGlobal * 1.15 + b.phase * 1.3) * 0.022;
        dummy.position.set(b.pos[0], b.pos[1] + bob, b.pos[2]);
        dummy.rotation.set(0, b.yaw, roll);
        dummy.scale.setScalar(b.scale);
        dummy.updateMatrix();
        instBoatHull.setMatrixAt(i, dummy.matrix);
        instBoatCanopy.setMatrixAt(i, dummy.matrix);
      }
      instBoatHull.instanceMatrix.needsUpdate = true;
      instBoatCanopy.instanceMatrix.needsUpdate = true;
    }

    const groundRide01 = 1.0 - quintic01(7.55, 7.95, tCycle);
    const liftoffBoost = quintic01(7.55, 8.95, tCycle);
    const cruiseSettle = quintic01(10.8, 13.8, tCycle);
    const thrust = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.16, 1.78, liftoffBoost), 0.72, cruiseSettle);
    const windStrength = THREE.MathUtils.lerp(1.06, 1.56, liftoffBoost);
    const wheelieRad = 0.115 * smoothstep01(7.56, 7.82, tCycle) * (1.0 - smoothstep01(8.15, 8.95, tCycle));

    const rawBank = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    if (groundRide01 > 0.0001) {
      const solved = solveExactTwoWheelPose(pHero.z);
      vWheelSlope.set(0.0, solved.sinPitch, -solved.cosPitch);
      vTang.lerp(vWheelSlope, groundRide01).normalize();
    }
    const bankRad = rawBank * (1.0 - groundRide01);

    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: groundRide01 > 0.3 ? 7.0 : 5.8 + liftoffBoost * 1.8,
      groundRide01,
      wheelieRad,
      nightLamp01: 0.05,
      tCycle,
      gazeSchedule: FC_GAZE,
      cycleLen: DURATION,
    });

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 92.0);

    const nearEaves01 = smoothstep01(8.2, 10.2, tCycle) * (1.0 - smoothstep01(13.2, 15.2, tCycle));
    eaveGlowLight.intensity = 3.4 * nearEaves01;
    eaveGlowLight.position.set(pHero.x, pHero.y - 1.4, pHero.z);
    goldenTileBounceLight.intensity = THREE.MathUtils.lerp(0.76, 1.38, nearEaves01);

    if (camMode === 'arch_taihedian_macro') {
      camera.fov = 34;
      camera.position.set(18.5, 16.2, 52.5);
      camera.lookAt(-0.5, 16.5, 2.0);
      camera.updateProjectionMatrix();
      return { beatText: '建筑微距 · 太和殿重檐庑殿琉璃金顶、和玺彩画与三台汉白玉云龙丹陛' };
    }
    if (camMode === 'arch_panorama_macro') {
      camera.fov = 46;
      camera.position.set(-82.0, 58.0, 114.0);
      camera.lookAt(12.0, 12.0, -24.0);
      camera.updateProjectionMatrix();
      return { beatText: '全景鸟瞰 · 紫禁城东西六宫琉璃金顶海、四角角楼与筒子河碧波游船' };
    }

    applyStabilizedCam(tCycle, camera);
    lastTCycle = tCycle;
    lastGroundRide01 = groundRide01;
    lastCameraRef = camera;
    lastRigRef = pelicanRig;

    const horizonHazeOutro = quintic01(13.6, 15.9, tCycle);
    let beatText = '第一幕 · 御道石砖地面真实骑行 · 驶过汉白玉内金水桥直奔太和殿';
    if (tCycle >= 7.6 && tCycle < 12.6) {
      beatText = '第二幕 · 丹陛台前腾空飞起 · 壮丽掠越太和殿金顶俯瞰紫禁城琉璃院落海';
    } else if (tCycle >= 12.6) {
      beatText = '第三幕 · 飞越金顶穿入北天金霞云海 · 豁然远眺大漠翡翠月牙泉';
    }
    return {
      beatText,
      fogDensityOverride: 0.0017 + horizonHazeOutro * 0.0038,
    };
  }

  let lastTCycle = 0.0;
  let lastGroundRide01 = 1.0;
  let lastCameraRef = null;
  let lastRigRef = null;
  function computeLazyTelemetry() {
    if (!lastRigRef || !lastCameraRef) return lastWheelTelemetry;
    lastRigRef.localToWorld(0.0, 0.0, +WHEEL_HALF_BASE, wFrontWorld);
    lastRigRef.localToWorld(0.0, 0.0, -WHEEL_HALF_BASE, wRearWorld);
    const surfF = sampleImperialGroundY(wFrontWorld.x, wFrontWorld.z, wFrontWorld.y + 4.0, 0.08);
    const surfR = sampleImperialGroundY(wRearWorld.x, wRearWorld.z, wRearWorld.y + 4.0, 0.08);
    lastCameraRef.updateMatrixWorld(true);
    lastRigRef.localToWorld(0.0, 0.0, 0.0, wHeroBot).project(lastCameraRef);
    lastRigRef.localToWorld(0.0, 1.24, 0.06, wHeroTop).project(lastCameraRef);
    const heroHeightPct = Math.abs(wHeroTop.y - wHeroBot.y) * 50.0;
    const camDist = lastCameraRef.position.distanceTo(pHero);
    camRightCheck.set(1, 0, 0).applyQuaternion(lastCameraRef.quaternion);
    return {
      t: Number(lastTCycle.toFixed(3)),
      heroPos: [Number(pHero.x.toFixed(3)), Number(pHero.y.toFixed(3)), Number(pHero.z.toFixed(3))],
      camDistM: Number(camDist.toFixed(2)),
      fovDeg: Number(lastCameraRef.fov.toFixed(1)),
      heroScreenHeightPct: Number(heroHeightPct.toFixed(1)),
      frontClearanceCm: Number(((wFrontWorld.y - surfF) * 100.0).toFixed(3)),
      rearClearanceCm: Number(((wRearWorld.y - surfR) * 100.0).toFixed(3)),
      groundRide01: Number(lastGroundRide01.toFixed(4)),
      camRollDeg: Number((Math.asin(THREE.MathUtils.clamp(camRightCheck.y, -1, 1)) * 180.0 / Math.PI).toFixed(4)),
    };
  }

  await applyStationHdPbrUpgrade(5, group, renderer);

  return {
    id: 5,
    slug: 'forbidden_city',
    nameZh: '北京故宫',
    titleZh: '北京紫禁城 · 飞越太和殿琉璃金顶',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.94,
    fogColor: new THREE.Color(0xf8e1ac),
    fogDensity: 0.0017,
    exposure: 1.04,
    transitionColor: '#fce09b',
    omniVideos: [omniMotes.vid],
    stageTris,
    getTelemetry: computeLazyTelemetry,
    update,
  };
}
