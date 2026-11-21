// ============================================================================
// STATION 07 (V3 UPGRADE): 重庆洪崖洞 · 千厮门大桥骑行与两江蓝调暮色
// (CHONGQING HONGYADONG 11-TIER CLIFF PALACE, QIANSIMEN BRIDGE, YUZHONG SKYLINE
//  & CURVING TWO-RIVERS BLUE-HOUR CONFLUENCE)
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
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station07_Hongyadong';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 18.0;

  // 1. Load V3 NB 2.1 Cobalt Blue-Hour Dusk Sky Panorama + Stage Layout JSON + Monumental GLB
  const [skyTex, layoutRes, hydGltf] = await Promise.all([
    new Promise((resolve, reject) => {
      texLoader.load('./assets/soarin_scene7_hongyadong/hyd_bluehour_sky_panorama.jpg', resolve, undefined, reject);
    }),
    fetch('./assets/soarin_scene7_hongyadong/hongyadong_stage_layout.json').then((r) => r.json()),
    new Promise((resolve, reject) => {
      new GLTFLoader().load('./assets/soarin_scene7_hongyadong/hongyadong_hero_stage.glb', resolve, undefined, reject);
    }),
  ]);

  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;

  // Luminous Royal Cobalt Blue-Hour Dusk Sky Dome (#0e3b75 zenith -> #4b739c misty horizon + warm amber dusk glow!)
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSkyMap: { value: skyTex },
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
      varying vec3 vWorldDir;
      varying vec2 vUv;
      void main() {
        vec3 d = normalize(vWorldDir);
        // Align panorama horizon so warm amber-peach dusk ribbon sits right above the 3D Chongqing mountain ridges!
        float uvY = clamp(0.35 + (vUv.y - 0.50) * 1.18, 0.03, 0.99);
        vec3 texCol = texture2D(uSkyMap, vec2(vUv.x, uvY)).rgb;

        float h = clamp(d.y, -0.25, 1.0);
        // Exact s7_hongyadong_ref_board.jpg royal cobalt blue-hour palette (#0e3b75 -> #245896 -> #537ba3)
        vec3 royalCobaltZenith = vec3(0.055, 0.231, 0.459); // #0e3b75
        vec3 ceruleanMidSky    = vec3(0.145, 0.365, 0.620); // #255d9e
        vec3 mistyDuskHorizon  = vec3(0.325, 0.478, 0.635); // #537aa2

        vec3 baseGrad = mix(mistyDuskHorizon, ceruleanMidSky, smoothstep(-0.02, 0.25, h));
        baseGrad = mix(baseGrad, royalCobaltZenith, smoothstep(0.22, 0.72, h));

        vec3 col = mix(texCol * 1.04, baseGrad, 0.34);
        col = max(col, vec3(0.050, 0.205, 0.420));

        // Warm amber-peach sunset afterglow ribbon above the western/upstream & river-bend mountain ridges!
        float duskBand = exp(-pow((d.y - 0.115) * 7.8, 2.0));
        vec2 horizDir = normalize(vec2(d.x, d.z) + vec2(1e-5));
        float westGlow = pow(max(0.0, dot(horizDir, normalize(vec2(-0.78, -0.62)))), 1.6);
        float bendGlow = pow(max(0.0, dot(horizDir, normalize(vec2( 0.55,  0.83)))), 2.0);
        col += vec3(0.46, 0.25, 0.10) * duskBand * (0.35 + 0.65 * max(westGlow, bendGlow * 0.85));

        // Subtle warm golden atmospheric city bounce near Hongyadong cliffside
        float cityGlow = exp(-pow((d.y - 0.04) * 5.2, 2.0)) * pow(max(0.0, dot(horizDir, normalize(vec2(-0.88, 0.15)))), 2.4);
        col += vec3(0.20, 0.11, 0.03) * cityGlow;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(680, 64, 40), skyDomeMat);
  skyDome.rotation.y = Math.PI * 0.62;
  group.add(skyDome);

  let envTexture = null;
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(48, 28, 18), skyDomeMat);
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
    addCard([-22, 10,  -4], [26, 16], 0xffbe55);
    addCard([ 22, 16, -20], [22, 14], 0x7cb8f8);
    addCard([  0, 22,  20], [22, 14], 0x4b82c8);
    addCard([  0, -18,  0], [36, 36], 0x2c4e78);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.035).texture;
    pmrem.dispose();
  }

  // 2. Blue-Hour Dusk + Golden Lantern Hero Cinematography Lighting Rig
  // Balanced cool royal-cobalt sky skylight + warm golden Hongyadong bounce so white Pelican plumage looks Pixar-luminous!
  const hemiLight = new THREE.HemisphereLight(0x8ec0ff, 0xe09848, 1.18);
  group.add(hemiLight);

  const lanternKeyDir = new THREE.Vector3(-0.74, 0.44, 0.50).normalize();
  const lanternKeyLight = new THREE.DirectionalLight(0xffcb7c, 2.85);
  lanternKeyLight.castShadow = true;
  lanternKeyLight.shadow.mapSize.set(1024, 1024);
  lanternKeyLight.shadow.camera.left = -30;
  lanternKeyLight.shadow.camera.right = 30;
  lanternKeyLight.shadow.camera.top = 30;
  lanternKeyLight.shadow.camera.bottom = -30;
  lanternKeyLight.shadow.camera.near = 2.0;
  lanternKeyLight.shadow.camera.far = 160.0;
  lanternKeyLight.shadow.bias = -0.00035;
  group.add(lanternKeyLight);
  group.add(lanternKeyLight.target);

  const duskSkyRimLight = new THREE.DirectionalLight(0x78b8ff, 1.48);
  duskSkyRimLight.position.set(78, 54, -72);
  group.add(duskSkyRimLight);

  const frontDuskFill = new THREE.DirectionalLight(0xb4d2ff, 1.05);
  frontDuskFill.position.set(42, 26, 56);
  group.add(frontDuskFill);

  const riverGoldBounce = new THREE.DirectionalLight(0xffae4c, 0.85);
  riverGoldBounce.position.set(-12, -32, -10);
  group.add(riverGoldBounce);

  const hydWarmFillPoint = new THREE.PointLight(0xff9430, 42.0, 56.0, 1.35);
  hydWarmFillPoint.position.set(-13.5, 23.0, -14.0);
  group.add(hydWarmFillPoint);

  // 3. Silky Cobalt-Sapphire Confluence River Shader Reflecting Molten-Gold Hongyadong & Twin Bridges!
  const atmoUniforms = {
    uTime: { value: 0.0 },
  };

  {
    const riverGeo = new THREE.PlaneGeometry(820, 820, 140, 140);
    riverGeo.rotateX(-Math.PI * 0.5);
    const riverMat = new THREE.ShaderMaterial({
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        uTime: atmoUniforms.uTime,
      },
      vertexShader: `
        #include <fog_pars_vertex>
        uniform float uTime;
        varying vec3 vWPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float w1 = sin(wp.x * 0.38 + uTime * 1.65) * cos(wp.z * 0.30 - uTime * 1.25) * 0.052;
          float w2 = sin(wp.z * 1.05 - uTime * 2.40 + wp.x * 0.45) * 0.022;
          wp.y += w1 + w2;
          vWPos = wp.xyz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform float uTime;
        varying vec3 vWPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float vnoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float fbm(vec2 p) {
          return 0.54 * vnoise(p) + 0.30 * vnoise(p * 2.15 + 3.7) + 0.16 * vnoise(p * 4.3 + 8.3);
        }

        // Approximate Yuzhong inner seawall X(z_gltf) so reflections hug the real curving river bend!
        float innerBankX(float zg) {
          float yb = -zg;
          float b = -13.2 - 0.032 * clamp(yb, -30.0, 48.0);
          if (yb > 48.0) b -= 0.16 * pow(yb - 48.0, 1.08);
          if (yb < -28.0) b += 0.0115 * pow(-28.0 - yb, 1.72);
          return b;
        }

        float outerBankX(float zg) {
          float yb = -zg;
          if (yb > 60.0) {
            float tjb = clamp((yb - 60.0) / 78.0, 0.0, 1.0);
            float sjb = tjb * tjb * (3.0 - 2.0 * tjb);
            return mix(118.0, 24.5, sjb);
          }
          if (yb < -20.0) return 124.0 + 0.0088 * pow(-20.0 - yb, 1.72);
          return 118.0 + 6.0 * ((60.0 - yb) / 80.0);
        }

        void main() {
          vec2 xz = vWPos.xz;

          // Silky organic multi-octave wind-rippled river wave field (ZERO periodic sine zebra stripes!)
          vec2 flow1 = vec2(xz.x * 0.36, xz.y * 1.45 - uTime * 1.25);
          vec2 flow2 = vec2(xz.x * 0.88 - uTime * 0.28, xz.y * 3.30 + uTime * 1.80);
          vec2 flow3 = vec2(xz.x * 1.95 + uTime * 0.42, xz.y * 6.40 - uTime * 2.50);
          float r1 = fbm(flow1);
          float r2 = fbm(flow2);
          float r3 = vnoise(flow3);
          float ripX = (r1 - 0.5) * 4.2 + (r2 - 0.5) * 2.2;
          float ripZ = (r1 - 0.5) * 3.2 + (r2 - 0.5) * 1.6;
          float shimmer = pow(clamp(r1 * 0.56 + r2 * 0.48 + r3 * 0.22, 0.0, 1.15), 2.1);
          float brokenBand = smoothstep(0.26, 0.76, r1 * 0.58 + r2 * 0.42 + (r3 - 0.5) * 0.18);
          float sparkle = pow(max(0.0, r3 * r2 * 1.55), 5.5);

          vec3 viewDir = normalize(cameraPosition - vWPos);
          float fresnel = pow(1.0 - clamp(viewDir.y, 0.04, 1.0), 2.15);

          // Luminous silky cobalt-sapphire & slate-teal blue-hour water base (#0b284b -> #235588 Fresnel sky reflection!)
          vec3 deepCobaltWater = vec3(0.042, 0.152, 0.292);
          vec3 skyReflWater    = vec3(0.142, 0.342, 0.542);
          vec3 col = mix(deepCobaltWater, skyReflWater, fresnel);

          // Subtle warm dusk horizon reflection sheen in mid-channel
          float duskSheen = fresnel * smoothstep(35.0, 160.0, length(xz - cameraPosition.xz)) * 0.20;
          col += vec3(0.30, 0.19, 0.09) * duskSheen * (0.65 + 0.35 * r1);

          float xIn = innerBankX(xz.y);
          float xOut = outerBankX(xz.y);
          float distFromInner = (xz.x + ripX * 1.25) - xIn;
          float distFromOuter = xOut - (xz.x + ripX * 1.25);

          // A. Hongyadong 11-Story Molten-Gold Palace & Viaduct Reflection Shimmer (z in [-68..+44])
          float hydZMask = smoothstep(48.0, 16.0, xz.y) * smoothstep(-78.0, -42.0, xz.y);
          float hydReach = smoothstep(46.0, 1.5, distFromInner) * smoothstep(-4.0, 1.5, distFromInner);
          float organicColumns = 0.55 + 0.45 * vnoise(vec2(xz.x * 0.42 + ripX * 0.35, xz.y * 0.18));
          vec3 hydGold = vec3(1.00, 0.66, 0.16) * organicColumns * (0.52 + 0.95 * shimmer);
          vec3 hydRed  = vec3(0.98, 0.20, 0.04) * pow(r2, 2.0) * (0.28 + 0.55 * shimmer);
          col += (hydGold * 1.12 + hydRed * 0.38) * hydReach * hydZMask * brokenBand;

          // Continuous Jiabin Viaduct & Curving Inner Embankment Warm Streetlight Reflection!
          float embGlow = smoothstep(20.0, 1.5, distFromInner) * smoothstep(-3.0, 1.5, distFromInner);
          col += vec3(1.00, 0.68, 0.22) * embGlow * brokenBand * 0.42;

          // B. Qiansimen Golden Warren-Truss & Shuttle-Pylon Bridge Water Reflection (z = -94.0)
          float qsmBand = exp(-pow((xz.y + 94.0 + ripZ * 2.0) / 21.0, 2.0)) * smoothstep(-58.0, -24.0, xz.x) * smoothstep(138.0, 102.0, xz.x);
          float qsmShimmer = 0.58 + 0.42 * vnoise(vec2(xz.x * 0.55 + ripX * 0.4, xz.y * 0.9));
          float pylonCol = exp(-pow((xz.x - 6.5 + ripX * 0.9) / 4.8, 2.0)) * smoothstep(18.0, -94.0, xz.y) * smoothstep(-155.0, -94.0, xz.y);
          col += vec3(1.00, 0.66, 0.16) * qsmBand * qsmShimmer * (0.42 + 0.82 * brokenBand) * 0.88;
          col += vec3(1.00, 0.82, 0.48) * pylonCol * (0.38 + 0.72 * shimmer) * 0.65;

          // C. Upstream Illuminated Bridge (z = -206.0) & Downstream Confluence Arch Bridge (z ~ +105.0) Golden Reflections!
          float upBrBand = exp(-pow((xz.y + 206.0 + ripZ * 1.8) / 18.0, 2.0)) * smoothstep(-105.0, -65.0, xz.x) * smoothstep(95.0, 55.0, xz.x);
          col += vec3(1.00, 0.68, 0.22) * upBrBand * brokenBand * 0.62;

          float zConfLine = 114.0 - clamp((xz.x - 19.0) / 177.0, 0.0, 1.0) * 18.0;
          float confBrBand = exp(-pow((xz.y - zConfLine + ripZ * 1.8) / 20.0, 2.0)) * smoothstep(12.0, 34.0, xz.x) * smoothstep(195.0, 155.0, xz.x);
          col += vec3(1.00, 0.68, 0.20) * confBrBand * (0.40 + 0.78 * brokenBand) * 0.72;

          // D. Curving Opposite Bank (Jiangbeizui & Nan'an Skyline) Organic Champagne-Gold & Sapphire Shimmer
          float oppReach = smoothstep(48.0, 3.0, distFromOuter) * smoothstep(-4.0, 3.0, distFromOuter);
          float oppTex = vnoise(vec2(xz.x * 0.22 + ripX * 0.3, xz.y * 0.22));
          col += mix(vec3(0.24, 0.70, 0.96), vec3(1.00, 0.74, 0.34), oppTex) * oppReach * brokenBand * 0.46;

          // E. Cruising Sightseeing Boat (38.5, +12.0) Warm Reflection
          vec2 bc = xz - vec2(38.5, 12.0);
          float boatGlow = exp(-pow((bc.x + ripX * 0.6) / 5.0, 2.0)) * exp(-pow(bc.y / 15.0, 2.0));
          col += vec3(1.00, 0.64, 0.18) * boatGlow * (0.45 + 0.75 * brokenBand) * 0.80;

          // F. Specular Golden Micro-Sparkles
          col += vec3(1.00, 0.86, 0.52) * sparkle * (hydReach * hydZMask * 0.55 + qsmBand * 0.45 + confBrBand * 0.40);

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }
      `,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.position.set(35.0, 0.0, -35.0);
    riverMesh.receiveShadow = true;
    group.add(riverMesh);
  }

  // 4. Configure V3 GLB Materials + Bespoke Blue-Hour Chongqing Skyscraper & Misty Mountain Shaders!
  const hydMatsConfigured = new Set();
  let stageTris = 0;

  // Realistic Fine-Scale Blue-Hour Chongqing Skyscraper Curtain-Wall Shader (matches s7_hongyadong_ref_board.jpg top-left/right!)
  const hdCurtainTex = await new Promise((resolve) => {
    texLoader.load(
      './assets/soarin_scene7_hongyadong/hd_s7_chongqing_skyscraper_night_albedo.jpg',
      (t) => {
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        resolve(t);
      },
      undefined,
      () => resolve(null)
    );
  });

  function makeSkyscraperCurtainMat(themeVal) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTheme: { value: themeVal },
        uCurtainTex: { value: hdCurtainTex },
      },
      vertexShader: `
        varying vec3 vWPos;
        varying vec3 vWNrm;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTheme;
        uniform sampler2D uCurtainTex;
        varying vec3 vWPos;
        varying vec3 vWNrm;

        float hash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        void main() {
          vec3 n = normalize(vWNrm);
          vec3 viewDir = normalize(cameraPosition - vWPos);

          float duskSide = clamp(-n.x * 0.45 - n.z * 0.35 + 0.55, 0.0, 1.0);
          float fres = pow(1.0 - abs(dot(n, viewDir)), 2.1);
          vec3 glassSheen = mix(vec3(0.088, 0.192, 0.335), vec3(0.225, 0.385, 0.565), fres);
          glassSheen += vec3(0.08, 0.05, 0.02) * duskSide * fres;

          if (abs(n.y) > 0.75) {
            float distHazeRoof = smoothstep(105.0, 290.0, length(vWPos.xz - cameraPosition.xz)) * 0.60;
            vec3 roofCol = mix(vec3(0.082, 0.175, 0.305), vec3(0.220, 0.375, 0.545), distHazeRoof);
            gl_FragColor = vec4(roofCol, 1.0);
            return;
          }

          float horizCoord = abs(n.x) > abs(n.z) ? vWPos.z : vWPos.x;
          float bldgSeed = floor((vWPos.x + 150.0) / 14.0) * 19.0 + floor((vWPos.z + 280.0) / 14.0) * 37.0;

          // Sample Ultra-HD 1536x1536 Nano Banana 2.1 photo-detailed Chongqing night curtain-wall office texture!
          vec2 uvFacade = vec2(horizCoord / 16.8 + bldgSeed * 0.137, vWPos.y / 16.8 + bldgSeed * 0.083);
          vec3 texSrgb = texture2D(uCurtainTex, uvFacade).rgb;
          vec3 texLin = pow(max(texSrgb, vec3(0.001)), vec3(1.45));
          vec3 themeTint = uTheme < 0.5 ? vec3(0.92, 1.02, 1.12) : vec3(1.12, 1.00, 0.86);
          vec3 col = texLin * themeTint * 1.12 + glassSheen * 0.24;

          // Per-suite subtle occupancy modulation so adjacent towers never look identical
          float suiteMod = hash21(vec2(floor(horizCoord / 6.5) + bldgSeed, floor(vWPos.y / 3.9) * 1.7));
          if (suiteMod < 0.28 || vWPos.y < 9.0) {
            col = mix(col, glassSheen * 0.68, 0.72);
          }

          float highGlow = smoothstep(78.0, 128.0, vWPos.y) * 0.10;
          col += (uTheme < 0.5 ? vec3(0.16, 0.52, 0.82) : vec3(0.62, 0.42, 0.16)) * highGlow;

          float camDist = length(vWPos.xz - cameraPosition.xz);
          float distHaze = smoothstep(95.0, 295.0, camDist) * 0.56;
          float valleyMist = smoothstep(38.0, 6.0, vWPos.y) * smoothstep(90.0, 220.0, camDist) * 0.28;
          float hazeAmt = clamp(distHaze + valleyMist, 0.0, 0.68);
          vec3 blueHourHaze = vec3(0.195, 0.345, 0.525);
          col = mix(col, blueHourHaze, hazeAmt);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  function makeSkyscraperCrownMat(crownColorHex) {
    const baseC = new THREE.Color(crownColorHex);
    return new THREE.ShaderMaterial({
      uniforms: {
        uCrownCol: { value: baseC },
      },
      vertexShader: `
        varying vec3 vWPos;
        varying vec3 vWNrm;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWPos = wp.xyz;
          vWNrm = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uCrownCol;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        void main() {
          vec3 n = normalize(vWNrm);
          float horizCoord = abs(n.x) > abs(n.z) ? vWPos.z : vWPos.x;
          float fx = fract(horizCoord / 1.85);
          float dfx = max(fwidth(horizCoord / 1.85), 0.03);
          float louver = 0.42 + 0.58 * smoothstep(0.18 - dfx, 0.18 + dfx, fx) * (1.0 - smoothstep(0.82 - dfx, 0.82 + dfx, fx));
          vec3 slateGlass = vec3(0.11, 0.22, 0.38);
          vec3 col = mix(slateGlass, uCrownCol, louver * 0.82);
          if (abs(n.y) > 0.75) col = slateGlass;

          float camDist = length(vWPos.xz - cameraPosition.xz);
          float hazeAmt = smoothstep(100.0, 295.0, camDist) * 0.54;
          col = mix(col, vec3(0.195, 0.345, 0.525), hazeAmt);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }

  // Layered Blue-Hour Chongqing Mountain Ridge & Valley Mist Shader (`远山青黛层峦 + 薄雾云带`)
  const mountainMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vWPos;
      varying vec3 vWNrm;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWPos = wp.xyz;
        vWNrm = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWPos;
      varying vec3 vWNrm;
      void main() {
        vec3 n = normalize(vWNrm);
        float camDist = length(vWPos.xz - cameraPosition.xz);
        float slopeLit = clamp(n.y * 0.65 - n.x * 0.25 + 0.25, 0.0, 1.0);

        // Deep blue-green Chongqing forested mountain ridges melting into cobalt-slate dusk mist!
        vec3 nearForestBlue = vec3(0.068, 0.175, 0.295);
        vec3 ridgeSlateTeal = vec3(0.125, 0.268, 0.425);
        vec3 col = mix(nearForestBlue, ridgeSlateTeal, slopeLit);

        // Soft horizontal valley mist bands hugging mid-slopes (y = 18..48m)
        float mistBand1 = exp(-pow((vWPos.y - 24.0) / 13.5, 2.0)) * 0.36;
        float mistBand2 = exp(-pow((vWPos.y - 52.0) / 15.0, 2.0)) * 0.24;
        vec3 valleyMistCol = vec3(0.355, 0.515, 0.680);
        col = mix(col, valleyMistCol, clamp(mistBand1 + mistBand2, 0.0, 0.48));

        // Aerial perspective by distance so outer ring looks further & mistier than inner ring!
        float farLayer = smoothstep(210.0, 390.0, camDist) * 0.58;
        col = mix(col, vec3(0.255, 0.415, 0.595), farLayer);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyCurtainCyanMat = makeSkyscraperCurtainMat(0.0);
  const skyCurtainGoldMat = makeSkyscraperCurtainMat(1.0);
  const skyCrownCyanMat   = makeSkyscraperCrownMat(0x7ad4ff);
  const skyCrownBlueMat   = makeSkyscraperCrownMat(0xffd280);

  hydGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    if (obj.name === 'Chongqing_Distant_MountainRidges') {
      obj.material = mountainMat;
      obj.castShadow = false;
      obj.receiveShadow = false;
      return;
    }
    if (obj.name === 'Jiangbei_Skyscrapers_Cyan') { obj.material = skyCurtainCyanMat; obj.castShadow = false; obj.receiveShadow = false; return; }
    if (obj.name === 'Jiangbei_Skyscrapers_Gold') { obj.material = skyCurtainGoldMat; obj.castShadow = false; obj.receiveShadow = false; return; }
    if (obj.name === 'Jiangbei_NeonCrowns_Cyan')  { obj.material = skyCrownCyanMat;   obj.castShadow = false; obj.receiveShadow = false; return; }
    if (obj.name === 'Jiangbei_NeonCrowns_Blue')  { obj.material = skyCrownBlueMat;   obj.castShadow = false; obj.receiveShadow = false; return; }

    const isEmissiveLight = obj.name.includes('Contour_Lights') || obj.name.includes('RedLanterns') || obj.name.includes('StayCables');
    obj.castShadow = !isEmissiveLight;
    obj.receiveShadow = !isEmissiveLight;

    const m = obj.material;
    if (m && !hydMatsConfigured.has(m.uuid)) {
      hydMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      // Calibrated ACES Filmic Blue-Hour Emissives: molten 24K golden eaves & Warren truss + glowing crimson lanterns!
      if (m.name === 'Mat_HYD_GoldContourLED') {
        m.color = new THREE.Color(0xffc244);
        m.emissive = new THREE.Color(0xff8c14);
        m.emissiveIntensity = 1.72;
      } else if (m.name === 'Mat_HYD_RedLanternGlow') {
        m.color = new THREE.Color(0xd81004);
        m.emissive = new THREE.Color(0xff1a04);
        m.emissiveIntensity = 1.48;
      } else if (m.name === 'Mat_HYD_LitWindows') {
        if (m.map && !m.emissiveMap) m.emissiveMap = m.map;
        m.emissive = new THREE.Color(0xffa42e);
        m.emissiveIntensity = 2.05;
      } else if (m.name === 'Mat_HYD_DarkTimber' || m.name === 'Mat_HYD_CarvedTrim') {
        // Warm golden lantern under-bounce on carved Bayu cedar eaves & stilts!
        m.emissive = new THREE.Color(0x522606);
        m.emissiveIntensity = 0.28;
      } else if (m.name === 'Mat_HYD_GreyTiles') {
        // Warm golden architectural floodlight kiss on upturned Bayu tiled roofs (matches ref board!)
        m.color = new THREE.Color(0xbca482);
        m.emissive = new THREE.Color(0x3e2408);
        m.emissiveIntensity = 0.38;
      } else if (m.name === 'Mat_HYD_BridgePylon') {
        m.emissive = new THREE.Color(0xffd4a2);
        m.emissiveIntensity = 0.24;
      } else if (m.name === 'Mat_HYD_BridgeTruss') {
        // Warm molten-gold steel Warren truss matching s7_hongyadong_ref_board.jpg!
        m.color = new THREE.Color(0xffbe42);
        m.emissive = new THREE.Color(0xff8e12);
        m.emissiveIntensity = 1.42;
      } else if (m.name === 'Mat_HYD_BridgeCable') {
        m.color = new THREE.Color(0xffd678);
        m.emissive = new THREE.Color(0xffa428);
        m.emissiveIntensity = 1.38;
      }
      m.needsUpdate = true;
    }
  });
  group.add(hydGltf.scene);

  // 5. Thin Volumetric Chongqing Mountain Valley Mist Ribbons (`volumetric_clouds.js` — matches ref board!)
  const valleyMistClouds = createVolumetricCloudSystem({
    clusters: [
      // Upstream mountain valley mist ribbons behind Qiansimen & Upstream Bridges
      { center: [-75, 52, -255], radius: [68, 7.5, 22], puffs: 18, scale: [26, 48] },
      { center: [ 45, 56, -268], radius: [72, 8.0, 24], puffs: 18, scale: [28, 50] },
      // Opposite eastern Nanshan / Tongluoshan mid-slope mist ribbons
      { center: [225, 48,  -65], radius: [24, 7.5, 72], puffs: 16, scale: [26, 46] },
      { center: [238, 52,   65], radius: [26, 8.0, 74], puffs: 16, scale: [28, 48] },
      // Downstream confluence river-bend misty mountain ribbons (frames Beat 3 turn!)
      { center: [ 95, 48,  218], radius: [78, 7.5, 24], puffs: 18, scale: [26, 48] },
      { center: [-25, 54,  228], radius: [64, 8.0, 22], puffs: 14, scale: [24, 46] },
    ],
    sunDir: new THREE.Vector3(-0.65, 0.22, -0.72).normalize(),
    litColor: 0xdceaf8,
    shadowColor: 0x5c80a6,
    rimColor: 0xf6c896,
    opacity: 0.32,
    seed: 7073,
  });
  group.add(valleyMistClouds.mesh);

  // 6. Animated Jiabin Road Elevated Viaduct & Bridge Car Head/Taillight Ribbons (`嘉滨路高架流光车河`)
  const rawViaductPts = (layoutRes.jiabin_viaduct_curve_gltf || [
    [-10, 5.8, -110], [-10, 5.8, -50], [-9.5, 5.8, 0], [-8.5, 5.8, 40], [10, 5.8, 85],
  ]).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const viaductSpline = new THREE.CatmullRomCurve3(rawViaductPts, false, 'catmullrom', 0.5);

  const CAR_COUNT = 64;
  // Each vehicle instance is a sleek elongated glowing light-streak ribbon (warm gold headlights + ruby-crimson taillights!)
  const carRibbonGeo = new THREE.BoxGeometry(0.46, 0.24, 3.6);
  const carHeadMat = new THREE.MeshBasicMaterial({
    color: 0xffdf8e,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const carTailMat = new THREE.MeshBasicMaterial({
    color: 0xff2c14,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const carBodyGeo = new THREE.BoxGeometry(1.48, 0.68, 3.2);
  const carBodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e3352,
    roughness: 0.30,
    metalness: 0.55,
  });

  const carBodiesInst = new THREE.InstancedMesh(carBodyGeo, carBodyMat, CAR_COUNT);
  const carHeadsInst  = new THREE.InstancedMesh(carRibbonGeo, carHeadMat, CAR_COUNT);
  const carTailsInst  = new THREE.InstancedMesh(carRibbonGeo, carTailMat, CAR_COUNT);
  for (const im of [carBodiesInst, carHeadsInst, carTailsInst]) {
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false;
    group.add(im);
  }

  const carDummy = new THREE.Object3D();
  const cPos = new THREE.Vector3();
  const cTan = new THREE.Vector3();
  const cRight = new THREE.Vector3();
  const cLook = new THREE.Vector3();
  const carSeeds = Array.from({ length: CAR_COUNT }, (_, i) => ({
    dir: i % 2 === 0 ? 1 : -1,
    u0: (i / CAR_COUNT + (i % 7) * 0.037) % 1.0,
    speed: 0.052 + (i % 5) * 0.008,
    onNorthBridge: i >= 52, // 12 cars cruising on Qiansimen Bridge's OPPOSITE north carriageway (z = -97.9, 100% clear of Pelican!)
  }));

  // 7. Subtle Distant Omni Sky-Lantern Glow (`hyd_omni_sky_lanterns.mp4`)
  const omniLanterns = createLoopingVideoTexture('./assets/soarin_scene7_hongyadong/hyd_omni_sky_lanterns.mp4');
  const omniLanternMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uVid: { value: omniLanterns.vTex },
      uOpacity: { value: 0.36 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uVid, vUv).rgb;
        float luma = max(c.r, max(c.g, c.b));
        float fx = smoothstep(0.06, 0.28, vUv.x) * smoothstep(0.94, 0.72, vUv.x);
        float fy = smoothstep(0.08, 0.28, vUv.y) * smoothstep(0.92, 0.72, vUv.y);
        float mask = smoothstep(0.14, 0.58, luma) * fx * fy * uOpacity;
        gl_FragColor = vec4(c * vec3(1.10, 0.78, 0.36) * mask, mask);
      }
    `,
  });
  const omniPlate = new THREE.Mesh(new THREE.PlaneGeometry(24, 13.5), omniLanternMat);
  omniPlate.position.set(-18.0, 62.0, -118.0);
  omniPlate.rotation.y = 0.14;
  omniPlate.renderOrder = 5;
  group.add(omniPlate);

  // Extended Warm Brass Volumetric Headlamp Mist Beam (matches bottom-left/right of s7_hongyadong_ref_board.jpg!)
  const beamLen = 5.4;
  const outerBeamGeo = new THREE.CylinderGeometry(0.055, 0.92, beamLen, 28, 1, true);
  outerBeamGeo.translate(0, -beamLen * 0.5, 0);
  outerBeamGeo.rotateX(-Math.PI * 0.5);
  const outerBeamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        vNrm = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vNrm;
      varying vec3 vViewPos;
      void main() {
        float axial = smoothstep(0.0, 0.86, vUv.y) * pow(vUv.y, 1.45) * smoothstep(1.0, 0.94, vUv.y);
        float rimSoft = pow(abs(dot(normalize(vNrm), normalize(vViewPos))), 1.65);
        float a = axial * rimSoft * 0.24;
        gl_FragColor = vec4(vec3(1.00, 0.88, 0.56) * a, a);
      }
    `,
  });
  const outerHeadlampBeam = new THREE.Mesh(outerBeamGeo, outerBeamMat);
  outerHeadlampBeam.renderOrder = 6;
  group.add(outerHeadlampBeam);

  // ============================================================================
  // 8. V3 EXACT USER CHOREOGRAPHY (`DURATION = 18.0s`, `cinema_cam_rig.js`):
  //    "穿过沙漠来到重庆，从大桥上骑行，逐渐拉到近景洪崖洞，下桥飞起，划过洪崖洞建筑群，沿江水转弯到外滩"
  //    - 0.0s–6.0s: True Roadway-Surface Riding on Qiansimen Bridge (`z = -89.3`, `< 1cm` tire contact,
  //      `groundRide01 = 1.0`, 100% clear of Shuttle Pylon & stay-cables!) + Smooth Dolly/Zoom (`45° -> 35°`)
  //      toward 11-tier Hongyadong & Yuzhong Skyline!
  //    - 6.0s–13.6s: Launch off bridge (`wheelieRad` liftoff!) & glide gracefully alongside all 11 glowing
  //      tiers of Hongyadong (`100%` clear of eaves & viaduct!).
  //    - 13.6s–18.0s: Descend closer to the cobalt-and-gold river & sweep along the curving confluence bend!
  // ============================================================================
  const sampleBridgeDeckY = createSurfaceHeightSampler(
    hydGltf.scene,
    (nm) => nm.includes('Viaduct_And_Bridge_Decks')
  );
  const BRIDGE_LANE_Z = -89.3;
  const BRIDGE_DECK_Y = sampleBridgeDeckY(24.0, BRIDGE_LANE_Z, 36.0, 25.28);
  const TIRE_LOCK_OFFSET = 0.002; // 2mm (< 1cm!) exact tire-on-asphalt contact!

  const heroKeyframes = [
    { t:  0.0, pos: [ 74.0, BRIDGE_DECK_Y + TIRE_LOCK_OFFSET, BRIDGE_LANE_Z] }, // Riding westward on Qiansimen Bridge!
    { t:  1.8, pos: [ 58.0, BRIDGE_DECK_Y + TIRE_LOCK_OFFSET, BRIDGE_LANE_Z] }, // Pedaling smoothly along riverfront lane
    { t:  3.6, pos: [ 43.0, BRIDGE_DECK_Y + TIRE_LOCK_OFFSET, BRIDGE_LANE_Z] }, // Zooming steadily toward 11-tier Hongyadong!
    { t:  5.2, pos: [ 30.5, BRIDGE_DECK_Y + TIRE_LOCK_OFFSET, BRIDGE_LANE_Z] }, // Liftoff point on Qiansimen Bridge!
    { t:  6.5, pos: [ 20.8, 28.15, -88.2] },                                    // First lift off straight along bridge heading (`稍微起飞之后`)!
    { t:  7.7, pos: [ 15.2, 26.85, -77.5] },                                    // Begin wide R~22m graceful circular arc over open river (`再转弧形过来`)!
    { t:  9.1, pos: [ 16.8, 22.30, -50.5] },                                    // Smoothly completing 90° arc into riverfront corridor
    { t: 10.6, pos: [ 23.8, 17.60, -14.0] },                                    // Hero glide over cobalt river beside 11-tier Hongyadong (`划过洪崖洞建筑群`)!
    { t: 12.6, pos: [ 26.5, 14.60,  15.5] },                                    // Gliding past southern flying eaves & red lanterns
    { t: 14.4, pos: [ 30.0, 11.60,  38.5] },                                    // Descending closer to silky cobalt-and-gold river
    { t: 16.0, pos: [ 38.5,  9.50,  56.0] },                                    // Sweeping turn along curving river bend (`沿江水转弯到外滩`)!
    { t: 18.0, pos: [ 58.0,  8.60,  74.5] },                                    // Seamless confluence bend match-cut to Shanghai Bund!
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.36,
    bankGain: 0.44,
    maxBankRad: 0.22,
    surfaceConstraintFn: (t, outPos) => {
      // Hold exact bridge-lane surface lock through t = 5.25s, then smoothly release forward along the bridge!
      const onBridge = 1.0 - quintic01(5.25, 5.88, t);
      if (onBridge > 0.0001) {
        outPos.z = THREE.MathUtils.lerp(outPos.z, BRIDGE_LANE_Z, onBridge);
        const exactDeckY = sampleBridgeDeckY(outPos.x, BRIDGE_LANE_Z, 36.0, BRIDGE_DECK_Y);
        outPos.y = THREE.MathUtils.lerp(outPos.y, exactDeckY + TIRE_LOCK_OFFSET, onBridge);
      }
    },
  });

  const HYD_GAZE = [
    { t:  0.0, yaw: -0.18, pitch:  0.03 }, // Looking ahead-left across Qiansimen Bridge toward Hongyadong!
    { t:  3.6, yaw: -0.26, pitch: -0.02 }, // Admiring 11-tier Hongyadong & Yuzhong skyline zooming closer!
    { t:  6.4, yaw: -0.14, pitch:  0.11 }, // Joyful liftoff off Qiansimen Bridge deck!
    { t: 10.2, yaw:  0.18, pitch:  0.02 }, // Expressive hero gaze during Hongyadong riverfront glide!
    { t: 13.4, yaw:  0.12, pitch: -0.02 },
    { t: 15.8, yaw: -0.18, pitch:  0.05 }, // Gazing ahead along the curving confluence river bend!
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const lampWorldPos = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const camBridge = new THREE.Vector3();
  const lookBridge = new THREE.Vector3();
  const camAir = new THREE.Vector3();
  const lookAir = new THREE.Vector3();

  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);

    // IMAX Dome Wide-Angle Hero Lens (FOV = 48°–52°, 2.85m–3.35m hero distance, 0.0° roll):
    // Keeps Pelican + Vintage Bicycle as the 40%–50% Star Protagonist in ALL 3 acts while the ~80°
    // horizontal wide-angle lens captures Qiansimen Bridge, silky river reflections & 11-tier Hongyadong!

    // Phase 1 (0.0s – 6.0s): Bridge Roadway Riding + Smooth Dolly/Zoom Toward Hongyadong (FOV: 52° -> 48°)!
    const wBr = quintic01(0.4, 5.0, tc);
    const bx = THREE.MathUtils.lerp(2.15, 1.72, wBr);
    const by = THREE.MathUtils.lerp(0.92, 0.84, wBr);
    const bz = THREE.MathUtils.lerp(2.52, 2.24, wBr);
    camBridge.set(
      tmpH.x + bx,
      tmpH.y + by,
      tmpH.z - bz
    );
    // Aim ~10° left of Pelican's center toward 11-tier Hongyadong & Yuzhong skyline!
    lookBridge.set(
      camBridge.x - THREE.MathUtils.lerp(3.05, 2.55, wBr),
      tmpH.y + THREE.MathUtils.lerp(0.68, 0.72, wBr),
      camBridge.z + THREE.MathUtils.lerp(4.85, 4.35, wBr)
    );

    // Phases 2 & 3 (5.4s – 18.0s): Smooth Liftoff Follow -> Wide Circular Arc -> 3.05m 3/4 Hero Closeup!
    const wOrbit = quintic01(6.6, 10.4, tc);
    const wTurn  = quintic01(12.2, 15.6, tc);

    const thetaLaunch  = 2.18; // Smoothly continues from bridge 3/4 rear-right companion angle during forward liftoff!
    const thetaHydHero = 0.86; // (+X, +Z) 3.05m 3/4 front-side hero closeup at t=10.6s!
    const thetaBend    = 2.72; // (+X, -Z) 3.18m 3/4 side-profile banking along the river bend at t=16.0s!

    let camTheta = THREE.MathUtils.lerp(thetaLaunch, thetaHydHero, wOrbit);
    camTheta = THREE.MathUtils.lerp(camTheta, thetaBend, wTurn);

    const camRad = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(3.20, 3.05, wOrbit),
      3.18,
      wTurn
    );
    const camUp = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(0.82, 0.54, wOrbit),
      0.72,
      wTurn
    );

    camAir.set(
      tmpH.x + Math.sin(camTheta) * camRad,
      tmpH.y + camUp,
      tmpH.z + Math.cos(camTheta) * camRad
    );

    // Smoothly rotate lookAir from forward-bridge-left (-X, +Z) during liftoff into riverfront (+Z, -X) along the arc!
    const lookLaunchX = camAir.x - 2.65;
    const lookLaunchY = tmpH.y + 0.68;
    const lookLaunchZ = camAir.z + 3.95;

    const lookHydX = camAir.x - 3.35;
    const lookHydY = tmpH.y + 0.60;
    const lookHydZ = camAir.z - 4.35;

    const lookBendX = camAir.x - 0.55;
    const lookBendY = tmpH.y + 0.56;
    const lookBendZ = camAir.z + 4.35;

    const arcLookX = THREE.MathUtils.lerp(lookLaunchX, lookHydX, wOrbit);
    const arcLookY = THREE.MathUtils.lerp(lookLaunchY, lookHydY, wOrbit);
    const arcLookZ = THREE.MathUtils.lerp(lookLaunchZ, lookHydZ, wOrbit);

    lookAir.set(
      THREE.MathUtils.lerp(arcLookX, lookBendX, wTurn),
      THREE.MathUtils.lerp(arcLookY, lookBendY, wTurn),
      THREE.MathUtils.lerp(arcLookZ, lookBendZ, wTurn)
    );

    const bBridgeToAir = quintic01(5.30, 7.60, tc);
    outPos.copy(camBridge).lerp(camAir, bBridgeToAir);
    outLook.copy(lookBridge).lerp(lookAir, bBridgeToAir);

    const fovBridgeZoom = THREE.MathUtils.lerp(52.0, 48.0, wBr);
    const fovAir = THREE.MathUtils.lerp(50.0, 50.5, wTurn);
    return THREE.MathUtils.lerp(fovBridgeZoom, fovAir, bBridgeToAir);
  }, DURATION, 0.48);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    valleyMistClouds.update(tGlobal);

    // Update 64 animated vehicles & flowing headlight/taillight ribbons along Jiabin Viaduct & Qiansimen North Deck!
    for (let i = 0; i < CAR_COUNT; i++) {
      const cs = carSeeds[i];
      if (cs.onNorthBridge) {
        const u = (cs.u0 + tGlobal * cs.speed * 1.35) % 1.0;
        const bx = cs.dir > 0 ? THREE.MathUtils.lerp(-65.0, 140.0, u) : THREE.MathUtils.lerp(140.0, -65.0, u);
        const bz = -97.9 + cs.dir * 0.95; // Strictly on opposite north carriageway!
        cPos.set(bx, BRIDGE_DECK_Y + 0.36, bz);
        cTan.set(cs.dir, 0, 0);
      } else {
        let u = (cs.u0 + tGlobal * cs.speed) % 1.0;
        if (cs.dir < 0) u = 1.0 - u;
        viaductSpline.getPointAt(THREE.MathUtils.clamp(u, 0.002, 0.998), cPos);
        viaductSpline.getTangentAt(THREE.MathUtils.clamp(u, 0.002, 0.998), cTan);
        if (cs.dir < 0) cTan.negate();
        cRight.set(-cTan.z, 0, cTan.x).normalize();
        cPos.addScaledVector(cRight, 1.35);
      }

      cLook.copy(cPos).add(cTan);
      carDummy.position.copy(cPos);
      carDummy.lookAt(cLook);
      carDummy.scale.set(1, 1, 1);
      carDummy.updateMatrix();
      carBodiesInst.setMatrixAt(i, carDummy.matrix);

      // Forward warm-gold headlight streak
      carDummy.position.copy(cPos).addScaledVector(cTan, 2.2);
      carDummy.scale.set(1.0, 0.85, 1.45);
      carDummy.updateMatrix();
      carHeadsInst.setMatrixAt(i, carDummy.matrix);

      // Trailing ruby-crimson taillight streak
      carDummy.position.copy(cPos).addScaledVector(cTan, -2.2);
      carDummy.scale.set(1.0, 0.85, 1.35);
      carDummy.updateMatrix();
      carTailsInst.setMatrixAt(i, carDummy.matrix);
    }
    carBodiesInst.instanceMatrix.needsUpdate = true;
    carHeadsInst.instanceMatrix.needsUpdate = true;
    carTailsInst.instanceMatrix.needsUpdate = true;

    // Exact Bridge-to-Air Physics & Animation State
    const onBridge01 = 1.0 - quintic01(5.22, 5.86, tCycle);
    const launchPulse = Math.exp(-Math.pow((tCycle - 5.85) / 0.58, 2.0));
    const inFlight01 = quintic01(5.25, 6.60, tCycle);

    // Sleek cruise throttle in Beat 2/3 so golden wheel-stardust wake shines like s7_hongyadong_ref_board.jpg,
    // with a crisp supersonic booster burst right at the t=6.1..7.1s bridge liftoff!
    const thrust = onBridge01 > 0.5
      ? 0.14
      : THREE.MathUtils.lerp(1.08, 1.72, launchPulse);
    const windStrength = THREE.MathUtils.lerp(1.08, 1.48, inFlight01);
    const wheelieRad = (1.0 - onBridge01) * 0.115 * launchPulse;

    const rawBank = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    const bankRad = rawBank * (1.0 - onBridge01);

    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: onBridge01 > 0.3 ? 7.2 : 5.5 + launchPulse * 1.8,
      groundRide01: onBridge01,
      wheelieRad,
      nightLamp01: 1.0,
      tCycle,
      gazeSchedule: HYD_GAZE,
      cycleLen: DURATION,
    });

    const lensLocal = pelicanRig.rigData.headlamp_lens_gltf;
    pelicanRig.localToWorld(lensLocal[0], lensLocal[1], lensLocal[2], lampWorldPos);
    outerHeadlampBeam.position.copy(lampWorldPos);
    outerHeadlampBeam.quaternion.copy(pelicanRig.root.quaternion);

    lanternKeyLight.target.position.copy(pHero);
    lanternKeyLight.position.copy(pHero).addScaledVector(lanternKeyDir, 58.0);
    hydWarmFillPoint.position.set(pHero.x - 8.5, pHero.y + 1.5, pHero.z - 2.0);

    if (camMode === 'arch_hongyadong_macro') {
      camera.fov = 38;
      camera.position.set(22.0, 23.5, 18.0);
      camera.lookAt(-22.0, 26.5, -14.0);
      camera.updateProjectionMatrix();
      return { beatText: '建筑微距 · 十一层洪崖洞金光飞檐、渝中半岛摩天楼群与嘉滨路高架流光车河' };
    }
    if (camMode === 'arch_bridge_river_macro') {
      camera.fov = 42;
      camera.position.set(16.0, 14.5, -2.0);
      camera.lookAt(2.0, 24.0, -105.0);
      camera.updateProjectionMatrix();
      return { beatText: '双桥映江微距 · 千厮门大桥、远景跨江大桥、远山薄雾与宝蓝暮色江面' };
    }

    applyStabilizedCam(tCycle, camera);

    let beatText = '第一幕 · 千厮门大桥桥面真实骑行 · 镜头推近璀璨洪崖洞与渝中摩天楼群';
    if (tCycle >= 6.0 && tCycle < 13.6) {
      beatText = '第二幕 · 下桥点火飞起 · 车头暖灯与金尘划过十一层洪崖洞吊脚楼群';
    } else if (tCycle >= 13.6) {
      beatText = '第三幕 · 贴近宝蓝鎏金两江水面平滑转弯 · 沿江岸大弧湾飞向外滩';
    }
    return { beatText };
  }

  await applyStationHdPbrUpgrade(7, group, renderer);

  return {
    id: 7,
    slug: 'hongyadong',
    nameZh: '重庆洪崖洞',
    titleZh: '重庆洪崖洞 · 千厮门骑行飞越两江夜色',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.96,
    fogColor: new THREE.Color(0x284d78),
    fogDensity: 0.00165,
    exposure: 1.06,
    transitionColor: '#1a3b68',
    omniVideos: [omniLanterns.vid],
    stageTris,
    heroTrack,
    sampleBridgeDeckY,
    update,
  };
}
