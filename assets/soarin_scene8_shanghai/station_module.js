// ============================================================================
// STATION 08 (GRAND FINALE · V3 MASTER UPGRADE): 上海陆家嘴外滩 · 漫天烟花振铃终章
// (SHANGHAI HORSESHOE HUANGPU RIVER BEND, THE BUND, 71 LUJIAZUI/PUXI SKYSCRAPERS &
//  FULL-SKY 3D CHRYSANTHEMUM FIREWORKS + VOLUMETRIC CLOUDS GRAND FINALE)
// ============================================================================
import * as THREE from 'three';
import { applyStationHdPbrUpgrade } from '../soarin_shared/hd_pbr_upgrader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  smoothstep01,
  quintic01,
  createHeroTrajectory,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station08_ShanghaiFinale_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 21.0;

  // --------------------------------------------------------------------------
  // 1. V3 STARRY ROYAL-INDIGO SHANGHAI NIGHT SKYBOX + PMREM ENVIRONMENT
  // --------------------------------------------------------------------------
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene8_shanghai/sh_v3_night_panorama.jpg', resolve, undefined, reject);
  });
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;

  const atmoUniforms = {
    uTime: { value: 0.0 },
    uCycleTime: { value: 0.0 },
    uFinaleBoost: { value: 0.0 },
  };

  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSkyMap: { value: skyTex },
      uTime: atmoUniforms.uTime,
      uFinaleBoost: atmoUniforms.uFinaleBoost,
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
      uniform float uTime;
      uniform float uFinaleBoost;
      varying vec3 vWorldDir;
      varying vec2 vUv;

      float starHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec3 d = normalize(vWorldDir);
        vec3 texCol = texture2D(uSkyMap, vUv).rgb;
        float h = clamp(d.y, -0.15, 1.0);

        // Deep velvety midnight-indigo & royal-sapphire sky matching s8_shanghai_ref_board.jpg
        vec3 zenithNight  = vec3(0.006, 0.012, 0.040);
        vec3 midIndigo    = vec3(0.020, 0.038, 0.105);
        vec3 horizonGlow  = mix(vec3(0.16, 0.10, 0.07), vec3(0.09, 0.07, 0.18), smoothstep(-0.35, 0.35, d.x));

        vec3 cleanSky = mix(horizonGlow, midIndigo, smoothstep(-0.02, 0.17, h));
        cleanSky = mix(cleanSky, zenithNight, smoothstep(0.13, 0.55, h));

        vec3 col = mix(cleanSky, texCol * 0.48, 0.40 * smoothstep(0.75, 0.02, h));

        // Crisp pinpoint diamond starfield across the upper night dome
        vec2 starGrid = vUv * vec2(560.0, 280.0);
        vec2 cell = floor(starGrid);
        vec2 f = fract(starGrid) - 0.5;
        float rnd = starHash(cell);
        if (rnd > 0.985 && h > 0.06) {
          vec2 jitter = vec2(fract(rnd * 31.7) - 0.5, fract(rnd * 73.1) - 0.5) * 0.55;
          float dist = length(f - jitter);
          float twinkle = 0.74 + 0.26 * sin(uTime * 2.8 + rnd * 90.0);
          float star = exp(-dist * dist * 44.0) * smoothstep(0.06, 0.25, h) * twinkle;
          col += mix(vec3(0.78, 0.88, 1.0), vec3(1.0, 0.92, 0.76), fract(rnd * 17.3)) * star * 0.90;
        }

        float horizonBand = exp(-pow(max(0.0, h) * 5.5, 1.55));
        float bundSide = smoothstep(0.15, -0.65, d.x);
        float pudongSide = smoothstep(-0.15, 0.65, d.x);
        col += vec3(0.18, 0.10, 0.03) * horizonBand * bundSide * 0.52;
        col += vec3(0.12, 0.04, 0.13) * horizonBand * pudongSide * 0.42;
        col += vec3(0.03, 0.10, 0.20) * horizonBand * pudongSide * 0.44;
        col += vec3(0.08, 0.05, 0.02) * uFinaleBoost * smoothstep(0.52, 0.0, h);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(720, 56, 36), skyDomeMat);
  group.add(skyDome);

  let envTexture = null;
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(42, 28, 18), skyDomeMat);
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
    addCard([-22,  8, -10], [22, 14], 0xffc864);
    addCard([ 22, 12, -12], [22, 16], 0xff3c7e);
    addCard([ 20, 18, -22], [18, 14], 0x4ad8ff);
    addCard([  0, 26, -14], [20, 14], 0xffe296);
    addCard([  0, -16,  0], [34, 34], 0x101c3a);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.035).texture;
    pmrem.dispose();
  }

  // --------------------------------------------------------------------------
  // 2. CINEMATIC NIGHT LIGHTING + DYNAMIC FIREWORK HERO LIGHTS
  // --------------------------------------------------------------------------
  const hemiLight = new THREE.HemisphereLight(0x6e8eff, 0xdc9648, 0.78);
  group.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe0a2, 2.25);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -32;
  keyLight.shadow.camera.right = 32;
  keyLight.shadow.camera.top = 32;
  keyLight.shadow.camera.bottom = -32;
  keyLight.shadow.camera.near = 2.0;
  keyLight.shadow.camera.far = 175.0;
  keyLight.shadow.bias = -0.00035;
  group.add(keyLight);
  group.add(keyLight.target);

  const pudongRimLight = new THREE.DirectionalLight(0xff529a, 1.20);
  pudongRimLight.position.set(88, 54, -48);
  group.add(pudongRimLight);

  const cyanSkyFill = new THREE.DirectionalLight(0x52dcff, 0.90);
  cyanSkyFill.position.set(68, 82, -88);
  group.add(cyanSkyFill);

  const bundWarmFill = new THREE.DirectionalLight(0xffb654, 1.15);
  bundWarmFill.position.set(-75, 30, -35);
  group.add(bundWarmFill);

  const fwHeroLightGold = new THREE.PointLight(0xffd468, 3.5, 58.0, 1.35);
  const fwHeroLightCrimson = new THREE.PointLight(0xff3c6e, 2.7, 54.0, 1.35);
  const fwHeroLightCyan = new THREE.PointLight(0x5ce4ff, 2.3, 54.0, 1.35);
  group.add(fwHeroLightGold, fwHeroLightCrimson, fwHeroLightCyan);

  // --------------------------------------------------------------------------
  // 3. LOAD V3 SHANGHAI ARCHITECTURAL STAGE GLB & CALIBRATE ACES NIGHT EMISSIVES
  // --------------------------------------------------------------------------
  const stageLayout = await fetch('./assets/soarin_scene8_shanghai/shanghai_stage_layout.json').then((r) => r.json());

  const shGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene8_shanghai/shanghai_hero_stage.glb', resolve, undefined, reject);
  });

  const configuredMats = new Set();
  let stageTris = 0;

  shGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;

    const m = obj.material;
    if (m && !configuredMats.has(m.uuid)) {
      configuredMats.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      const nm = m.name || '';
      if (nm.includes('Glow_PearlSpheres')) {
        m.color = new THREE.Color(0x58062c);
        m.emissive = new THREE.Color(0xff1e88);
        m.emissiveIntensity = 1.98;
        m.roughness = 0.18;
        m.metalness = 0.25;
        m.customProgramCacheKey = () => 'sh_v3_pearl_jewel_glass';
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.vertexShader = 'varying vec3 vJewelPos;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vJewelPos = position;`
          );
          shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vJewelPos;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             vec3 pViewDir = normalize(vViewPosition);
             float ndv = clamp(abs(dot(normalize(normal), pViewDir)), 0.0, 1.0);
             vec3 jewelRim = mix(vec3(0.48, 0.05, 0.38), vec3(1.24, 0.18, 0.72), pow(ndv, 0.65));
             float ledSparkle = 0.92 + 0.12 * sin(uTime * 3.8 + vJewelPos.x * 3.0 + vJewelPos.y * 3.0 + vJewelPos.z * 3.0);
             totalEmissiveRadiance *= jewelRim * ledSparkle;`
          );
        };
        m.needsUpdate = true;
      } else if (nm.includes('Pearl_GeodesicRibs')) {
        m.color = new THREE.Color(0x526278);
        m.roughness = 0.26;
        m.metalness = 0.82;
        m.emissive = new THREE.Color(0x14081c);
        m.emissiveIntensity = 0.24;
      } else if (nm.includes('Monument_WhiteGlow')) {
        // People's Heroes Monument (`外滩人民英雄纪念塔`) sculpted warm-ivory granite uplighting!
        m.color = new THREE.Color(0xd8d2c6);
        m.emissive = new THREE.Color(0xffeec8);
        m.emissiveIntensity = 1.28;
        m.roughness = 0.38;
      } else if (nm.includes('Glow_DiamondWhite')) {
        // Rich sapphire-ice supertall crown (zero white blowout!)
        m.color = new THREE.Color(0x183c64);
        m.emissive = new THREE.Color(0x74d8ff);
        m.emissiveIntensity = 1.22;
        m.roughness = 0.18;
      } else if (nm.includes('Glow_CrimsonSign')) {
        m.color = new THREE.Color(0x3a0510);
        m.emissive = new THREE.Color(0xff1e3c);
        m.emissiveIntensity = 1.38;
        m.roughness = 0.20;
      } else if (nm.includes('UrbanNightGrid')) {
        m.emissive = new THREE.Color(0xffb648);
        m.emissiveIntensity = 1.18;
        m.roughness = 0.66;
      } else if (nm.includes('Cruise_CabinWindows')) {
        m.color = new THREE.Color(0xf4f6fb);
        m.emissive = new THREE.Color(0xffb83c);
        m.emissiveIntensity = 2.05;
        m.roughness = 0.20;
      } else if (nm.includes('Cruise_NavyHull')) {
        m.color = new THREE.Color(0x0c1930);
        m.roughness = 0.28;
        m.metalness = 0.45;
      } else if (nm.includes('Cruise_WhiteDeck')) {
        m.color = new THREE.Color(0xeef3fa);
        m.roughness = 0.32;
        m.metalness = 0.10;
      } else if (nm.includes('Glow_WarmGold')) {
        m.color = new THREE.Color(0x784c10);
        m.emissive = new THREE.Color(0xffb42c);
        m.emissiveIntensity = 1.32;
      } else if (nm.includes('Glow_ElectricCyan')) {
        // Deep jewel sapphire-blue for SWFC Trapezoid Sky-Aperture (rich #0a84ff blue, zero white clipping!)
        m.color = new THREE.Color(0x021024);
        m.emissive = new THREE.Color(0x0878ec);
        m.emissiveIntensity = 0.82;
        m.roughness = 0.52;
      } else if (nm.includes('GlassCurtain_Warm')) {
        m.emissive = new THREE.Color(0xffd080);
        m.emissiveIntensity = 1.58;
      } else if (nm.includes('GlassCurtain_Cool')) {
        m.emissive = new THREE.Color(0x74d6ff);
        m.emissiveIntensity = 1.50;
      } else if (nm.includes('Bund_Neoclassical') || nm.includes('Bund_CarvedStoneTrim')) {
        const isTrim = nm.includes('Trim');
        m.emissive = new THREE.Color(isTrim ? 0xe49836 : 0xffbc5c);
        m.emissiveIntensity = isTrim ? 0.58 : 1.18;
        m.customProgramCacheKey = () => 'sh_v3_bund_uplight_' + nm;
        m.onBeforeCompile = (shader) => {
          shader.vertexShader = 'varying float vWorldY;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vWorldY = (modelMatrix * vec4(position, 1.0)).y;`
          );
          shader.fragmentShader = 'varying float vWorldY;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             float upWash = pow(clamp(1.0 - (vWorldY - 3.8) / 25.0, 0.0, 1.0), 1.35);
             totalEmissiveRadiance += diffuseColor.rgb * vec3(0.84, 0.54, 0.18) * upWash;`
          );
        };
        m.needsUpdate = true;
      } else if (nm.includes('Promenade_Walkway')) {
        m.color = new THREE.Color(0x887c6e);
        m.emissive = new THREE.Color(0x48341c);
        m.emissiveIntensity = 0.30;
      } else if (nm.includes('PeaceHotel_Copper')) {
        m.emissive = new THREE.Color(0x12ad70);
        m.emissiveIntensity = 0.76;
      } else if (nm.includes('Bund_GoldDome')) {
        m.emissive = new THREE.Color(0xf6a628);
        m.emissiveIntensity = 0.80;
      }
    }
  });
  group.add(shGltf.scene);

  // --------------------------------------------------------------------------
  // 4. HORSESHOE-BEND HUANGPU RIVER WATER SHADER (Y = 0.0m, 1:1 CURVE MATCH!)
  // --------------------------------------------------------------------------
  const fwWaterData = [
    new THREE.Vector4( -8.0, 48.0, -48.0, 1.0),
    new THREE.Vector4( 18.0, 56.0, -68.0, 1.0),
    new THREE.Vector4( 32.0, 68.0, -96.0, 1.0),
    new THREE.Vector4( 52.0, 78.0,-132.0, 1.0),
  ];
  const fwWaterCols = [
    new THREE.Color(0xffd66b),
    new THREE.Color(0xff3c6e),
    new THREE.Color(0x5ce4ff),
    new THREE.Color(0xffa838),
  ];

  const riverGeo = new THREE.PlaneGeometry(420, 480, 128, 160);
  riverGeo.rotateX(-Math.PI * 0.5);
  const riverMat = new THREE.ShaderMaterial({
    transparent: false,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: atmoUniforms.uTime,
      uFwPos: { value: fwWaterData },
      uFwCol: { value: fwWaterCols },
    },
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float uTime;
      varying vec3 vWPos;
      void main() {
        vec3 pos = position;
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        float w1 = sin(wp.x * 0.55 + wp.z * 0.28 + uTime * 2.1) * 0.05;
        float w2 = cos(wp.x * 0.92 - wp.z * 0.46 + uTime * 2.8) * 0.035;
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
      uniform vec4 uFwPos[4];
      uniform vec3 uFwCol[4];
      varying vec3 vWPos;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      void main() {
        float wx = vWPos.x;
        float wz = vWPos.z;

        float r1 = sin(wz * 2.7 + wx * 0.7 + uTime * 3.1) * 0.5 + 0.5;
        float r2 = sin(wz * 5.8 - wx * 1.4 - uTime * 4.2) * 0.5 + 0.5;
        float n1 = vnoise(vec2(wx * 0.80, wz * 2.0 - uTime * 1.3));
        float n2 = vnoise(vec2(wx * 2.05, wz * 4.6 + uTime * 1.9));
        float shimmer = clamp(0.32 * r1 + 0.28 * r2 + 0.40 * n1 * n2 * 1.8, 0.0, 1.25);
        float warpZ = wz + (n1 - 0.5) * 6.5 + sin(wx * 1.3 + uTime * 2.4) * 1.5;

        vec3 viewVec = normalize(cameraPosition - vWPos);
        vec3 nrm = normalize(vec3((n1 - 0.5) * 0.22, 1.0, (n2 - 0.5) * 0.28));
        float fresnel = 0.22 + 0.78 * pow(1.0 - max(0.0, dot(viewVec, nrm)), 2.9);

        vec3 baseWater = mix(vec3(0.010, 0.024, 0.072), vec3(0.036, 0.072, 0.180), fresnel);

        float yBl = -wz;
        float dy = yBl - 46.0;
        float rCenter = -6.5 + (dy >= 0.0 ? 108.0 * pow(dy / 165.0, 2.0) : 88.0 * pow((-dy) / 155.0, 2.0));
        float halfW = 33.5 + 4.5 * min(1.0, pow(abs(dy) / 165.0, 2.0));
        float dxFromCenter = wx - rCenter;

        float waveRibbons = pow(shimmer, 2.05);

        float bundProx = smoothstep(-(halfW - 26.0), -(halfW - 1.0), dxFromCenter);
        float bundShoreRibbon = exp(-pow((dxFromCenter + halfW - 3.5) / 5.5, 2.0));
        float bundCols = 0.48 + 0.52 * abs(sin(warpZ * 0.34 + 0.5));
        vec3 bundReflect = vec3(1.0, 0.70, 0.20) * (bundProx * bundCols * 0.85 + bundShoreRibbon * 1.15) * waveRibbons;
        float monRef = exp(-pow((warpZ + 102.0) / 9.5, 2.0)) * smoothstep(-(halfW - 22.0), -(halfW - 2.0), dxFromCenter);
        bundReflect += vec3(1.0, 0.96, 0.86) * monRef * waveRibbons * 1.25;

        float pudongProx = smoothstep(halfW - 28.0, halfW - 1.0, dxFromCenter);
        float pudongShoreRibbon = exp(-pow((dxFromCenter - (halfW - 3.5)) / 5.5, 2.0));
        float pearlZ = exp(-pow((warpZ + 42.0) / 16.0, 2.0));
        float cyanZ = exp(-pow((warpZ + 74.0) / 22.0, 2.0)) + 0.90 * exp(-pow((warpZ + 94.0) / 24.0, 2.0));
        float crimsonZ = exp(-pow((warpZ + 96.0) / 12.0, 2.0)) + exp(-pow((warpZ - 22.0) / 12.0, 2.0));
        float goldZ = exp(-pow((warpZ + 58.0) / 16.0, 2.0)) + 0.75 * exp(-pow((warpZ + 2.0) / 14.0, 2.0));

        vec3 pudongReflect = vec3(1.0, 0.74, 0.24) * pudongShoreRibbon * waveRibbons * 1.10
          + vec3(1.0, 0.14, 0.56) * pearlZ * pudongProx * waveRibbons * 1.35
          + vec3(0.16, 0.80, 1.00) * pudongProx * (0.35 + 0.65 * cyanZ) * waveRibbons * 1.05
          + vec3(1.0, 0.22, 0.36) * crimsonZ * pudongProx * waveRibbons * 0.90
          + vec3(1.0, 0.74, 0.24) * goldZ * pudongProx * waveRibbons * 0.80;

        float s1 = exp(-pow((wx - 1.9) / 5.5, 2.0) - pow((warpZ - 24.0) / 12.5, 2.0));
        float s2 = exp(-pow((wx - 7.3) / 5.5, 2.0) - pow((warpZ + 16.0) / 12.5, 2.0));
        float s3 = exp(-pow((wx + 17.5)/ 5.5, 2.0) - pow((warpZ + 48.0) / 12.5, 2.0));
        float s4 = exp(-pow((wx - 7.6) / 5.5, 2.0) - pow((warpZ + 80.0) / 12.5, 2.0));
        float s5 = exp(-pow((wx - 3.9) / 5.5, 2.0) - pow((warpZ + 115.0)/ 12.5, 2.0));
        float s6 = exp(-pow((wx - 48.8)/ 5.5, 2.0) - pow((warpZ + 154.0)/ 12.5, 2.0));
        vec3 shipReflect = vec3(1.0, 0.76, 0.26) * (s1 + s3 + s5) * waveRibbons * 1.15
                         + vec3(0.22, 0.84, 1.00) * (s2 + s4 + s6) * waveRibbons * 1.05;

        vec3 fwReflect = vec3(0.0);
        for (int i = 0; i < 4; i++) {
          vec4 fp = uFwPos[i];
          float dXZ = length(vec2((wx - fp.x) * 0.80, (warpZ - fp.z) * 0.55));
          float fwMask = exp(-pow(dXZ / 26.0, 2.0)) * fp.w;
          fwReflect += uFwCol[i] * fwMask * waveRibbons * 0.92;
        }

        float sparkle = pow(max(0.0, shimmer - 0.68) * 3.1, 3.0) * 0.55;
        vec3 reflSum = (bundReflect + pudongReflect + shipReflect + fwReflect) * (0.46 + 0.54 * fresnel);
        vec3 outCol = baseWater + reflSum + vec3(1.0, 0.94, 0.80) * sparkle * clamp(length(reflSum), 0.05, 1.0);

        gl_FragColor = vec4(outCol, 1.0);
        #include <fog_fragment>
      }
    `,
  });
  const riverMesh = new THREE.Mesh(riverGeo, riverMat);
  riverMesh.position.set(35.0, 0.0, -55.0);
  riverMesh.receiveShadow = true;
  group.add(riverMesh);

  // --------------------------------------------------------------------------
  // 5. WARM FIREWORK-LIT VOLUMETRIC CUMULUS CLOUDS ON RIGHT HORIZON
  //    Matches Bottom-Right panel of s8_shanghai_ref_board.jpg!
  // --------------------------------------------------------------------------
  const fireworkCloudSystem = createVolumetricCloudSystem({
    clusters: [
      { center: [146.0,  62.0,  -56.0], radius: [26, 15, 22], puffs: 28, scale: [18.0, 36.0] },
      { center: [164.0,  78.0,  -92.0], radius: [30, 18, 26], puffs: 32, scale: [22.0, 42.0] },
      { center: [178.0,  86.0, -132.0], radius: [32, 18, 26], puffs: 32, scale: [22.0, 44.0] },
      { center: [134.0,  52.0,  -24.0], radius: [22, 12, 18], puffs: 20, scale: [16.0, 30.0] },
    ],
    sunDir: new THREE.Vector3(-0.68, 0.50, 0.52).normalize(),
    litColor: 0xffc2a6,    // Warm rose-peach & amber firework illumination
    shadowColor: 0x26223c, // Deep velvety indigo-plum night cloud shadow
    rimColor: 0xffd88c,    // Molten-gold firework silver lining
    opacity: 0.74,
    seed: 202608,
  });
  group.add(fireworkCloudSystem.mesh);

  // --------------------------------------------------------------------------
  // 6. SUBTLE SKYLINE SEARCHLIGHT BEAMS
  // --------------------------------------------------------------------------
  const searchlightNodes = [];
  {
    const beamGeo = new THREE.ConeGeometry(6.2, 130.0, 18, 1, true);
    beamGeo.translate(0, -65.0, 0);
    beamGeo.rotateX(Math.PI);

    const makeBeamMat = (colHex, op) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
        uniforms: {
          uColor: { value: new THREE.Color(colHex) },
          uOpacity: { value: op },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -mv.xyz;
            vNormalV = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          void main() {
            float edgeSoft = pow(abs(dot(normalize(vNormalV), normalize(vViewPos))), 1.9);
            float heightFade = smoothstep(0.0, 0.14, vUv.y) * pow(max(0.0, 1.0 - vUv.y), 1.75);
            float a = edgeSoft * heightFade * uOpacity;
            gl_FragColor = vec4(uColor * a, a);
          }
        `,
      });

    const beamSpecs = [
      { pos: [ 79.0,111.0, -74.0], col: 0x5ce4ff, op: 0.05, baseZ:  0.14, baseX: -0.10, spd: 0.72, ph: 2.2 },
      { pos: [ 92.0,135.0, -94.0], col: 0xffe08a, op: 0.05, baseZ:  0.20, baseX:  0.05, spd: 0.68, ph: 3.1 },
      { pos: [ 68.0, 96.5, -58.0], col: 0xffd66b, op: 0.05, baseZ:  0.22, baseX: -0.04, spd: 0.90, ph: 4.0 },
    ];
    for (const bs of beamSpecs) {
      const m = new THREE.Mesh(beamGeo, makeBeamMat(bs.col, bs.op));
      m.position.set(...bs.pos);
      group.add(m);
      searchlightNodes.push({ mesh: m, ...bs });
    }
  }

  // --------------------------------------------------------------------------
  // 7. 16 FEATHERED OMNI FIREWORK VIDEO BILLBOARDS (3 DISTINCT OMNI LOOPS!)
  // --------------------------------------------------------------------------
  const omniFwChrys = createLoopingVideoTexture('./assets/soarin_scene8_shanghai/sh_omni_fireworks_chrysanthemum_v3.mp4');
  const omniFwGold  = createLoopingVideoTexture('./assets/soarin_scene8_shanghai/sh_omni_fireworks_gold_crimson.mp4');
  const omniFwCyan  = createLoopingVideoTexture('./assets/soarin_scene8_shanghai/sh_omni_fireworks_cyan_violet.mp4');

  function makeOmniFireworkMat(vTex, tintHex, gain) {
    const uPulse = { value: 1.0 };
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        uVid: { value: vTex },
        uTint: { value: new THREE.Color(tintHex) },
        uGain: { value: gain },
        uPulse,
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uVid;
        uniform vec3 uTint;
        uniform float uGain;
        uniform float uPulse;
        varying vec2 vUv;
        void main() {
          vec2 uvS = (vUv - 0.5) * 1.16 + 0.5;
          if (uvS.x <= 0.008 || uvS.x >= 0.992 || uvS.y <= 0.008 || uvS.y >= 0.992) {
            gl_FragColor = vec4(0.0);
            return;
          }
          vec3 raw = texture2D(uVid, uvS).rgb;
          vec3 clean = max(vec3(0.0), raw - vec3(0.050)) * 1.32;
          float luma = dot(clean, vec3(0.3333));
          float lumaGate = smoothstep(0.020, 0.16, luma);

          float rEllip = length((vUv - 0.5) * vec2(2.04, 2.08));
          float radialFade = pow(smoothstep(0.98, 0.20, rEllip), 1.28);
          float uvEdge = smoothstep(0.01, 0.18, uvS.x) * smoothstep(0.99, 0.82, uvS.x)
                       * smoothstep(0.01, 0.18, uvS.y) * smoothstep(0.99, 0.82, uvS.y);

          float mask = lumaGate * radialFade * uvEdge * uGain * uPulse;
          vec3 col = clean * uTint * mask;
          gl_FragColor = vec4(col, clamp(mask, 0.0, 1.0));
        }
      `,
    });
    return { mat, uPulse };
  }

  const omniBillboardSpecs = [
    // Framed high in the starry night sky over Bund, Oriental Pearl & Lujiazui Quartet!
    { pos: [ -4.0,  96.0, -82.0], size: [74, 46], vidIdx: 0, tint: 0xffe49c, gain: 1.55, phase: 0.2, roll:  0.05 },
    { pos: [ 36.0, 108.0, -86.0], size: [78, 48], vidIdx: 0, tint: 0xffd870, gain: 1.58, phase: 1.1, roll: -0.08 },
    { pos: [ 74.0, 118.0, -88.0], size: [78, 48], vidIdx: 0, tint: 0xff7898, gain: 1.52, phase: 2.1, roll:  0.07 },
    { pos: [112.0,  98.0,-102.0], size: [68, 42], vidIdx: 2, tint: 0x74e8ff, gain: 1.48, phase: 0.7, roll:  0.12 },
    { pos: [ 58.0,  94.0, -68.0], size: [64, 40], vidIdx: 2, tint: 0x6ae6ff, gain: 1.46, phase: 1.8, roll: -0.09 },
    { pos: [ 92.0, 106.0, -96.0], size: [72, 45], vidIdx: 2, tint: 0x78ecff, gain: 1.48, phase: 2.9, roll:  0.11 },
    // High SWFC Climb & Grand Finale Canopy
    { pos: [ 68.0, 128.0, -88.0], size: [72, 45], vidIdx: 0, tint: 0xffdc80, gain: 1.52, phase: 3.6, roll: -0.12 },
    { pos: [ 98.0, 138.0, -98.0], size: [76, 48], vidIdx: 1, tint: 0xffd66b, gain: 1.50, phase: 0.5, roll:  0.08 },
    { pos: [ 32.0, 122.0, -84.0], size: [74, 46], vidIdx: 1, tint: 0xffe084, gain: 1.52, phase: 1.5, roll: -0.06 },
    { pos: [ 66.0, 136.0, -92.0], size: [82, 52], vidIdx: 0, tint: 0xffe494, gain: 1.58, phase: 2.4, roll:  0.10 },
    { pos: [104.0, 134.0, -96.0], size: [78, 48], vidIdx: 0, tint: 0xff6286, gain: 1.55, phase: 3.3, roll: -0.10 },
    { pos: [128.0, 132.0,-106.0], size: [74, 46], vidIdx: 2, tint: 0x6ae8ff, gain: 1.48, phase: 4.1, roll:  0.08 },
  ];

  const vidLookup = [omniFwChrys.vTex, omniFwGold.vTex, omniFwCyan.vTex];
  const omniBillboards = omniBillboardSpecs.map((cfg) => {
    const vTex = vidLookup[cfg.vidIdx];
    const { mat, uPulse } = makeOmniFireworkMat(vTex, cfg.tint, cfg.gain);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size[0], cfg.size[1]), mat);
    mesh.position.set(...cfg.pos);
    mesh.renderOrder = 5;
    group.add(mesh);
    return { mesh, uPulse, ...cfg };
  });

  // --------------------------------------------------------------------------
  // 8. COLOSSAL V3 3D GPU-CURVED CHRYSANTHEMUM & WEEPING WILLOW FIREWORKS
  //    22 Staggered Shells × 200 Continuous Radial Flower Ribbons = 4,400 Instances!
  //    Radius = 26..36m, molten-gold #ffd66b, crimson-rose #ff3c6e, ice-sapphire #5ce4ff!
  // --------------------------------------------------------------------------
  const SHELL_COUNT = 22;
  const TRAILS_PER_SHELL = 200;
  const TOTAL_FW_RIBBONS = SHELL_COUNT * TRAILS_PER_SHELL; // 4,400 curved 3D ribbons!

  const shellDefs = [
    // --- Beat 1 (`t = 2.2s` Wide Bund & River Bend Panorama toward Lujiazui) ---
    { center: [ -6.0,  96.0, -78.0], tBurst:  0.55, radius: 33.0, cMain: 0xffd66b, cCore: 0xff5898, drag: 1.65, dur: 4.10 },
    { center: [ 36.0, 108.0, -82.0], tBurst:  0.85, radius: 35.0, cMain: 0xffd66b, cCore: 0x9b6bff, drag: 1.60, dur: 4.10 },
    { center: [ 74.0, 116.0, -84.0], tBurst:  1.10, radius: 34.0, cMain: 0xff3c6e, cCore: 0x5ce4ff, drag: 1.62, dur: 4.05 },
    { center: [116.0,  92.0, -96.0], tBurst:  1.35, radius: 28.5, cMain: 0xff3c6e, cCore: 0xffd66b, drag: 1.70, dur: 3.90 },
    { center: [ 18.0,  78.0, -68.0], tBurst:  2.78, radius: 28.0, cMain: 0x5ce4ff, cCore: 0xffd66b, drag: 1.65, dur: 3.95 }, // Rising golden comet at t=2.2!

    // --- Beat 2 (`t = 7.6s` 90° Oriental Pearl Orbit & Lujiazui Skyline Pan) ---
    { center: [ 44.0,  72.0, -64.0], tBurst:  5.80, radius: 28.0, cMain: 0xffd66b, cCore: 0xfff2bd, drag: 1.62, dur: 4.10 },
    { center: [ 68.0, 102.0, -80.0], tBurst:  6.15, radius: 35.0, cMain: 0x5ce4ff, cCore: 0xffd66b, drag: 1.58, dur: 4.15 },
    { center: [ 96.0, 106.0, -94.0], tBurst:  6.45, radius: 34.0, cMain: 0x5ce4ff, cCore: 0xff3c6e, drag: 1.60, dur: 4.10 },
    { center: [118.0,  86.0,-108.0], tBurst:  6.75, radius: 28.0, cMain: 0xff3c6e, cCore: 0xffd66b, drag: 1.65, dur: 3.95 },
    { center: [ 86.0, 106.0, -78.0], tBurst:  8.18, radius: 30.0, cMain: 0xffd66b, cCore: 0xff3c6e, drag: 1.60, dur: 4.00 }, // Tall golden launch comet at t=7.6!

    // --- Beat 3 (`t = 14.5s` Continue Riding & Steep Skyward Climb Up SWFC) ---
    { center: [ 68.0, 104.0, -78.0], tBurst: 10.20, radius: 30.0, cMain: 0xffd66b, cCore: 0x5ce4ff, drag: 1.60, dur: 3.95 },
    { center: [ 66.0, 118.0, -84.0], tBurst: 12.85, radius: 30.0, cMain: 0xffd66b, cCore: 0xfff2be, drag: 1.60, dur: 4.10 },
    { center: [ 86.0, 128.0, -84.0], tBurst: 13.15, radius: 32.0, cMain: 0xff3c6e, cCore: 0xffd66b, drag: 1.58, dur: 4.10 },
    { center: [102.0, 138.0, -98.0], tBurst: 13.45, radius: 33.5, cMain: 0x5ce4ff, cCore: 0xff3c6e, drag: 1.56, dur: 4.10 },
    { center: [ 74.0, 122.0, -72.0], tBurst: 15.08, radius: 29.0, cMain: 0xffd66b, cCore: 0xff3c6e, drag: 1.60, dur: 3.95 }, // Launch comet at t=14.5!

    // --- Beat 4 (`t = 18.8s` Colossal Full-Sky Grand Fireworks Show Finale!) ---
    { center: [ 28.0, 118.0, -82.0], tBurst: 16.95, radius: 33.0, cMain: 0xffd66b, cCore: 0xfff4c6, drag: 1.56, dur: 4.25 },
    { center: [ 62.0, 134.0, -88.0], tBurst: 17.25, radius: 36.0, cMain: 0xffd66b, cCore: 0xff9248, drag: 1.54, dur: 4.30 },
    { center: [ 98.0, 132.0, -94.0], tBurst: 17.50, radius: 35.0, cMain: 0xff3c6e, cCore: 0x5ce4ff, drag: 1.56, dur: 4.25 },
    { center: [124.0, 130.0,-102.0], tBurst: 17.75, radius: 33.0, cMain: 0x5ce4ff, cCore: 0xe6f9ff, drag: 1.58, dur: 4.20 },
    { center: [ 14.0,  98.0, -78.0], tBurst: 17.95, radius: 26.0, cMain: 0xffd66b, cCore: 0xff3c6e, drag: 1.64, dur: 4.00 },
    { center: [ 42.0, 116.0, -74.0], tBurst: 19.35, radius: 33.0, cMain: 0xffd66b, cCore: 0x5ce4ff, drag: 1.56, dur: 4.10 }, // Golden launch comet left at t=18.8!
    { center: [108.0, 118.0, -84.0], tBurst: 19.48, radius: 32.0, cMain: 0xff3c6e, cCore: 0xffd66b, drag: 1.58, dur: 4.10 }, // Golden launch comet right at t=18.8!
  ];

  const fwRibbonGeo = (() => {
    const base = new THREE.PlaneGeometry(1.0, 1.0, 1, 10);
    const geo = base.clone();
    base.dispose();

    const aCenter  = new Float32Array(TOTAL_FW_RIBBONS * 3);
    const aDir     = new Float32Array(TOTAL_FW_RIBBONS * 4);
    const aTiming  = new Float32Array(TOTAL_FW_RIBBONS * 4);
    const aColMain = new Float32Array(TOTAL_FW_RIBBONS * 3);
    const aColCore = new Float32Array(TOTAL_FW_RIBBONS * 3);
    const aMeta    = new Float32Array(TOTAL_FW_RIBBONS * 2);

    let fwSeed = 20260808;
    const fwRand = () => {
      fwSeed = (fwSeed * 16807) % 2147483647;
      return (fwSeed - 1) / 2147483646;
    };
    const goldenAng = Math.PI * (3.0 - Math.sqrt(5.0));
    const cM = new THREE.Color();
    const cC = new THREE.Color();

    for (let s = 0; s < SHELL_COUNT; s++) {
      const sd = shellDefs[s];
      cM.setHex(sd.cMain);
      cC.setHex(sd.cCore);

      const outerCount = Math.floor(TRAILS_PER_SHELL * 0.72);
      const innerCount = TRAILS_PER_SHELL - outerCount;

      for (let k = 0; k < TRAILS_PER_SHELL; k++) {
        const idx = s * TRAILS_PER_SHELL + k;
        const isInner = k >= outerCount;
        const gIdx = isInner ? k - outerCount : k;
        const gCnt = isInner ? innerCount : outerCount;

        const yUnit = 1.0 - ((gIdx + 0.5) / gCnt) * 2.0;
        const rHoriz = Math.sqrt(Math.max(0.0, 1.0 - yUnit * yUnit));
        const th = gIdx * goldenAng + s * 1.37 + (fwRand() - 0.5) * 0.07;
        const spd = (isInner ? 0.56 : 1.0) * (0.92 + fwRand() * 0.15);

        aCenter[idx * 3 + 0] = sd.center[0];
        aCenter[idx * 3 + 1] = sd.center[1];
        aCenter[idx * 3 + 2] = sd.center[2];

        aDir[idx * 4 + 0] = Math.cos(th) * rHoriz * spd;
        aDir[idx * 4 + 1] = yUnit * spd;
        aDir[idx * 4 + 2] = Math.sin(th) * rHoriz * spd;
        aDir[idx * 4 + 3] = k < 8 ? (k + 1.0) : 0.0;

        aTiming[idx * 4 + 0] = sd.tBurst;
        aTiming[idx * 4 + 1] = sd.radius;
        aTiming[idx * 4 + 2] = sd.drag;
        aTiming[idx * 4 + 3] = sd.dur;

        if (isInner) {
          aColMain[idx * 3 + 0] = cC.r;
          aColMain[idx * 3 + 1] = cC.g;
          aColMain[idx * 3 + 2] = cC.b;
          aColCore[idx * 3 + 0] = 1.0;
          aColCore[idx * 3 + 1] = 0.95;
          aColCore[idx * 3 + 2] = 0.84;
        } else {
          aColMain[idx * 3 + 0] = cM.r;
          aColMain[idx * 3 + 1] = cM.g;
          aColMain[idx * 3 + 2] = cM.b;
          aColCore[idx * 3 + 0] = cC.r;
          aColCore[idx * 3 + 1] = cC.g;
          aColCore[idx * 3 + 2] = cC.b;
        }

        aMeta[idx * 2 + 0] = fwRand() * 6.28318;
        aMeta[idx * 2 + 1] = 0.94 + 0.05 * fwRand(); // Full continuous radial chrysanthemum petal from core to tip!
      }
    }

    geo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(aCenter, 3));
    geo.setAttribute('aDir', new THREE.InstancedBufferAttribute(aDir, 4));
    geo.setAttribute('aTiming', new THREE.InstancedBufferAttribute(aTiming, 4));
    geo.setAttribute('aColMain', new THREE.InstancedBufferAttribute(aColMain, 3));
    geo.setAttribute('aColCore', new THREE.InstancedBufferAttribute(aColCore, 3));
    geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(aMeta, 2));
    return geo;
  })();

  const fwRibbonMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uCycleTime: atmoUniforms.uCycleTime,
      uTime: atmoUniforms.uTime,
    },
    vertexShader: `
      attribute vec3 aCenter;
      attribute vec4 aDir;
      attribute vec4 aTiming;
      attribute vec3 aColMain;
      attribute vec3 aColCore;
      attribute vec2 aMeta;

      uniform float uCycleTime;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vColMain;
      varying vec3 vColCore;
      varying float vFade;
      varying float vIsLaunch;

      vec3 evalArcPos(float age, float s, float radius, float drag) {
        float tSub = age * s;
        float rSub = radius * (1.0 - exp(-tSub * drag));
        // Graceful weeping chrysanthemum curve (preserves full spherical flower silhouette!)
        float grav = -0.92 * tSub * tSub * (0.35 + 0.65 * s);
        return aCenter + aDir.xyz * rSub + vec3(0.0, grav, 0.0);
      }

      void main() {
        vUv = uv;
        vColMain = aColMain;
        vColCore = aColCore;
        vFade = 0.0;
        vIsLaunch = 0.0;

        float tBurst = aTiming.x;
        float radius = aTiming.y;
        float drag   = aTiming.z;
        float dur    = aTiming.w;
        float age    = mod(uCycleTime - tBurst + 21.0, 21.0);
        float mortarLead = 0.85;

        if (age <= dur) {
          float uAge = age / dur;
          float sTail = max(0.02, 1.0 - aMeta.y * (1.0 - 0.12 * uAge));
          float s = mix(sTail, 1.0, uv.y);
          float sNext = min(1.03, s + 0.035);

          vec3 wPos = evalArcPos(age, s, radius, drag);
          vec3 wNext = evalArcPos(age, sNext, radius, drag);
          vec3 tang = wNext - wPos;
          vec3 toCam = cameraPosition - wPos;
          vec3 side = cross(tang, toCam);
          float sLen = length(side);
          side = sLen > 1e-4 ? (side / sLen) : vec3(1.0, 0.0, 0.0);

          float glitter = uAge > 0.62 ? (0.74 + 0.26 * sin(uTime * 24.0 + aMeta.x + uv.y * 9.0)) : 1.0;
          float halfW = (0.12 + 0.20 * pow(uv.y, 1.15)) * (1.06 - 0.30 * uAge);
          wPos += side * ((uv.x - 0.5) * 2.0 * halfW);

          vFade = smoothstep(0.0, 0.03, uAge) * pow(max(0.0, 1.0 - uAge), 0.68) * glitter;
          gl_Position = projectionMatrix * viewMatrix * vec4(wPos, 1.0);
        } else if (aDir.w > 0.5 && age >= (21.0 - mortarLead)) {
          vIsLaunch = 1.0;
          float uL = (age - (21.0 - mortarLead)) / mortarLead;
          float headY = mix(6.0, aCenter.y, 1.0 - pow(1.0 - uL, 1.65));
          float tailLen = min(max(2.0, headY - 5.0), 54.0);
          float yCur = headY - (1.0 - uv.y) * tailLen;
          float sway = (1.0 - uv.y) * 3.2 * sin(aMeta.x);
          vec3 wPos = vec3(aCenter.x + sway, yCur, aCenter.z + cos(aMeta.x) * 0.9 * (1.0 - uv.y));

          vec3 toCam = cameraPosition - wPos;
          vec3 side = cross(vec3(0.0, 1.0, 0.0), toCam);
          float sLen = length(side);
          side = sLen > 1e-4 ? (side / sLen) : vec3(1.0, 0.0, 0.0);

          float kIdx = aDir.w;
          float halfW = (0.14 + 0.38 * pow(uv.y, 1.6)) * (kIdx < 3.5 ? 1.25 : 0.65);
          wPos += side * ((uv.x - 0.5) * 2.0 * halfW);

          vFade = smoothstep(0.0, 0.08, uL) * (kIdx < 3.5 ? 1.05 : 0.48);
          gl_Position = projectionMatrix * viewMatrix * vec4(wPos, 1.0);
        } else {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vColMain;
      varying vec3 vColCore;
      varying float vFade;
      varying float vIsLaunch;

      void main() {
        if (vFade <= 0.002) discard;
        float across = abs(vUv.x - 0.5) * 2.0;
        float coreCross = exp(-pow(across * 2.55, 2.0));
        // Continuous luminous petal from inner chrysanthemum heart (vUv.y=0.05) to diamond tip (vUv.y=1.0)!
        float alongBody = vIsLaunch > 0.5
          ? (smoothstep(0.0, 0.25, vUv.y) * pow(vUv.y, 0.95))
          : (smoothstep(0.0, 0.08, vUv.y) * (0.58 + 0.46 * vUv.y));
        float hotHead = exp(-pow((1.0 - vUv.y) * 8.5, 2.0)) * exp(-pow(across * 1.75, 2.0));

        vec3 baseCol = vIsLaunch > 0.5
          ? vec3(1.0, 0.85, 0.44)
          : mix(vColCore, vColMain, smoothstep(0.14, 0.52, vUv.y));

        float lum = (coreCross * alongBody * 0.92 + hotHead * 1.48) * vFade;
        vec3 col = mix(baseCol * 1.28, vec3(1.0, 0.98, 0.90), clamp(hotHead * 0.75, 0.0, 0.82));
        gl_FragColor = vec4(col * lum, clamp(lum, 0.0, 1.0));
      }
    `,
  });

  const fwInstMesh = new THREE.InstancedMesh(fwRibbonGeo, fwRibbonMat, TOTAL_FW_RIBBONS);
  fwInstMesh.frustumCulled = false;
  fwInstMesh.renderOrder = 6;
  {
    const idM = new THREE.Matrix4();
    for (let i = 0; i < TOTAL_FW_RIBBONS; i++) fwInstMesh.setMatrixAt(i, idM);
    fwInstMesh.instanceMatrix.needsUpdate = true;
  }
  group.add(fwInstMesh);

  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0, 0.82, 0.42);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float glow = pow(max(0.0, 1.0 - r), 3.1);
        float starRay = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.6)
                      + exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.6);
        float g = glow * 0.85 + starRay * max(0.0, 1.0 - r) * 0.55;
        gl_FragColor = vec4(mix(vCol, vec3(1.0, 0.97, 0.88), 0.35) * g, clamp(g, 0.0, 1.0));
      }
    `,
  });
  const fwHaloInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.0, 1.0), haloMat, SHELL_COUNT);
  fwHaloInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fwHaloInst.frustumCulled = false;
  fwHaloInst.renderOrder = 5;
  {
    const tmpC = new THREE.Color();
    for (let s = 0; s < SHELL_COUNT; s++) {
      tmpC.setHex(shellDefs[s].cMain);
      fwHaloInst.setColorAt(s, tmpC);
    }
    fwHaloInst.instanceColor.needsUpdate = true;
  }
  group.add(fwHaloInst);

  // --------------------------------------------------------------------------
  // 9. V3 GRAND FINALE 21.0s CHOREOGRAPHY (EXACT USER 4-BEAT SPEC!)
  //    1) 0.0–4.6s: Curving along Huangpu River bend onto The Bund (`沿江水转弯到外滩`).
  //    2) 4.6–10.8s: Exact 90° orbital arc around Oriental Pearl ([48.5, y, -42.0], R=26m, -180° -> -90°)
  //       + smooth pan across Lujiazui skyline (`环绕90度东方明珠塔，运镜看陆家嘴美景`).
  //    3) 10.8–16.2s: Continue riding & climb skyward up SWFC ([79, 111, -74], `接续骑行，世贸中心往上`).
  //    4) 16.2–21.0s: Panoramic sky-cruise over Huangpu River amidst full-sky fireworks (`最后和烟火表演结束`).
  // --------------------------------------------------------------------------
  const heroKeyframes = [
    { t:  0.0, pos: [  8.0,  28.0,  22.0] }, // Arriving along center of southern Huangpu River bend!
    { t:  2.2, pos: [-18.0,  33.5, -14.0] }, // Curving along river toward golden-lit Bund (`沿江水转弯到外滩` — 81° side-hero profile!)
    { t:  3.5, pos: [ -2.0,  37.5, -34.0] }, // Sweeping gracefully across river bend toward Oriental Pearl!
    { t:  4.6, pos: [ 22.5,  40.5, -42.0] }, // Orbit Start: exact theta = -180° (due West of Oriental Pearl, R = 26.0m)
    { t:  6.7, pos: [ 26.0,  43.5, -55.0] }, // Orbit 30°:  theta = -150° around Oriental Pearl ruby-magenta spheres!
    { t:  8.8, pos: [ 35.5,  46.5, -64.5] }, // Orbit 60°:  theta = -120° panning across Jin Mao, SWFC & Shanghai Tower!
    { t: 10.8, pos: [ 48.5,  49.5, -68.0] }, // Orbit 90°:  exact theta = -90° (due North of Oriental Pearl — 90° arc!)
    { t: 12.2, pos: [ 58.0,  55.5, -66.5] }, // Aligning parallel to SWFC west glass facade for broadside skyward climb!
    { t: 14.5, pos: [ 59.5,  86.5, -74.0] }, // Steep skyward climb parallel to SWFC (`世贸中心往上` — crisp side-hero profile!)
    { t: 15.9, pos: [ 54.0, 113.5, -77.0] }, // Cresting right past SWFC's 111m glowing sapphire trapezoid crown!
    { t: 17.3, pos: [ 12.0,  96.0, -38.0] }, // Sweeping victory arc out over the gleaming Huangpu River!
    { t: 18.8, pos: [ -8.0,  82.0, -14.0] }, // Broadside Left-to-Right panoramic sky-ride facing full Lujiazui & River Bend!
    { t: 21.0, pos: [ 22.0,  80.0,  -6.0] }, // Grand fireworks show finale lock!
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.34,
    bankGain: 0.42,
    maxBankRad: 0.22,
  });

  // --------------------------------------------------------------------------
  // 10. SPARKLING GOLDEN STARDUST SKY-BICYCLE WAKE (`金色星光骑行尾迹灯带`)
  // --------------------------------------------------------------------------
  const WAKE_SPARK_COUNT = 240;
  const wakeGeo = new THREE.PlaneGeometry(1.0, 1.0);
  const wakeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0, 0.84, 0.42);
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r >= 1.0) discard;
        float core = pow(max(0.0, 1.0 - r), 2.6);
        float twinkle = exp(-abs(p.x) * 10.0) * exp(-abs(p.y) * 2.8) + exp(-abs(p.y) * 10.0) * exp(-abs(p.x) * 2.8);
        float a = core * 0.92 + twinkle * max(0.0, 1.0 - r) * 0.48;
        gl_FragColor = vec4(mix(vCol, vec3(1.0, 0.98, 0.90), 0.38) * a, clamp(a, 0.0, 1.0));
      }
    `,
  });
  const wakeInst = new THREE.InstancedMesh(wakeGeo, wakeMat, WAKE_SPARK_COUNT);
  wakeInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wakeInst.frustumCulled = false;
  wakeInst.renderOrder = 6;
  const wakeSeeds = [];
  {
    let ws = 7719;
    const wr = () => { ws = (ws * 16807) % 2147483647; return (ws - 1) / 2147483646; };
    const wc = new THREE.Color();
    for (let i = 0; i < WAKE_SPARK_COUNT; i++) {
      const u = i / (WAKE_SPARK_COUNT - 1);
      wakeSeeds.push({
        u,
        ox: (wr() - 0.5) * (0.20 + 0.75 * u),
        oy: 0.08 + (wr() - 0.5) * (0.16 + 0.45 * u) - 0.14 * u,
        oz: (wr() - 0.5) * (0.20 + 0.75 * u),
        sz: (0.07 + 0.13 * wr()) * (1.0 - 0.45 * u) * smoothstep01(0.0, 0.18, u),
        ph: wr() * 6.283,
      });
      wc.setHex(wr() > 0.25 ? 0xffd66b : 0xfff3c4);
      wakeInst.setColorAt(i, wc);
    }
    wakeInst.instanceColor.needsUpdate = true;
    wakeInst.visible = false;
  }

  const SH_GAZE = [
    { t:  0.0, yaw: -0.15, pitch: -0.02 },
    { t:  4.8, yaw:  0.24, pitch: -0.04 },
    { t:  8.5, yaw:  0.18, pitch: -0.06 },
    { t: 12.2, yaw:  0.12, pitch: -0.20 },
    { t: 17.5, yaw: -0.28, pitch: -0.06 }, // Gazing happily across at Lujiazui fireworks during broadside finale!
    { t: 20.5, yaw: -0.24, pitch: -0.04 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const tmpWakePos = new THREE.Vector3();
  const vista1 = new THREE.Vector3();
  const vista2 = new THREE.Vector3();
  const vista3 = new THREE.Vector3();
  const vista4 = new THREE.Vector3();
  const vistaBlend = new THREE.Vector3();
  const dirHV = new THREE.Vector3();
  const rightHV = new THREE.Vector3();
  const upWorld = new THREE.Vector3(0, 1, 0);
  const dummyObj = new THREE.Object3D();
  const keySunOffset = new THREE.Vector3(-42.0, 52.0, 24.0);

  // --------------------------------------------------------------------------
  // 11. COLLINEAR VISTA-RAY C2 CAMERA DIRECTOR (0.0° ROLL, STAR PROTAGONIST 44-48%!)
  //     Places camera `dCam = 3.05..3.35m` from Pelican's visual center (`+0.68m`)
  //     using a wide IMAX lens (`FOV = 51°–53°`), guaranteeing BOTH prominent
  //     42%–48% foreground Pelican scale AND full panoramic Shanghai skyline + sky!
  // --------------------------------------------------------------------------
  const heroCenter = new THREE.Vector3();
  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);
    heroCenter.set(tmpH.x, tmpH.y + 0.68, tmpH.z);

    // Beat 1 Vista (`0.0–4.6s`, Shot 1 at `t = 2.2s`):
    // 81° Side-Hero Framing: Bund & People's Heroes Monument on Left + Curving River + Lujiazui Quartet on Right!
    const w1 = quintic01(0.0, 4.6, tc);
    vista1.set(
      THREE.MathUtils.lerp(36.0, 56.0, w1),
      THREE.MathUtils.lerp(52.0, 58.0, w1),
      THREE.MathUtils.lerp(-74.0, -52.0, w1)
    );

    // Beat 2 Vista (`4.6–10.8s`, Shot 2 at `t = 7.6s`):
    // 90° Oriental Pearl Orbit (62° 3/4 Side-Hero Profile!) + Smooth Pan Across Oriental Pearl, Jin Mao, SWFC & Shanghai Tower!
    const w2 = quintic01(4.6, 10.8, tc);
    vista2.set(
      THREE.MathUtils.lerp(56.0, 82.0, w2),
      THREE.MathUtils.lerp(56.0, 74.0, w2),
      THREE.MathUtils.lerp(-42.0, -68.0, w2)
    );

    // Beat 3 Vista (`10.8–16.0s`, Shot 3 at `t = 14.5s`):
    // Broadside Eastward Sightline Across Steeply Climbing Pelican Directly Into SWFC's Sapphire Trapezoid & Shanghai Tower!
    const w3 = quintic01(10.8, 16.0, tc);
    vista3.set(
      THREE.MathUtils.lerp(96.0, 104.0, w3),
      heroCenter.y + THREE.MathUtils.lerp(12.0, 16.0, w3),
      THREE.MathUtils.lerp(-76.0, -88.0, w3)
    );

    // Beat 4 Vista (`16.0–21.0s`, Shot 4 at `t = 18.8s`):
    // Postcard Broadside Finale over Horseshoe Huangpu River, Bund, Unoccluded Lujiazui Quartet, Cumulus Clouds & Full-Sky Fireworks!
    const w4 = quintic01(16.2, 21.0, tc);
    vista4.set(
      THREE.MathUtils.lerp(66.0, 72.0, w4),
      THREE.MathUtils.lerp(90.0, 92.0, w4),
      THREE.MathUtils.lerp(-78.0, -82.0, w4)
    );

    const b12 = quintic01(3.8, 5.6, tc);
    const b23 = quintic01(10.0, 12.0, tc);
    const b34 = quintic01(15.4, 17.6, tc);

    vistaBlend.copy(vista1).lerp(vista2, b12).lerp(vista3, b23).lerp(vista4, b34);

    dirHV.copy(vistaBlend).sub(heroCenter);
    if (dirHV.lengthSq() < 1e-4) dirHV.set(0, 0, -1);
    else dirHV.normalize();

    rightHV.crossVectors(dirHV, upWorld);
    if (rightHV.lengthSq() < 1e-4) rightHV.set(1, 0, 0);
    else rightHV.normalize();

    // Camera distance 3.15m - 3.35m -> Pelican fills ~42%–48% of frame height in EVERY beat!
    const dCam12 = THREE.MathUtils.lerp(3.25, 3.20, b12);
    const dCam23 = THREE.MathUtils.lerp(dCam12, 3.35, b23);
    const dCam   = THREE.MathUtils.lerp(dCam23, 3.25, b34);

    // Positive camSide shifts camera slightly right -> places Pelican cleanly in left-center so landmarks shine unoccluded on right!
    const side12 = THREE.MathUtils.lerp(0.62, 0.68, b12);
    const side23 = THREE.MathUtils.lerp(side12, 0.62, b23);
    const camSide = THREE.MathUtils.lerp(side23, 0.62, b34);

    const up12 = THREE.MathUtils.lerp(0.16, 0.14, b12);
    const up23 = THREE.MathUtils.lerp(up12, -0.18, b23);
    const camUp = THREE.MathUtils.lerp(up23, 0.22, b34);

    outPos
      .copy(heroCenter)
      .addScaledVector(dirHV, -dCam)
      .addScaledVector(rightHV, camSide)
      .addScaledVector(upWorld, camUp);

    outLook.copy(vistaBlend);

    const f12 = THREE.MathUtils.lerp(52.5, 54.0, b12);
    const f23 = THREE.MathUtils.lerp(f12, 53.0, b23);
    return THREE.MathUtils.lerp(f23, 55.0, b34);
  }, DURATION, 0.36);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);

    atmoUniforms.uTime.value = tGlobal;
    atmoUniforms.uCycleTime.value = tCycle;
    const swfcBoost = quintic01(11.4, 13.2, tCycle) * (1.0 - 0.45 * quintic01(15.8, 17.8, tCycle));
    atmoUniforms.uFinaleBoost.value = smoothstep01(15.2, 20.2, tCycle);

    fireworkCloudSystem.update(tGlobal);

    const thrust = THREE.MathUtils.lerp(1.12, 1.92, swfcBoost);
    const windStrength = THREE.MathUtils.lerp(1.18, 1.64, swfcBoost);

    const bankRad = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: 5.6 + swfcBoost * 2.5,
      nightLamp01: 0.94,
      tCycle,
      gazeSchedule: SH_GAZE,
      cycleLen: DURATION,
    });

    keyLight.target.position.copy(pHero);
    keyLight.position.copy(pHero).add(keySunOffset);

    for (const sl of searchlightNodes) {
      sl.mesh.rotation.z = sl.baseZ + Math.sin(tGlobal * sl.spd + sl.ph) * 0.15;
      sl.mesh.rotation.x = sl.baseX + Math.cos(tGlobal * (sl.spd * 0.82) + sl.ph) * 0.10;
    }

    let beatText = '第一幕 · 沿黄浦江经典大弧湾转弯飞入外滩 · 万国建筑金辉与人民英雄纪念塔交相辉映';
    if (camMode === 'arch_lujiazui_macro') {
      camera.fov = 50;
      camera.position.set(-22.0, 48.0, -14.0);
      camera.lookAt(68.0, 62.0, -68.0);
      camera.updateProjectionMatrix();
      beatText = '建筑微距 · 陆家嘴大弧湾摩天群（东方明珠、金茂大厦、环球金融中心、上海中心）';
    } else if (camMode === 'arch_bund_macro') {
      camera.fov = 44;
      camera.position.set(22.0, 18.0, -24.0);
      camera.lookAt(-42.0, 22.0, -78.0);
      camera.updateProjectionMatrix();
      beatText = '建筑微距 · 外滩万国建筑群、人民英雄纪念塔与外白渡桥璀璨滨江灯带';
    } else {
      applyStabilizedCam(tCycle, camera);
      if (tCycle >= 4.6 && tCycle < 10.8) {
        beatText = '第二幕 · 90° 环绕东方明珠璀璨球体 · 平稳摇镜饱览陆家嘴摩天盛景';
      } else if (tCycle >= 10.8 && tCycle < 16.2) {
        beatText = '第三幕 · 接续加速骑行 · 贴环球金融中心蓝宝石天门幕墙昂首向上攀升';
      } else if (tCycle >= 16.2) {
        beatText = '终章 · 翱翔黄浦江璀璨夜空 · 漫天金红蓝盛世菊花烟火与火烧云海振铃收官';
      }
    }

    for (let i = 0; i < WAKE_SPARK_COUNT; i++) {
      const ws = wakeSeeds[i];
      const tPast = Math.max(0.0, tCycle - ws.u * 2.40);
      heroTrack.evalSmoothedPos(tPast, tmpWakePos);
      const twk = 0.74 + 0.26 * Math.sin(tGlobal * 9.5 + ws.ph);
      dummyObj.position.set(
        tmpWakePos.x + ws.ox,
        tmpWakePos.y + ws.oy,
        tmpWakePos.z + ws.oz
      );
      dummyObj.lookAt(camera.position);
      const sc = Math.max(0.01, ws.sz * twk);
      dummyObj.scale.set(sc, sc, 1.0);
      dummyObj.updateMatrix();
      wakeInst.setMatrixAt(i, dummyObj.matrix);
    }
    wakeInst.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < omniBillboards.length; i++) {
      const ob = omniBillboards[i];
      ob.mesh.lookAt(camera.position);
      ob.mesh.rotateZ(ob.roll);
      const pulse = 0.82 + 0.26 * Math.sin(tGlobal * 1.85 + ob.phase);
      const finaleLift = i >= 8 ? THREE.MathUtils.lerp(0.80, 1.34, atmoUniforms.uFinaleBoost.value) : 1.0;
      ob.uPulse.value = pulse * finaleLift;
    }

    const mortarLead = 0.85;
    let bestShellIdx = 0;
    let bestShellLum = -1.0;

    for (let s = 0; s < SHELL_COUNT; s++) {
      const sd = shellDefs[s];
      const cx = sd.center[0], cy = sd.center[1], cz = sd.center[2];
      const age = (((tCycle - sd.tBurst) % DURATION) + DURATION) % DURATION;

      if (age <= sd.dur) {
        const uAge = age / sd.dur;
        const expFactor = 1.0 - Math.exp(-age * sd.drag);
        const fade = smoothstep01(0.0, 0.04, uAge) * Math.pow(Math.max(0.0, 1.0 - uAge), 0.72);
        const haloScale = sd.radius * (0.34 + 0.55 * expFactor) * (1.0 - uAge * 0.52);

        dummyObj.position.set(cx, cy - 0.35 * age * age, cz);
        dummyObj.lookAt(camera.position);
        const hVis = Math.max(0.001, haloScale * fade * 0.74);
        dummyObj.scale.set(hVis, hVis, 1.0);
        dummyObj.updateMatrix();
        fwHaloInst.setMatrixAt(s, dummyObj.matrix);

        if (fade > 0.22) {
          const slot = s % 4;
          if (fade > fwWaterData[slot].w * 0.6 || age < 1.5) {
            fwWaterData[slot].set(cx, cy, cz, fade * 1.30);
            fwWaterCols[slot].setHex(sd.cMain);
          }
        }
        const distHero = Math.hypot(cx - pHero.x, cz - pHero.z);
        const score = fade / (1.0 + distHero * 0.025);
        if (score > bestShellLum) {
          bestShellLum = score;
          bestShellIdx = s;
        }
      } else if (age >= DURATION - mortarLead) {
        const uL = (age - (DURATION - mortarLead)) / mortarLead;
        const headY = THREE.MathUtils.lerp(6.0, cy, 1.0 - Math.pow(1.0 - uL, 1.65));
        dummyObj.position.set(cx, headY, cz);
        dummyObj.lookAt(camera.position);
        const crownSz = 6.2 + 4.0 * Math.sin(uL * Math.PI);
        dummyObj.scale.set(crownSz, crownSz, 1.0);
        dummyObj.updateMatrix();
        fwHaloInst.setMatrixAt(s, dummyObj.matrix);
      } else {
        dummyObj.position.set(0, -500, 0);
        dummyObj.scale.setScalar(0.001);
        dummyObj.updateMatrix();
        fwHaloInst.setMatrixAt(s, dummyObj.matrix);
      }
    }
    fwHaloInst.instanceMatrix.needsUpdate = true;

    const activeSd = shellDefs[bestShellIdx];
    const pulseGold = 3.3 + 1.2 * Math.sin(tGlobal * 7.2) * Math.sin(tGlobal * 3.1) + swfcBoost * 1.2;
    const pulseCrim = 2.6 + 1.0 * Math.cos(tGlobal * 6.0 + 1.2) + swfcBoost * 1.0;
    const pulseCyan = 2.2 + 0.8 * Math.sin(tGlobal * 8.2 + 2.5) + swfcBoost * 0.9;

    fwHeroLightGold.position.set(pHero.x - 4.5, pHero.y + 5.5, pHero.z + 3.5);
    fwHeroLightGold.intensity = pulseGold;

    fwHeroLightCrimson.position.set(
      THREE.MathUtils.lerp(pHero.x + 7.5, activeSd.center[0], 0.22),
      pHero.y + 3.5,
      THREE.MathUtils.lerp(pHero.z - 2.5, activeSd.center[2], 0.22)
    );
    fwHeroLightCrimson.intensity = pulseCrim;

    fwHeroLightCyan.position.set(pHero.x + 5.0, pHero.y + 6.0, pHero.z - 5.5);
    fwHeroLightCyan.intensity = pulseCyan;

    return { beatText };
  }

  await applyStationHdPbrUpgrade(8, group, renderer);

  return {
    id: 8,
    slug: 'shanghai',
    nameZh: '上海外滩烟花',
    titleZh: '上海陆家嘴外滩 · 漫天烟花振铃终章',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.96,
    fogColor: new THREE.Color(0x0a1026),
    fogDensity: 0.0010,
    exposure: 1.05,
    transitionColor: '#fff4d6',
    omniVideos: [omniFwChrys.vid, omniFwGold.vid, omniFwCyan.vid],
    stageTris,
    stageLayout,
    heroTrack,
    update,
  };
}
