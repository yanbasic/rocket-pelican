// ============================================================================
// STATION 03 (V3 ROUND-2 PIXAR MASTERPIECE): 桂林漓江 · 暖金霞光逆光水面骑行与穿越大山
// (GUILIN LI RIVER — GOLDEN-HOUR BACKLIT VELVET KARST CONES, ELEPHANT TRUNK HILL,
//  7 CONICAL-HAT FISHERMAN RAFTS, REAL-TIME MIRROR WATER WAVES & V-PASS LIFTOFF)
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  smoothstep01,
  quintic01,
  createHeroTrajectory,
  applyHorizontalOffset,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station03_GuilinLiRiver_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 16.0;

  // Low golden-hour backlit sun ahead-right in -Z shining through the distant V-shaped Mountain Pass!
  const SUN_POS = new THREE.Vector3(24.0, 22.5, -245.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  // 1. Seamless 2048x1024 Golden-Hour Guilin Panorama Skybox (`gl_golden_sky_panorama.jpg`) — ZERO White Blowout!
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene3_guilin/gl_golden_sky_panorama.jpg', resolve, undefined, reject);
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

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        vec3 texCol = texture2D(uSkyMap, vUv).rgb;
        float h = clamp(d.y, -0.2, 1.0);

        // Crisp cerulean-azure upper sky melting into warm peach-apricot-gold sunset horizon (1:1 match to s3_guilin_ref_board.jpg!)
        vec3 ceruleanZenith = vec3(0.28, 0.53, 0.82);
        vec3 peachMidSky    = vec3(0.88, 0.68, 0.46);
        vec3 warmHorizon    = vec3(0.94, 0.70, 0.36);

        vec3 cleanGrad = mix(warmHorizon, peachMidSky, smoothstep(0.00, 0.11, h));
        cleanGrad = mix(cleanGrad, ceruleanZenith, smoothstep(0.09, 0.29, h));

        vec3 col = mix(texCol * 0.90, cleanGrad, 0.42);
        col = mix(col, warmHorizon, smoothstep(0.025, -0.025, d.y));

        vec3 sDir = normalize(uSunDir);
        float mu = max(0.0, dot(d, sDir));
        float sunDisc = smoothstep(0.9985, 0.9997, mu);
        float innerGlow = pow(mu, 32.0) * 0.48;
        float wideAmberHalo = pow(mu, 4.5) * 0.22;

        col += vec3(0.98, 0.68, 0.28) * wideAmberHalo;
        col += vec3(1.00, 0.86, 0.54) * innerGlow;
        col += vec3(1.00, 0.95, 0.80) * sunDisc * 1.15;

        // Subtle high-zenith twilight pinprick sparkles (matches upper cerulean sky of s3_guilin_ref_board.jpg!)
        if (d.y > 0.18) {
          vec2 starCell = floor(vUv * vec2(520.0, 260.0));
          float sh = hash21(starCell);
          if (sh > 0.9930) {
            vec2 f = fract(vUv * vec2(520.0, 260.0)) - 0.5;
            float sp = exp(-dot(f, f) * 28.0) * smoothstep(0.18, 0.42, d.y) * (1.0 - wideAmberHalo * 2.0);
            col += vec3(1.0, 0.97, 0.90) * max(0.0, sp) * 0.55;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 56, 36), skyDomeMat);
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
    addCard([12, 10, -24],  [22, 14], 0xffcc74);
    addCard([-20, 14, 14],  [20, 14], 0xffe2be);
    addCard([0, 26, 0],     [24, 24], 0x7caee4);
    addCard([0, -14, 0],    [38, 38], 0x165a40);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.03).texture;
    pmrem.dispose();
  }

  // 2. Golden-Hour Backlit Cinema Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0x9cc8f0, 0x225c42, 0.70);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffc66d, 3.05);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -36;
  sunLight.shadow.camera.right = 36;
  sunLight.shadow.camera.top = 36;
  sunLight.shadow.camera.bottom = -36;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 190.0;
  sunLight.shadow.bias = -0.00035;
  group.add(sunLight);
  group.add(sunLight.target);

  // Warm peach-gold side-front fill so Pelican's goggles, orange bill, teal scarf & red bike frame shine!
  const heroFrontFill = new THREE.DirectionalLight(0xffe0b8, 1.25);
  heroFrontFill.position.set(-48, 22, 42);
  group.add(heroFrontFill);

  const jadeRiverBounce = new THREE.DirectionalLight(0x34986e, 0.58);
  jadeRiverBounce.position.set(0, -30, -12);
  group.add(jadeRiverBounce);

  // 3. Load V3 Round-2 Sculptural Guilin Stage GLB + Stage Layout JSON
  const layoutRes = await fetch('./assets/soarin_scene3_guilin/guilin_stage_layout.json');
  const stageLayout = await layoutRes.json();

  const glGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene3_guilin/guilin_hero_stage.glb', resolve, undefined, reject);
  });

  const atmoUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: SUN_DIR },
  };

  const glMatsConfigured = new Set();
  let protoBambooCulmGeo = null, protoBambooCulmMat = null;
  let protoBambooLeafGeo = null, protoBambooLeafMat = null;
  let protoCanopyGeo = null, protoCanopyMat = null;
  let stageTris = 0;

  glGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.name === 'Proto_Bamboo_Culm') { protoBambooCulmGeo = obj.geometry; protoBambooCulmMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Bamboo_Leaf') { protoBambooLeafGeo = obj.geometry; protoBambooLeafMat = obj.material; obj.visible = false; return; }
    if (obj.name === 'Proto_Karst_Canopy') { protoCanopyGeo = obj.geometry; protoCanopyMat = obj.material; obj.visible = false; return; }

    obj.castShadow = true;
    obj.receiveShadow = true;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    const m = obj.material;
    if (m && !glMatsConfigured.has(m.uuid)) {
      glMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      const mName = m.name || '';
      const isBambooLeaf = mName.includes('BambooLeaf');
      if (isBambooLeaf) {
        m.side = THREE.DoubleSide;
        m.color.setRGB(0.36, 0.68, 0.20);
        m.roughness = 0.70;
        m.metalness = 0.0;
      }

      const isVelvetKarst = mName.includes('VelvetKarst');
      const isLimestone = mName.includes('KarstLimestone');
      const isCanopy = mName.includes('LushCanopy');
      const isBreeze = isBambooLeaf || mName.includes('BambooCulm') || isCanopy;

      if (isVelvetKarst || isLimestone || isBreeze || mName.includes('PebbleBank') || mName.includes('PagodaBrick')) {
        const isCulm = mName.includes('BambooCulm');
        m.customProgramCacheKey = () => 'gl_v3_r2_golden_atmo_' + mName;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.uniforms.uSunDir = atmoUniforms.uSunDir;
          shader.vertexShader = 'uniform float uTime;\nvarying vec3 vGlWorldPos;\nvarying vec3 vGlWorldNrm;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            isBreeze
              ? `#include <begin_vertex>
                 vec4 glWp0 = modelMatrix * vec4(position, 1.0);
                 #ifdef USE_INSTANCING
                   glWp0 = modelMatrix * instanceMatrix * vec4(position, 1.0);
                 #endif
                 float hWeight = clamp((glWp0.y - 0.4) / 7.5, 0.0, 1.2);
                 float amp = ${isCulm ? '0.042' : '0.075'} * hWeight;
                 transformed.x += sin(uTime * 2.0 + glWp0.z * 0.35 + glWp0.x * 0.25) * amp;
                 transformed.z += cos(uTime * 1.6 + glWp0.x * 0.40 + glWp0.y * 0.30) * amp * 0.75;`
              : `#include <begin_vertex>`
          );
          shader.vertexShader = shader.vertexShader.replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
             vec4 glWp = modelMatrix * vec4(transformed, 1.0);
             vec3 glWn = mat3(modelMatrix) * objectNormal;
             #ifdef USE_INSTANCING
               glWp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
               glWn = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
             #endif
             vGlWorldPos = glWp.xyz;
             vGlWorldNrm = normalize(glWn);`
          );

          shader.fragmentShader = 'uniform vec3 uSunDir;\nvarying vec3 vGlWorldPos;\nvarying vec3 vGlWorldNrm;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             vec3 glN = normalize(vGlWorldNrm);
             vec3 glS = normalize(uSunDir);
             vec3 glV = normalize(cameraPosition - vGlWorldPos);
             float glDist = length(vGlWorldPos - cameraPosition);
             float sunFace = max(0.0, dot(glN, glS));
             float sunGrazing = pow(max(0.0, 1.0 - abs(dot(glN, glV))), 2.4) * pow(max(0.0, dot(-glV, glS)), 1.6);

             ${isBambooLeaf ? `
               float bLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
               vec3 deepLeaf = vec3(0.035, 0.145, 0.052);
               vec3 sunlitLeaf = vec3(0.32, 0.48, 0.11);
               gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(deepLeaf, sunlitLeaf, clamp(bLum * 1.3 + sunFace * 0.35, 0.0, 1.0)), 0.68);
             ` : ''}

             ${isCanopy ? `
               // Rich dark emerald-jade forest shadows + warm sunlit golden-olive crowns (1:1 match to s3_guilin_ref_board.jpg!)
               float cLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
               vec3 shadowForest = vec3(0.028, 0.115, 0.052);
               vec3 oliveGoldCrown = vec3(0.30, 0.42, 0.10);
               vec3 canopyTarget = mix(shadowForest, oliveGoldCrown, clamp(cLum * 1.20 + sunFace * 0.46, 0.0, 1.0));
               gl_FragColor.rgb = mix(gl_FragColor.rgb, canopyTarget, 0.62);
               gl_FragColor.rgb += vec3(0.45, 0.33, 0.09) * sunGrazing * 0.38;
             ` : ''}

             ${isVelvetKarst ? `
               // Deep velvety emerald-forest mountain blanket with warm golden-olive sunlit slope rim!
               float vkLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
               vec3 shadowVelvet = vec3(0.026, 0.108, 0.050);
               vec3 litOliveVelvet = vec3(0.28, 0.39, 0.11);
               vec3 velvetCol = mix(shadowVelvet, litOliveVelvet, smoothstep(0.02, 0.62, vkLum * 0.90 + sunFace * 0.42));
               gl_FragColor.rgb = mix(gl_FragColor.rgb, velvetCol, 0.58);
               gl_FragColor.rgb += vec3(0.54, 0.38, 0.11) * (sunFace * 0.14 + sunGrazing * 0.42);
             ` : ''}

             ${isLimestone ? `
               float kLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
               vec3 softStone = mix(vec3(0.08, 0.13, 0.09), vec3(0.36, 0.38, 0.25), smoothstep(0.04, 0.78, kLum));
               gl_FragColor.rgb = mix(gl_FragColor.rgb, softStone, 0.46);
               float upMoss = smoothstep(0.30, 0.75, glN.y);
               gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.08, 0.24, 0.10), upMoss * 0.58);
               gl_FragColor.rgb += vec3(0.48, 0.34, 0.12) * sunGrazing * 0.30;
             ` : ''}

             // Calibrated Warm Golden-Olive Aerial Perspective (keeps distant cones silhouette-rich, never washed out!)
             float sunAlign = pow(max(0.0, dot(normalize(vGlWorldPos - cameraPosition), glS)), 2.0);
             float midMist = smoothstep(58.0, 165.0, glDist);
             float farMist = smoothstep(130.0, 260.0, glDist);
             float lowVapor = exp(-max(0.0, vGlWorldPos.y - 0.5) * 0.22) * smoothstep(42.0, 140.0, glDist) * 0.28;

             vec3 warmOliveMist = mix(vec3(0.20, 0.30, 0.22), vec3(0.52, 0.44, 0.24), sunAlign);
             vec3 amberSunsetHaze = mix(vec3(0.58, 0.54, 0.38), vec3(0.84, 0.64, 0.32), sunAlign);

             gl_FragColor.rgb = mix(gl_FragColor.rgb, warmOliveMist, midMist * 0.48);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, amberSunsetHaze, clamp(farMist * 0.68 + lowVapor, 0.0, 0.80));`
          );
        };
        m.needsUpdate = true;
      }
    }
  });
  group.add(glGltf.scene);

  // Scatter 365 GPU-Instanced Shoreline Phoenix-Tail Bamboo Groves & Banyan Tree Belts (`|x| ~ 18..38m`)
  const dummyInst = new THREE.Object3D();
  if (protoBambooCulmGeo && protoBambooLeafGeo && stageLayout.scatter_bamboo?.length) {
    const nB = stageLayout.scatter_bamboo.length;
    const instCulm = new THREE.InstancedMesh(protoBambooCulmGeo, protoBambooCulmMat, nB);
    const instLeaf = new THREE.InstancedMesh(protoBambooLeafGeo, protoBambooLeafMat, nB);
    instCulm.castShadow = false; instCulm.receiveShadow = false;
    instLeaf.castShadow = false; instLeaf.receiveShadow = false;
    stageLayout.scatter_bamboo.forEach((it, i) => {
      dummyInst.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummyInst.rotation.set(0, it.yaw, 0);
      dummyInst.scale.setScalar(it.scale);
      dummyInst.updateMatrix();
      instCulm.setMatrixAt(i, dummyInst.matrix);
      instLeaf.setMatrixAt(i, dummyInst.matrix);
    });
    instCulm.instanceMatrix.needsUpdate = true;
    instLeaf.instanceMatrix.needsUpdate = true;
    group.add(instCulm, instLeaf);
    const bTris = (protoBambooCulmGeo.index ? protoBambooCulmGeo.index.count / 3 : 0) +
                  (protoBambooLeafGeo.index ? protoBambooLeafGeo.index.count / 3 : 0);
    stageTris += Math.round(bTris * nB);
  }
  if (protoCanopyGeo && stageLayout.scatter_foliage?.length) {
    const nF = stageLayout.scatter_foliage.length;
    const instFol = new THREE.InstancedMesh(protoCanopyGeo, protoCanopyMat, nF);
    instFol.castShadow = false; instFol.receiveShadow = false;
    stageLayout.scatter_foliage.forEach((it, i) => {
      dummyInst.position.set(it.pos[0], it.pos[1], it.pos[2]);
      dummyInst.rotation.set(0, it.yaw, 0);
      dummyInst.scale.setScalar(it.scale);
      dummyInst.updateMatrix();
      instFol.setMatrixAt(i, dummyInst.matrix);
    });
    instFol.instanceMatrix.needsUpdate = true;
    group.add(instFol);
    const fTris = protoCanopyGeo.index ? protoCanopyGeo.index.count / 3 : 0;
    stageTris += Math.round(fTris * nF);
  }

  // Warm Amber Fisherman Lantern Glow Halos + PointLights on all 7 Rafts & Waterside Pavilion
  {
    const glowSpriteMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: atmoUniforms.uTime },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float g = pow(max(0.0, 1.0 - r), 2.8) * (0.88 + 0.12 * sin(uTime * 5.0));
          gl_FragColor = vec4(vec3(1.0, 0.66, 0.18) * g * 0.72, g);
        }
      `,
    });
    const allLanterns = [...(stageLayout.raft_lanterns_gltf || [])];
    if (stageLayout.pavilion_lantern_gltf) allLanterns.push(stageLayout.pavilion_lantern_gltf);
    allLanterns.forEach((lp, idx) => {
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), glowSpriteMat);
      halo.position.set(lp[0], lp[1], lp[2]);
      halo.renderOrder = 6;
      group.add(halo);
      if (idx < 4) {
        const pl = new THREE.PointLight(0xffa838, 1.4, 8.0, 1.6);
        pl.position.set(lp[0], lp[1], lp[2]);
        group.add(pl);
      }
    });
  }

  // ============================================================================
  // 4. REAL-TIME GLSL LI RIVER MIRROR WATER SHADER (`Y = 0.0m`, `注意水波效果`)
  //    - Deep velvety emerald-jade + molten golden-amber sky reflections
  //    - Analytical mirrored 3D Karst Cones & Elephant Trunk Water-Moon Cave arch
  //    - Razor-clear upside-down reflection of Both Bicycle Wheels & Pelican!
  //    - Glossy specular multi-ring concentric tire capillary waves + narrow lacy
  //      golden-white Kelvin V-wake foam arms (zero solid white disc covering reflections!)
  // ============================================================================
  const TRAIL_LEN = 22;
  const wakeTrailArr = Array.from({ length: TRAIL_LEN }, () => new THREE.Vector4(0, 10, 0, 0));

  const MAX_RAFTS = 7;
  const raftVecs = (stageLayout.rafts || []).slice(0, MAX_RAFTS).map(
    (r) => new THREE.Vector4(r.pos_gltf[0], r.pos_gltf[2], r.yaw || 0.0, 1.0)
  );
  while (raftVecs.length < MAX_RAFTS) raftVecs.push(new THREE.Vector4(999, 999, 0, 0));

  const MAX_LANTERNS = 8;
  const lanternVecs = [
    ...(stageLayout.raft_lanterns_gltf || []).slice(0, 7),
    stageLayout.pavilion_lantern_gltf || [21.5, 3.95, -36.0],
  ].map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  while (lanternVecs.length < MAX_LANTERNS) lanternVecs.push(new THREE.Vector3(999, 99, 999));

  const MAX_KARST_REFL = 16;
  const karstReflVecs = (stageLayout.karst_peaks || [])
    .filter((k) => Math.abs(k.pos_gltf[0]) < 50.0)
    .slice(0, MAX_KARST_REFL)
    .map((k) => new THREE.Vector4(k.pos_gltf[0], k.h, k.pos_gltf[2], k.r));
  while (karstReflVecs.length < MAX_KARST_REFL) karstReflVecs.push(new THREE.Vector4(999, 1, 999, 1));

  const eleCaveGltf = stageLayout.elephant_trunk_hill?.water_moon_cave_center_gltf || [-12.6, 2.2, -24.5];
  const eleTipGltf = stageLayout.elephant_trunk_hill?.trunk_tip_water_gltf || [-7.2, 0.0, -24.5];

  const waterUniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: atmoUniforms.uTime,
    uSunDir: { value: SUN_DIR },
    uSkyMap: { value: skyTex },
    uSkyRotY: { value: skyDome.rotation.y },
    uHeroPos: { value: new THREE.Vector3(2.35, 0.025, 25.0) },
    uHeroFwd: { value: new THREE.Vector2(0, -1) },
    uHeroSkim: { value: 1.0 },
    uWakeTrail: { value: wakeTrailArr },
    uRafts: { value: raftVecs },
    uLanterns: { value: lanternVecs },
    uKarstPeaks: { value: karstReflVecs },
    uEleCaveXZ: { value: new THREE.Vector2(eleCaveGltf[0], eleCaveGltf[2]) },
    uEleTipXZ: { value: new THREE.Vector2(eleTipGltf[0], eleTipGltf[2]) },
  };

  const waterGeo = new THREE.PlaneGeometry(1200, 1200, 196, 196);
  waterGeo.rotateX(-Math.PI * 0.5);
  const waterMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: waterUniforms,
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      uniform vec3 uHeroPos;
      uniform float uHeroSkim;
      varying vec3 vWPos;

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float swell = sin(wp.x * 0.18 + uTime * 1.25) * cos(wp.z * 0.14 - uTime * 0.95) * 0.008;
        float ringD = length(wp.xz - uHeroPos.xz);
        float wakeH = sin(ringD * 10.5 - uTime * 16.5) * exp(-ringD * 0.28) * 0.016 * uHeroSkim;
        wp.y += swell + wakeH;
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
      uniform sampler2D uSkyMap;
      uniform float uSkyRotY;
      uniform vec3 uHeroPos;
      uniform vec2 uHeroFwd;
      uniform float uHeroSkim;
      uniform vec4 uWakeTrail[${TRAIL_LEN}];
      uniform vec4 uRafts[${MAX_RAFTS}];
      uniform vec3 uLanterns[${MAX_LANTERNS}];
      uniform vec4 uKarstPeaks[${MAX_KARST_REFL}];
      uniform vec2 uEleCaveXZ;
      uniform vec2 uEleTipXZ;
      varying vec3 vWPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void riverChannel(float zGltf, out float cx, out float hw) {
        float yb = -zGltf;
        float passFade = clamp((yb - 95.0) / 40.0, 0.0, 1.0);
        cx = 1.4 * sin(yb * 0.024) * (1.0 - passFade);
        float passNarrow = clamp((yb - 115.0) / 45.0, 0.0, 1.0);
        hw = mix(26.0 + 2.5 * cos(yb * 0.028), 16.5, passNarrow);
      }

      float waveHeight(vec2 xz) {
        float t = uTime;
        float w = 0.0;
        vec2 q1 = vec2(xz.x * 0.86 - xz.y * 0.50, xz.x * 0.50 + xz.y * 0.86);
        vec2 q2 = vec2(xz.x * 0.64 + xz.y * 0.77, -xz.x * 0.77 + xz.y * 0.64);
        w += (vnoise(q1 * 0.65 + vec2(t * 0.30, -t * 0.24)) - 0.5) * 0.036;
        w += (vnoise(q2 * 1.75 - vec2(t * 0.54, t * 0.42)) - 0.5) * 0.020;
        w += (vnoise(xz * 4.20 + vec2(t * 0.88, -t * 0.70)) - 0.5) * 0.011;
        w += (vnoise(q1 * 8.60 - vec2(t * 1.35, t * 1.05)) - 0.5) * 0.006;
        return w;
      }

      vec2 dirToEquirectUV(vec3 d, float rotY) {
        float c = cos(-rotY), s = sin(-rotY);
        vec3 dr = vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
        float u = atan(dr.z, dr.x) / (2.0 * 3.14159265) + 0.5;
        float v = asin(clamp(dr.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        return vec2(u, v);
      }

      void main() {
        vec2 xz = vWPos.xz;
        float eps = 0.075;
        float h0 = waveHeight(xz);
        float hx = waveHeight(xz + vec2(eps, 0.0));
        float hz = waveHeight(xz + vec2(0.0, eps));
        vec3 nrm = normalize(vec3(h0 - hx, eps * 1.95, h0 - hz));

        float wakeFoam = 0.0;
        vec2 wakeGrad = vec2(0.0);

        float warpA = vnoise(xz * 1.15 + vec2(uTime * 0.45, -uTime * 0.35)) - 0.5;
        float warpB = vnoise(xz * 2.45 - vec2(uTime * 0.65, uTime * 0.55)) - 0.5;
        float organicWarp = warpA * 0.62 + warpB * 0.28;

        // ======================================================================
        // ORGANIC HYDRODYNAMIC BOW-WAVE + FEATHERED KELVIN V-WAKE!
        // ======================================================================
        if (uHeroSkim > 0.005 && abs(xz.x - uHeroPos.x) < 28.0 && abs(xz.y - uHeroPos.z) < 44.0) {
          vec2 fwd = normalize(uHeroFwd + vec2(1e-5));
          vec2 rgt = vec2(-fwd.y, fwd.x);
          float lat = dot(xz - uHeroPos.xz, rgt);
          float lace1 = vnoise(xz * 7.5 + vec2(0.0, uTime * 3.6));
          float lace2 = vnoise(xz * 16.5 - vec2(uTime * 2.2, -uTime * 3.0));
          float lace = lace1 * 0.58 + lace2 * 0.42;

          // 1. Tight Mach-cutoff bow-wave disturbance strictly near & aft of Front (+0.50m) & Rear (-0.52m) tires
          for (int wi = 0; wi < 2; wi++) {
            float wOff = (wi == 0) ? 0.50 : -0.52;
            vec2 tireXZ = uHeroPos.xz + fwd * wOff;
            vec2 dT = xz - tireXZ;
            float rT = length(dT) + 1e-4;
            float tireAlong = dot(dT, fwd);
            float tireLat = abs(dot(dT, rgt));

            float machEnvelope = smoothstep(0.45, -0.30, tireAlong) * exp(-rT * 1.15) * smoothstep(3.2, 0.0, rT);
            float rTWarp = rT + organicWarp * 0.32;
            float oscBow = sin(rTWarp * 15.0 - uTime * 21.0) * 0.6 + sin(rTWarp * 8.0 - uTime * 13.0) * 0.4;
            wakeGrad += (dT / rT) * (oscBow * 0.16 * machEnvelope * uHeroSkim);

            float contactLine = exp(-tireLat * tireLat * 68.0) * smoothstep(0.22, -0.05, tireAlong) * smoothstep(-1.15, -0.15, tireAlong);
            wakeFoam += contactLine * smoothstep(0.32, 0.82, lace + 0.18) * 0.54 * uHeroSkim;
          }

          // 2. Crisp Feathered Kelvin V-Wake Arms along 22-Segment Curved Spline Trail!
          float minTrailD = 999.0;
          float trailAge = 1.0;
          float signedSide = sign(lat + 1e-4);
          vec2 bestSegPerp = rgt;
          for (int i = 0; i < ${TRAIL_LEN} - 1; i++) {
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
              trailAge = (float(i) + tSeg) / float(${TRAIL_LEN} - 1);
              bestSegPerp = dSeg > 1e-3 ? (diff / dSeg) : (rgt * signedSide);
            }
          }

          if (minTrailD < 13.0) {
            float aftFade = smoothstep(0.015, 0.09, trailAge);
            float warpedD = minTrailD + organicWarp * (0.20 + trailAge * 0.42);
            float vSpread = 0.08 + trailAge * 4.90;
            float armDist = abs(warpedD - vSpread);
            float innerArmDist = abs(warpedD - vSpread * 0.54);

            float armMask = exp(-armDist * armDist * (6.0 - trailAge * 2.4)) * (1.0 - trailAge * 0.68) * aftFade;
            float innerArmMask = exp(-innerArmDist * innerArmDist * 6.8) * (1.0 - trailAge * 0.75) * aftFade;
            float centerTrack = exp(-minTrailD * minTrailD * 22.0) * (1.0 - trailAge * 0.64) * aftFade;

            float kelvinWave = sin((warpedD - vSpread) * 14.5 - uTime * 16.0);
            float innerWave  = sin((warpedD - vSpread * 0.54) * 16.5 - uTime * 18.0);
            float centerRip  = (lace - 0.5) * 0.55 * centerTrack;
            wakeGrad += bestSegPerp * ((kelvinWave * armMask * 0.26 + innerWave * innerArmMask * 0.16 + centerRip * 0.22) * uHeroSkim);

            wakeFoam += armMask * smoothstep(0.40, 0.85, lace + 0.12) * 0.44 * uHeroSkim;
            wakeFoam += innerArmMask * smoothstep(0.46, 0.88, lace + 0.08) * 0.22 * uHeroSkim;
            wakeFoam += centerTrack * smoothstep(0.42, 0.86, lace + 0.10) * 0.28 * uHeroSkim;
          }
        }

        // Peaceful bow-wake ripples & hull reflection darkening around all 7 Fisherman Bamboo Rafts!
        float raftShadow = 0.0;
        for (int ri = 0; ri < ${MAX_RAFTS}; ri++) {
          vec4 rf = uRafts[ri];
          vec2 dr = xz - rf.xy;
          if (abs(dr.x) > 9.0 || abs(dr.y) > 9.0) continue;
          float cs = cos(rf.z), sn = sin(rf.z);
          vec2 rl = vec2(dr.x * cs - dr.y * sn, dr.x * sn + dr.y * cs);
          vec2 q = abs(rl) - vec2(0.86, 3.30);
          float boxD = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
          float rRipple = sin(boxD * 10.0 - uTime * 4.0) * exp(-max(0.0, boxD) * 0.65) * step(0.0, boxD);
          wakeGrad += normalize(dr + vec2(1e-4)) * rRipple * 0.055;
          wakeFoam += smoothstep(0.18, 0.0, abs(boxD - 0.06)) * 0.18;
          float fisherBlob = exp(-dot(rl - vec2(0.0, 0.85), rl - vec2(0.0, 0.85)) * 1.5) * 0.80;
          raftShadow = max(raftShadow, max(smoothstep(0.80, -0.15, boxD), fisherBlob));
        }

        nrm = normalize(vec3(nrm.x - wakeGrad.x, nrm.y, nrm.z - wakeGrad.y));

        // --- Deep Velvety Emerald-Jade Li River Depth Absorption + Water-Moon Reflection ---
        float rcx, rhw;
        riverChannel(xz.y, rcx, rhw);
        float bankDist = rhw - abs(xz.x - rcx);
        float dTrunk = length(xz - uEleTipXZ);

        vec2 dCave = (xz - (uEleCaveXZ + vec2(0.5, 3.0))) * vec2(0.25, 0.19);
        float rCave = length(dCave);
        float waterMoonPool = exp(-rCave * rCave * 1.45);

        float depth01 = smoothstep(-2.0, 9.5, bankDist) * smoothstep(1.5, 5.0, dTrunk);
        vec3 shallowJade = vec3(0.065, 0.30, 0.20);
        vec3 midEmerald  = vec3(0.018, 0.19, 0.13);
        vec3 deepJade    = vec3(0.008, 0.105, 0.075);
        vec3 waterBody = mix(shallowJade, midEmerald, smoothstep(0.0, 0.52, depth01));
        waterBody = mix(waterBody, deepJade, smoothstep(0.45, 1.0, depth01));

        waterBody = mix(waterBody, vec3(0.40, 0.72, 0.44), waterMoonPool * 0.60);
        waterBody *= (1.0 - raftShadow * 0.62);

        // --- Fresnel Golden Sky + Exact Mirrored 3D Karst Cones ---
        vec3 viewDir = normalize(cameraPosition - vWPos);
        float NdotV = max(0.02, dot(nrm, viewDir));
        float fresnel = 0.08 + 0.90 * pow(1.0 - NdotV, 3.4);

        vec3 reflDir = normalize(reflect(-viewDir, nrm));
        reflDir.y = abs(reflDir.y) + 0.015;
        vec3 skyRefl = texture2D(uSkyMap, dirToEquirectUV(normalize(reflDir), uSkyRotY)).rgb * 0.90;

        vec3 sunD = normalize(uSunDir);
        float sunReflAlign = max(0.0, dot(normalize(vec3(reflDir.x, 0.0, reflDir.z)), normalize(vec3(sunD.x, 0.0, sunD.z))));
        vec3 goldenSkyBoost = mix(vec3(0.32, 0.52, 0.64), vec3(0.96, 0.72, 0.34), pow(sunReflAlign, 2.0));
        skyRefl = mix(skyRefl, goldenSkyBoost, 0.36);

        // Analytical 3D Karst Cone Silhouette Reflections
        float karstMask = 0.0;
        vec2 rDirXZ = normalize(reflDir.xz + vec2(1e-5));
        float tanElev = reflDir.y / max(0.04, length(reflDir.xz));
        for (int ki = 0; ki < ${MAX_KARST_REFL}; ki++) {
          vec4 kp = uKarstPeaks[ki];
          vec2 toPeak = kp.xz - xz;
          float along = dot(toPeak, rDirXZ);
          if (along <= 1.0 || along > 240.0) continue;
          float perp = abs(toPeak.x * rDirXZ.y - toPeak.y * rDirXZ.x);
          float halfW = kp.w * 0.96;
          if (perp < halfW) {
            float uLat = perp / halfW;
            float coneH = kp.y * sqrt(max(0.0, 1.0 - uLat * uLat));
            float peakTan = coneH / along;
            float hit = smoothstep(peakTan + 0.030, peakTan - 0.020, tanElev);
            karstMask = max(karstMask, hit * smoothstep(235.0, 55.0, along));
          }
        }

        float eleRefl = exp(-pow((xz.x - uEleCaveXZ.x - 1.5) * 0.11, 2.0))
                      * smoothstep(uEleCaveXZ.y + 12.0, uEleCaveXZ.y + 2.0, xz.y)
                      * smoothstep(uEleCaveXZ.y - 14.0, uEleCaveXZ.y - 2.0, xz.y)
                      * (1.0 - waterMoonPool * 0.94);

        float totalKarstRefl = clamp(max(karstMask * 0.90, eleRefl * 0.86), 0.0, 0.92);
        vec3 darkVelvetRefl = mix(vec3(0.012, 0.095, 0.062), vec3(0.048, 0.16, 0.088), clamp(tanElev * 1.6, 0.0, 1.0));
        vec3 envRefl = mix(skyRefl, darkVelvetRefl, totalKarstRefl);
        envRefl *= (1.0 - raftShadow * 0.58);

        // --- Natural Wave-Distorted Tinted Reflection of Pelican & Both Bicycle Wheels! ---
        if (uHeroPos.y < 3.8 && abs(xz.x - uHeroPos.x) < 5.8 && abs(xz.y - uHeroPos.z) < 7.5) {
          vec2 fwd = normalize(uHeroFwd + vec2(1e-5));
          vec2 rgt = vec2(-fwd.y, fwd.x);
          vec2 camRel = cameraPosition.xz - uHeroPos.xz;
          vec2 pixRel = xz - uHeroPos.xz + nrm.xz * 0.48 + vec2(warpA, warpB) * 0.08;
          float camLat = dot(camRel, rgt);
          float pixLat = dot(pixRel, rgt);
          float denom = camLat - pixLat;
          if (abs(denom) > 0.05) {
            float uRay = pixLat / denom;
            if (uRay > 0.0 && uRay < 2.6) {
              float yVirt = uRay * cameraPosition.y - uHeroPos.y;
              vec2 hitXZ = pixRel + uRay * (pixRel - camRel);
              float fCoord = dot(hitXZ, fwd);

              float dFW = length(vec2(fCoord - 0.50, yVirt - 0.33));
              float dRW = length(vec2(fCoord + 0.52, yVirt - 0.33));
              float tireRim = smoothstep(0.075, 0.018, abs(dFW - 0.31)) + smoothstep(0.075, 0.018, abs(dRW - 0.31));
              float frameBar = smoothstep(0.075, 0.020, abs(yVirt - 0.56)) * step(abs(fCoord), 0.48);
              vec2 pelEll = (vec2(fCoord + 0.05, yVirt - 0.98)) / vec2(0.42, 0.44);
              float pelBody = smoothstep(1.15, 0.65, length(pelEll));

              float atten = smoothstep(3.4, 0.25, uHeroPos.y) * 0.34;
              vec3 reflTint = envRefl;
              reflTint = mix(reflTint, vec3(0.42, 0.46, 0.34), clamp(tireRim, 0.0, 1.0) * 0.55);
              reflTint = mix(reflTint, vec3(0.36, 0.14, 0.15), clamp(frameBar, 0.0, 1.0) * 0.65);
              reflTint = mix(reflTint, vec3(0.56, 0.58, 0.50), clamp(pelBody, 0.0, 1.0) * 0.60);
              float maskTot = clamp(tireRim * 0.65 + frameBar * 0.65 + pelBody * 0.75, 0.0, 1.0) * atten;
              envRefl = mix(envRefl, reflTint, maskTot);
              waterBody *= (1.0 - maskTot * 0.28);
            }
          }
        }

        // --- Molten Golden Solar Glitter + Warm Amber Fisherman Lantern Reflections ---
        vec3 halfV = normalize(sunD + viewDir);
        float NdotH = max(0.0, dot(nrm, halfV));
        float sunSpecTight = pow(NdotH, 380.0) * 1.35;
        float sunSpecWide  = pow(NdotH, 28.0) * 0.20;
        float sparkle = pow(NdotH, 640.0) * smoothstep(0.56, 0.88, vnoise(xz * 15.5 + uTime * 2.4)) * 3.8;

        vec3 lanternRefl = vec3(0.0);
        for (int li = 0; li < ${MAX_LANTERNS}; li++) {
          vec3 lp = uLanterns[li];
          vec2 dl = xz - lp.xz;
          if (abs(dl.x) > 9.5 || abs(dl.y) > 9.5) continue;
          float dLat = abs(dl.x * viewDir.z - dl.y * viewDir.x);
          float dRad = length(dl);
          float shimmer = 0.62 + 0.38 * sin(dRad * 13.0 - uTime * 7.2 + nrm.x * 18.0);
          float lGlow = exp(-dLat * 2.4) * exp(-dRad * 0.32) * shimmer;
          lanternRefl += vec3(1.0, 0.62, 0.14) * lGlow * 0.85;
        }

        float trunkFoam = smoothstep(2.40, 1.90, dTrunk) * 0.32;

        vec3 col = mix(waterBody, envRefl, clamp(fresnel * 0.86 + 0.12, 0.0, 0.92));
        col += vec3(1.00, 0.86, 0.50) * (sunSpecWide + sunSpecTight + sparkle);
        col += lanternRefl;

        float totalFoam = clamp(wakeFoam + trunkFoam, 0.0, 0.88);
        vec3 foamShadow = vec3(0.74, 0.88, 0.80);
        vec3 foamSunlit = vec3(1.00, 0.96, 0.84);
        vec3 foamCol = mix(foamShadow, foamSunlit, clamp(totalFoam * 0.78 + 0.22, 0.0, 1.0));
        col = mix(col, foamCol, totalFoam);

        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }
    `,
  });

  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0.0, 0.0, -85.0);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // ============================================================================
  // 5. VOLUMETRIC GOLDEN MIST CLOUDS (`createVolumetricCloudSystem`)
  //    Flanking high karst shoulders & V-Pass Gate without blocking the sunset horizon!
  // ============================================================================
  const volClouds = createVolumetricCloudSystem({
    sunDir: SUN_DIR,
    litColor: 0xffe6ba,
    shadowColor: 0x8a7866,
    rimColor: 0xffc462,
    opacity: 0.36,
    seed: 30318,
    clusters: [
      { center: [-44.0, 28.0, -112.0], radius: [15, 5, 13], puffs: 14, scale: [9.0, 17.0] },
      { center: [ 44.0, 27.0, -118.0], radius: [15, 5, 13], puffs: 14, scale: [9.0, 17.0] },
      { center: [-36.0, 38.0, -150.0], radius: [16, 6, 15], puffs: 16, scale: [10.0, 20.0] },
      { center: [ 36.0, 37.0, -154.0], radius: [16, 6, 15], puffs: 16, scale: [10.0, 20.0] },
      { center: [-32.0, 44.0, -184.0], radius: [18, 7, 15], puffs: 16, scale: [11.0, 21.0] },
      { center: [ 32.0, 43.0, -186.0], radius: [18, 7, 15], puffs: 16, scale: [11.0, 21.0] },
      // High golden cloud sea above the pass exit (`y = 44..52m`) toward Tibet!
      { center: [-18.0, 46.0, -214.0], radius: [20, 6, 14], puffs: 16, scale: [12.0, 22.0] },
      { center: [ 18.0, 45.0, -218.0], radius: [20, 6, 14], puffs: 16, scale: [12.0, 22.0] },
    ],
  });
  group.add(volClouds.mesh);

  const omniMist = createLoopingVideoTexture('./assets/soarin_scene3_guilin/gl_omni_river_mist.mp4');
  const omniMistMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uVid: { value: omniMist.vTex },
      uTint: { value: new THREE.Color(0xffdfa2) },
      uOpacity: { value: 0.095 },
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
        float fx = smoothstep(0.06, 0.30, vUv.x) * smoothstep(0.94, 0.70, vUv.x);
        float fy = smoothstep(0.08, 0.30, vUv.y) * smoothstep(0.92, 0.70, vUv.y);
        float w = smoothstep(0.04, 0.54, luma) * fx * fy * uOpacity;
        gl_FragColor = vec4(c * uTint * w, w);
      }
    `,
  });

  for (const cfg of [
    { pos: [-18.0,  2.8, -32.0], scale: [24,  7], rotY:  0.14 },
    { pos: [ 20.0,  3.2, -40.0], scale: [26,  8], rotY: -0.18 },
    { pos: [-16.0, 12.0,-132.0], scale: [38, 12], rotY: -0.08 },
    { pos: [ 16.0, 14.0,-158.0], scale: [40, 13], rotY:  0.06 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniMistMat);
    m.position.set(...cfg.pos);
    m.rotation.y = cfg.rotY;
    m.renderOrder = 4;
    group.add(m);
  }

  // Subtle Warm Golden Crepuscular God-Rays Past the Right-Bank Karst Peaks
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
          float beam = pow(max(0.0, across), 2.6);
          float along = smoothstep(0.0, 0.24, vUv.y) * smoothstep(1.0, 0.20, vUv.y);
          float shimmer = 0.88 + 0.12 * sin(uTime * 1.2 + vUv.x * 7.5);
          float a = beam * along * shimmer * 0.048;
          gl_FragColor = vec4(vec3(1.00, 0.82, 0.42) * a, a);
        }
      `,
    });
    for (const [tx, ty, tz, w, len] of [
      [-12.6,  2.5, -24.5, 12, 165],
      [ 16.0,  8.0, -58.0, 22, 185],
      [ 22.0, 14.0, -96.0, 24, 195],
    ]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), rayMat);
      const targetV = new THREE.Vector3(tx, ty, tz);
      m.position.copy(targetV.clone().lerp(SUN_POS, 0.44));
      m.lookAt(SUN_POS);
      m.rotateX(Math.PI * 0.5);
      group.add(m);
    }
  }

  // ============================================================================
  // 6. OMNI ROOSTER-TAIL TIRE WATER SPRAY (`gl_omni_water_spray.mp4`)
  //    + 240 SPARKLING GOLDEN-WHITE WATER DROPLETS (`注意水波效果`)
  // ============================================================================
  const omniSpray = createLoopingVideoTexture('./assets/soarin_scene3_guilin/gl_omni_water_spray.mp4');
  const sprayUniforms = {
    uVid: { value: omniSpray.vTex },
    uSkimGain: { value: 1.0 },
    uTime: atmoUniforms.uTime,
  };

  const omniSprayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: sprayUniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform float uSkimGain;
      varying vec2 vUv;
      void main() {
        if (uSkimGain <= 0.005) discard;
        vec3 vc = texture2D(uVid, vUv).rgb;
        float luma = dot(vc, vec3(0.299, 0.587, 0.114));
        float fx = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.70, vUv.x);
        float fy = smoothstep(0.0, 0.08, vUv.y) * smoothstep(0.96, 0.66, vUv.y);
        float mask = smoothstep(0.12, 0.62, luma) * fx * fy * uSkimGain * 0.24;
        vec3 sunlitSpray = mix(vec3(0.98, 0.88, 0.62), vec3(1.00, 0.99, 0.94), clamp(luma * 1.2, 0.0, 1.0));
        gl_FragColor = vec4(sunlitSpray * mask, clamp(mask, 0.0, 1.0));
      }
    `,
  });

  const waterSkimGroup = new THREE.Group();
  waterSkimGroup.name = 'TireWaterSkimSprayGroup_V3';
  group.add(waterSkimGroup);

  for (const [zContact, len, h, spreadDeg] of [
    [+0.44, 0.95, 0.34,  16.0],
    [+0.44, 0.95, 0.34, -16.0],
    [-0.58, 1.35, 0.44,  18.0],
    [-0.58, 1.35, 0.44, -18.0],
  ]) {
    const pGeo = new THREE.PlaneGeometry(len, h);
    pGeo.translate(len * 0.48, h * 0.42, 0.0);
    // +Math.PI/2 rotates +X into -Z (TRAILING BACKWARD behind each wheel!)
    pGeo.rotateY(Math.PI * 0.5 + THREE.MathUtils.degToRad(spreadDeg));
    const mesh = new THREE.Mesh(pGeo, omniSprayMat);
    mesh.position.set(0.0, -0.02, zContact);
    mesh.renderOrder = 7;
    waterSkimGroup.add(mesh);
  }

  const DROP_COUNT = 220;
  const dropGeo = new THREE.SphereGeometry(0.0052, 6, 5);
  dropGeo.scale(0.85, 0.85, 2.2);
  const dropMat = new THREE.MeshBasicMaterial({
    color: 0xfff5dc,
    transparent: true,
    opacity: 0.64,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, DROP_COUNT);
  dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dropMesh.renderOrder = 8;
  waterSkimGroup.add(dropMesh);

  let dSeed = 30319;
  const dRand = () => { dSeed = (dSeed * 16807) % 2147483647; return (dSeed - 1) / 2147483646; };
  const dropState = Array.from({ length: DROP_COUNT }, (_, i) => {
    const isRear = i % 5 >= 2;
    const sideSign = i % 2 === 0 ? 1.0 : -1.0;
    const latSpeed = sideSign * (0.25 + Math.pow(dRand(), 1.2) * 0.98);
    const upSpeed = 1.00 + dRand() * 1.55;
    const backSpeed = 2.2 + dRand() * 2.7;
    return {
      z0: isRear ? -0.56 : +0.46,
      phase: dRand(),
      rate: 1.45 + dRand() * 1.25,
      vx: latSpeed,
      vy: upSpeed,
      vz: -backSpeed,
      size: 0.65 + dRand() * 0.92,
    };
  });

  // ============================================================================
  // 7. EXACT USER CHOREOGRAPHY (`DURATION = 16.0s`, `cinema_cam_rig.js`)
  //    - 100% Zero Mountain Clipping (`Pelican x in [+1.0, +3.0]`, `Cam x in [-2.0, +5.5]`)
  //    - 0.0s - 10.6s: Pure Water-Surface Riding (`Y = 0.025m`, `groundRide01 = 1.0`)
  //    - 10.6s - 16.0s: Liftoff & Soaring Through the Colossal V-Shaped Mountain Pass
  //      (`y = 0.03 -> 36m`, `z = -48 -> -186`, between towering ±38m karst giants!)
  // ============================================================================
  const heroKeyframes = [
    { t:  0.0, pos: [2.35,  0.025,   25.0] },
    { t:  2.6, pos: [2.45,  0.025,    8.0] },
    { t:  5.5, pos: [2.15,  0.025,  -11.5] },
    { t:  8.4, pos: [1.80,  0.025,  -31.5] },
    { t: 10.6, pos: [2.05,  0.025,  -48.0] },
    { t: 12.2, pos: [1.75, 11.200,  -89.0] },
    { t: 14.0, pos: [1.45, 24.800, -140.0] },
    { t: 16.0, pos: [1.35, 36.000, -186.0] },
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.26,
    bankGain: 0.38,
    maxBankRad: 0.18,
    surfaceConstraintFn: (t, outPos) => {
      outPos.x = THREE.MathUtils.clamp(outPos.x, 1.05, 2.95);
      const waterRide = 1.0 - quintic01(10.45, 11.05, t);
      if (waterRide > 0.001) {
        outPos.y = THREE.MathUtils.lerp(outPos.y, 0.025, waterRide);
      }
    },
  });

  const GL_GAZE = [
    { t:  0.0, yaw:  0.24, pitch:  0.04 }, // Expressive side-front gaze toward companion camera & river ripples!
    { t:  3.0, yaw:  0.26, pitch:  0.02 }, // Admiring Fisherman Rafts & Elephant Trunk Hill on the left!
    { t:  6.4, yaw:  0.18, pitch:  0.04 }, // Glancing toward Water-Moon Cave & Puxian Pagoda!
    { t:  8.8, yaw: -0.14, pitch:  0.12 }, // Looking back-down at the wide lacy golden-white Kelvin V-wake!
    { t: 10.8, yaw:  0.02, pitch: -0.18 }, // Lifting gaze proudly toward the colossal V-shaped Mountain Pass ahead!
    { t: 14.2, yaw: -0.03, pitch: -0.10 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const trailSampleP = new THREE.Vector3();
  const trailSampleT = new THREE.Vector3();
  const dummyDrop = new THREE.Object3D();
  const dropLook = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const camBeatA = new THREE.Vector3();
  const lookBeatA = new THREE.Vector3();
  const camBeatB = new THREE.Vector3();
  const lookBeatB = new THREE.Vector3();
  const camClimb = new THREE.Vector3();
  const lookClimb = new THREE.Vector3();

  // IMAX Wide-Angle Hero Camera Director (`FOV = 49° – 52°`, `D = 2.75m – 3.40m`, `0.0°` roll,
  // strictly clamped to `x in [-1.5, +5.0]`, keeping Pelican + reflection at `38% – 52%` hero scale!)
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);

    // Beat A (0.0s – 2.6s, covers Shot 1 t=1.8s): Close 3/4 side-profile companion (`D ≈ 2.80m`, `FOV = 49.5°`)!
    // Matches `s3_guilin_ref_board.jpg` bottom panels: Pelican faces screen-left at ~50% hero height with crisp
    // upside-down wheel reflections below, concentric ripples & golden stardust wake trailing to screen-right,
    // and fisherman rafts + Waterside Pavilion + velvety karst cones + golden sunset glow behind!
    applyHorizontalOffset(tmpH, tmpHz, -2.42, 0.76, -1.15, camBeatA);
    camBeatA.x = THREE.MathUtils.clamp(camBeatA.x, -1.45, 4.85);
    applyHorizontalOffset(tmpH, tmpHz, 0.38, 0.56, 0.95, lookBeatA);

    // Beat B (4.2s – 10.6s, covers Shot 2 t=5.5s & Shot 3 t=8.8s): Close IMAX 3/4 companion (`D ≈ 2.92m`, `FOV = 50.5°–51°`)!
    // Keeps Pelican + upside-down water reflection at ~46%–50% hero height while the wide 51° lens frames
    // Elephant Trunk Hill (Water-Moon Cave + Puxian Pagoda), Conical-Hat Fisherman Rafts, multi-ring ripples,
    // lacy Kelvin V-wake, and the colossal V-Pass Mountain Gate ahead!
    const wB = quintic01(5.2, 8.8, tc);
    const rightB = THREE.MathUtils.lerp(1.38, 1.65, wB);
    const upB    = THREE.MathUtils.lerp(0.82, 0.86, wB);
    const backB  = THREE.MathUtils.lerp(-2.42, -2.25, wB);
    applyHorizontalOffset(tmpH, tmpHz, rightB, upB, backB, camBeatB);
    camBeatB.x = THREE.MathUtils.clamp(camBeatB.x, -1.45, 4.85);

    const lookRightB = THREE.MathUtils.lerp(-0.98, -0.28, wB);
    const lookUpB    = THREE.MathUtils.lerp(0.62,  0.58, wB);
    const lookAheadB = THREE.MathUtils.lerp(1.85,  2.15, wB);
    applyHorizontalOffset(tmpH, tmpHz, lookRightB, lookUpB, lookAheadB, lookBeatB);

    const blendAB = quintic01(2.2, 4.6, tc);
    outPos.copy(camBeatA).lerp(camBeatB, blendAB);
    outLook.copy(lookBeatA).lerp(lookBeatB, blendAB);

    // Beat C (10.6s – 16.0s, covers Shot 4 t=13.8s): Close IMAX Aerial Pursuit (`D ≈ 3.35m`, `FOV = 52.0°`)!
    // Keeps climbing Pelican at bold ~38%–40% hero protagonist scale soaring right between the towering
    // ±38m emerald V-Pass karst giants toward the golden sun & volumetric mist clouds!
    const wClimb = quintic01(10.6, 15.8, tc);
    applyHorizontalOffset(
      tmpH,
      tmpHz,
      THREE.MathUtils.lerp(1.55, 1.40, wClimb),
      THREE.MathUtils.lerp(0.80, 0.66, wClimb),
      THREE.MathUtils.lerp(-2.65, -2.98, wClimb),
      camClimb
    );
    camClimb.x = THREE.MathUtils.clamp(camClimb.x, -1.45, 4.85);
    applyHorizontalOffset(tmpH, tmpHz, -0.22, 0.66 + wClimb * 0.18, 2.55, lookClimb);

    const blendClimb = quintic01(10.3, 12.2, tc);
    outPos.lerp(camClimb, blendClimb);
    outLook.lerp(lookClimb, blendClimb);

    // Strict central river corridor & water-clearance guardrails (`x in [-1.5, +5.0]`, `y >= 0.74m`)
    outPos.x = THREE.MathUtils.clamp(outPos.x, -1.45, 4.90);
    outPos.y = Math.max(0.74, outPos.y);

    const fovWater = THREE.MathUtils.lerp(49.5, THREE.MathUtils.lerp(50.5, 51.0, wB), blendAB);
    return THREE.MathUtils.lerp(fovWater, 52.0, blendClimb);
  }, DURATION, 0.38);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    volClouds.update(tGlobal);

    const waterRide01 = 1.0 - quintic01(10.45, 11.05, tCycle);
    const liftoffBoost = quintic01(10.50, 11.75, tCycle);
    const thrust = THREE.MathUtils.lerp(0.16, 1.92, liftoffBoost);
    const windStrength = THREE.MathUtils.lerp(1.12, 1.65, liftoffBoost);
    const wheelieRad = 0.145 * Math.exp(-Math.pow((tCycle - 10.92) / 0.54, 2.0));

    const rawBank = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    const bankRad = rawBank * (1.0 - waterRide01 * 0.92);

    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: waterRide01 > 0.3 ? 6.8 : 5.8 + liftoffBoost * 2.2,
      groundRide01: waterRide01,
      wheelieRad,
      nightLamp01: 0.52, // Warm glowing brass headlamp matching s3_guilin_ref_board.jpg!
      tCycle,
      gazeSchedule: GL_GAZE,
      cycleLen: DURATION,
    });

    const heroSkim01 = smoothstep01(1.35, 0.08, pHero.y);
    waterUniforms.uHeroPos.value.copy(pHero);
    waterUniforms.uHeroFwd.value.set(vTang.x, vTang.z).normalize();
    waterUniforms.uHeroSkim.value = heroSkim01;

    for (let i = 0; i < TRAIL_LEN; i++) {
      const tHist = tCycle - i * 0.16;
      if (tHist < 0.0) {
        wakeTrailArr[i].set(pHero.x - 0.04 * i, 0.025, pHero.z + i * 1.05, 1.0);
      } else {
        heroTrack.evaluate(tHist, trailSampleP, trailSampleT);
        const wContact = smoothstep01(1.35, 0.08, trailSampleP.y);
        wakeTrailArr[i].set(trailSampleP.x, trailSampleP.y, trailSampleP.z, wContact);
      }
    }

    const sprayGain = smoothstep01(0.62, 0.06, pHero.y);
    sprayUniforms.uSkimGain.value = sprayGain;
    waterSkimGroup.visible = sprayGain > 0.008;
    if (waterSkimGroup.visible) {
      waterSkimGroup.position.set(pHero.x, 0.012, pHero.z);
      waterSkimGroup.rotation.set(0.0, Math.atan2(vTang.x, vTang.z), 0.0);

      dropMat.opacity = 0.84 * sprayGain;
      const gravity = 5.5;
      for (let i = 0; i < DROP_COUNT; i++) {
        const dp = dropState[i];
        const s = (dp.phase + tGlobal * dp.rate) % 1.0;
        const age = s * 0.58;
        const px = dp.vx * age;
        const py = Math.max(-0.02, dp.vy * age - 0.5 * gravity * age * age);
        const pz = dp.z0 + dp.vz * age;

        dummyDrop.position.set(px, py, pz);
        dropLook.set(px + dp.vx * 0.15, py + (dp.vy - gravity * age) * 0.15, pz + dp.vz * 0.15);
        dummyDrop.lookAt(dropLook);
        const sc = dp.size * Math.sin(Math.PI * s) * sprayGain;
        dummyDrop.scale.setScalar(Math.max(0.001, sc));
        dummyDrop.updateMatrix();
        dropMesh.setMatrixAt(i, dummyDrop.matrix);
      }
      dropMesh.instanceMatrix.needsUpdate = true;
    }

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 76.0);

    if (camMode === 'landmark_elephant_hill') {
      camera.fov = 42;
      camera.position.set(1.8, 4.5, 0.5);
      camera.lookAt(-13.8, 8.2, -24.5);
      camera.updateProjectionMatrix();
      return { beatText: '地标微距 · 暖金霞光下的桂林象鼻山、水月洞碧潭倒影与普贤红砖宝塔' };
    }
    if (camMode === 'landmark_raft_waterside') {
      camera.fov = 38;
      camera.position.set(0.2, 1.75, 13.5);
      camera.lookAt(-5.2, 1.25, 4.5);
      camera.updateProjectionMatrix();
      return { beatText: '人文微距 · 漓江斗笠渔翁撑篙翘头竹筏、鱼鹰与暖金渔火水波' };
    }

    applyStabilizedCam(tCycle, camera);

    const passMistOutro = quintic01(14.3, 15.95, tCycle);
    let beatText = '第一幕 · 暖金霞光逆光踏江骑行 · 双轮激起层层同心水波与鎏金白浪尾迹';
    if (tCycle >= 4.2 && tCycle < 10.6) {
      beatText = '第二幕 · 漓江镜面航道平稳伴骑 · 掠过斗笠渔翁竹筏与象鼻山水月洞倒影';
    } else if (tCycle >= 10.6) {
      beatText = '第三幕 · 火箭增推腾空起飞 · 穿过巍峨青翠喀斯特大山垭口飞向布达拉宫';
    }
    return { beatText, fogDensityOverride: 0.0011 + passMistOutro * 0.0032 };
  }

  await applyStationHdPbrUpgrade(3, group, renderer);

  return {
    id: 3,
    slug: 'guilin',
    nameZh: '桂林漓江',
    titleZh: '桂林漓江 · 车轮掠波激起水花',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.88,
    fogColor: new THREE.Color(0xedbf76),
    fogDensity: 0.0011,
    exposure: 0.98,
    transitionColor: '#f8e4bc',
    omniVideos: [omniSpray.vid, omniMist.vid],
    stageTris,
    update,
  };
}
