// ============================================================================
// V3 STATION 06: 敦煌月牙泉 · 熔金大漠落日晴霞
// (DUNHUANG CRESCENT MOON OASIS, S-CURVED SINGING SAND DUNE & 12-CAMEL CARAVAN)
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
  group.name = 'Station06_Dunhuang_V3';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 16.0;

  // Low grazing golden-hour desert sun (~7.2 deg elevation in upper-right forward sky, matching `s6_dunhuang_ref_board.jpg`!
  // Illuminates windward dune slopes in molten honey-ochre `#d8943a` and carves crisp warm bronze-amber slip-face shadows `#6b421b`!)
  const SUN_POS = new THREE.Vector3(165.0, 24.0, -230.0);
  const SUN_DIR = SUN_POS.clone().normalize();

  // 1. Molten-Gold Silk Road Desert Sunset 360° Sky Dome (`dh_golden_sunset_panorama.jpg`)
  const skyTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene6_dunhuang/dh_golden_sunset_panorama.jpg', resolve, undefined, reject);
  });
  skyTex.colorSpace = THREE.SRGBColorSpace;
  skyTex.wrapS = THREE.RepeatWrapping;
  skyTex.wrapT = THREE.ClampToEdgeWrapping;

  const atmoUniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: SUN_DIR },
  };

  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSkyMap: { value: skyTex },
      uSunDir: atmoUniforms.uSunDir,
      uTime: atmoUniforms.uTime,
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
        float h = clamp(d.y, -0.15, 1.0);
        vec3 sunDirN = normalize(uSunDir);
        float mu = max(0.0, dot(d, sunDirN));

        // Preserve rich dappled sunset clouds & warm slate-cerulean upper sky from NB2.1 panorama!
        vec3 sunHorizon   = vec3(0.99, 0.80, 0.44);
        vec3 sideHorizon  = vec3(0.88, 0.68, 0.40);
        float azSun = smoothstep(-0.6, 0.9, dot(normalize(vec2(d.x, d.z)), normalize(vec2(sunDirN.x, sunDirN.z))));
        vec3 horizonBand  = mix(sideHorizon, sunHorizon, azSun);
        vec3 warmMidSky   = mix(vec3(0.58, 0.60, 0.62), vec3(0.95, 0.74, 0.44), azSun * 0.68);
        vec3 slateZenith  = vec3(0.24, 0.42, 0.64);

        vec3 grad = mix(horizonBand, warmMidSky, smoothstep(0.005, 0.16, h));
        grad = mix(grad, slateZenith, smoothstep(0.16, 0.58, h));
        vec3 col = mix(texCol * 0.96, grad, 0.22);

        // Crisp blazing desert sunset solar disc + controlled golden Mie corona (never washes out cloud detail!)
        float sunDisc = smoothstep(0.9985, 0.9997, mu);
        float innerGlow = pow(mu, 64.0) * 0.68;
        float wideHalo = pow(mu, 8.5) * 0.22;
        float horizonGlow = exp(-pow(abs(d.y - 0.06) * 7.5, 2.0)) * pow(mu, 2.2) * 0.20;

        col += vec3(1.00, 0.72, 0.30) * (wideHalo + horizonGlow);
        col += vec3(1.00, 0.90, 0.62) * innerGlow;
        col += vec3(1.00, 0.98, 0.88) * sunDisc * 1.95;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 56, 36), skyDomeMat);
  skyDome.rotation.y = -Math.atan2(SUN_DIR.z, SUN_DIR.x) - Math.PI * 0.5;
  group.add(skyDome);

  // PMREM Molten-Gold Sunset + Golden Mingsha Sand Bounce Environment Map
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
    addCard([18, 8, -24],  [22, 12], 0xffe098); // Warm golden sun key bounce
    addCard([-20, 14, 12], [18, 12], 0xb88b58); // Warm bronze-amber fill (zero purple!)
    addCard([0, -14, 0],   [34, 34], 0xd8943a); // Molten golden Mingsha sand bounce
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.035).texture;
    pmrem.dispose();
  }

  // 2. High-Contrast Grazing Golden-Hour Lighting Rig (`#d8943a` sunlit gold / `#6b421b` crisp warm bronze slip-faces!)
  const hemiLight = new THREE.HemisphereLight(0xffebc4, 0xb8722a, 0.36);
  group.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffc970, 4.15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -68;
  sunLight.shadow.camera.right = 68;
  sunLight.shadow.camera.top = 56;
  sunLight.shadow.camera.bottom = -56;
  sunLight.shadow.camera.near = 2.0;
  sunLight.shadow.camera.far = 230.0;
  sunLight.shadow.bias = -0.00035;
  group.add(sunLight);
  group.add(sunLight.target);

  // Subtle warm bronze-amber sky/sand bounce on leeward slip-faces (keeps shadows rich #6b421b bronze, never washed out!)
  const bronzeFillLight = new THREE.DirectionalLight(0xb87330, 0.28);
  bronzeFillLight.position.set(-92, 36, 78);
  group.add(bronzeFillLight);

  // Warm golden sand upward bounce onto Pelican's white belly plumage & vintage red bicycle
  const sandBounceLight = new THREE.DirectionalLight(0xe29c44, 0.34);
  sandBounceLight.position.set(6, -32, 8);
  group.add(sandBounceLight);

  // Warm golden-amber lantern glow inside Yueya Pavilion & Oasis garden walkway
  const pavilionLanternLight = new THREE.PointLight(0xffb44c, 12.5, 36.0, 1.45);
  pavilionLanternLight.position.set(4.5, 5.5, -31.5);
  group.add(pavilionLanternLight);

  const waterfrontLanternLight = new THREE.PointLight(0xffc466, 8.5, 28.0, 1.5);
  waterfrontLanternLight.position.set(12.5, 2.8, -24.0);
  group.add(waterfrontLanternLight);

  // 3. Load V3 Dunhuang 3D Stage GLB + Layout JSON + NB2.1 Golden Sand Ripple Normal Map
  const layoutRes = await fetch('./assets/soarin_scene6_dunhuang/dunhuang_stage_layout.json');
  const stageLayout = await layoutRes.json();

  const dhGltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/soarin_scene6_dunhuang/dunhuang_hero_stage.glb', resolve, undefined, reject);
  });

  const sandNormalTex = await new Promise((resolve, reject) => {
    texLoader.load('./assets/soarin_scene6_dunhuang/dh_golden_sand_normal.jpg', resolve, undefined, reject);
  });
  sandNormalTex.wrapS = THREE.RepeatWrapping;
  sandNormalTex.wrapT = THREE.RepeatWrapping;

  const dhMatsConfigured = new Set();
  let protoHuyangBarkGeo = null, protoHuyangBarkMat = null;
  let protoHuyangFolGeo = null, protoHuyangFolMat = null;
  let waterMesh = null;
  let reflRT = null;
  let stageTris = 0;

  dhGltf.scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const m = obj.material;
    if (m && !dhMatsConfigured.has(m.uuid)) {
      dhMatsConfigured.add(m.uuid);
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }

      if (m.name && (m.name.includes('Foliage') || m.name.includes('Meadow'))) {
        const rep = m.name.includes('Meadow') ? 3.5 : 2.6;
        for (const tk of ['map', 'normalMap', 'roughnessMap']) {
          if (m[tk]) {
            m[tk].wrapS = THREE.RepeatWrapping;
            m[tk].wrapT = THREE.RepeatWrapping;
            m[tk].repeat.set(rep, rep);
          }
        }
        if (m.normalScale) m.normalScale.set(1.65, 1.65);
      }

      // Gentle Silk Road golden-hour breeze on lush oasis crowns & shoreline reeds
      if (m.name && (m.name.includes('Foliage') || m.name.includes('Reed'))) {
        const amp = m.name.includes('Reed') ? 0.075 : 0.050;
        m.customProgramCacheKey = () => 'dh_v3_breeze_' + m.name;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uTime = atmoUniforms.uTime;
          shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vec3 fwPos = (modelMatrix * vec4(position, 1.0)).xyz;
             float hWeight = clamp(fwPos.y * 0.42, 0.0, 1.35);
             transformed.x += sin(uTime * 2.2 + fwPos.x * 0.55 + fwPos.z * 0.45) * ${amp.toFixed(3)} * hWeight;
             transformed.z += cos(uTime * 1.85 + fwPos.z * 0.50) * ${(amp * 0.75).toFixed(3)} * hWeight;`
          );
        };
        m.needsUpdate = true;
      }
    }

    if (obj.name === 'Proto_Huyang_Bark') {
      protoHuyangBarkGeo = obj.geometry;
      protoHuyangBarkMat = obj.material;
      obj.visible = false;
      return;
    }
    if (obj.name === 'Proto_Huyang_Foliage') {
      protoHuyangFolGeo = obj.geometry;
      protoHuyangFolMat = obj.material;
      obj.visible = false;
      return;
    }
    if (obj.name === 'DH_Crescent_Water_Surface') {
      waterMesh = obj;
      const wg = obj.geometry;
      stageTris += wg.index ? wg.index.count / 3 : wg.attributes.position.count / 3;
      return;
    }

    const isGlow = obj.name.includes('Glow');
    const isOuter = obj.name.includes('Outer_Desert');
    obj.castShadow = !isGlow && !isOuter;
    obj.receiveShadow = !isGlow;
    const g = obj.geometry;
    stageTris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  group.add(dhGltf.scene);

  // Scatter inner oasis-peninsula lush trees via GPU InstancedMesh
  if (protoHuyangBarkGeo && protoHuyangFolGeo && stageLayout.scatter_huyang?.length) {
    const nH = stageLayout.scatter_huyang.length;
    const instBark = new THREE.InstancedMesh(protoHuyangBarkGeo, protoHuyangBarkMat, nH);
    const instFol = new THREE.InstancedMesh(protoHuyangFolGeo, protoHuyangFolMat, nH);
    instBark.castShadow = false;
    instBark.receiveShadow = false;
    instFol.castShadow = false;
    instFol.receiveShadow = false;
    const dummy = new THREE.Object3D();
    stageLayout.scatter_huyang.forEach((it, i) => {
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
  }

  const sampleTerrainY = createSurfaceHeightSampler(
    dhGltf.scene,
    (name) => name.includes('SandDunes') || name.includes('Outer_Desert') || name.includes('Pavilion_Roofs')
  );

  // 4. Real-Time 512x512 Planar Mirror Reflection on Crescent Moon Spring (#0b8b82 Mineral Emerald-Teal!)
  if (waterMesh) {
    reflRT = new THREE.WebGLRenderTarget(320, 320, {
      samples: 0,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const virtualCamera = new THREE.PerspectiveCamera();
    const textureMatrix = new THREE.Matrix4();
    const waterNormal = new THREE.Vector3(0, 1, 0);
    const waterWorldPos = new THREE.Vector3(0, 0.05, 0);
    const camWorldPos = new THREE.Vector3();
    const rotMat = new THREE.Matrix4();
    const lookAtPos = new THREE.Vector3();
    const viewVec = new THREE.Vector3();
    const targetVec = new THREE.Vector3();
    const reflPlane = new THREE.Plane();
    const clipVec = new THREE.Vector4();
    const qVec = new THREE.Vector4();

    const crescentWaterMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        tReflection: { value: reflRT.texture },
        textureMatrix: { value: textureMatrix },
        uTime: atmoUniforms.uTime,
        uSunDir: atmoUniforms.uSunDir,
        uRippleNormal: { value: sandNormalTex },
      },
      vertexShader: `
        #include <fog_pars_vertex>
        uniform mat4 textureMatrix;
        varying vec4 vReflUv;
        varying vec3 vWorldPos;
        varying vec2 vDepthUv;
        void main() {
          vDepthUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          vReflUv = textureMatrix * wp;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: `
        #include <fog_pars_fragment>
        uniform sampler2D tReflection;
        uniform sampler2D uRippleNormal;
        uniform float uTime;
        uniform vec3 uSunDir;
        varying vec4 vReflUv;
        varying vec3 vWorldPos;
        varying vec2 vDepthUv;

        void main() {
          float depth01 = clamp(vDepthUv.x, 0.0, 1.0);
          vec2 uv1 = vWorldPos.xz * 0.15 + vec2(uTime * 0.032, -uTime * 0.020);
          vec2 uv2 = vWorldPos.xz * 0.28 + vec2(-uTime * 0.024, uTime * 0.028);
          vec3 n1 = texture2D(uRippleNormal, uv1).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(uRippleNormal, uv2).xyz * 2.0 - 1.0;
          vec2 ripple = (n1.xy + n2.xy) * 0.5;
          vec3 N = normalize(vec3(ripple.x * 0.075, 1.0, ripple.y * 0.075));

          vec4 projUv = vReflUv;
          projUv.xy += ripple * 0.020 * projUv.w;
          vec3 reflCol = texture2DProj(tReflection, max(projUv, vec4(0.001))).rgb;

          // Vivid Dunhuang Crescent Moon Spring mineral emerald-teal (#0b8b82) volume palette!
          vec3 shallowAqua    = vec3(0.105, 0.675, 0.615);
          vec3 midEmeraldTeal = vec3(0.043, 0.545, 0.510); // Exact #0b8b82 mineral emerald-teal
          vec3 deepJadeTeal   = vec3(0.020, 0.365, 0.385);
          vec3 springBody = mix(shallowAqua, midEmeraldTeal, smoothstep(0.04, 0.40, depth01));
          springBody = mix(springBody, deepJadeTeal, smoothstep(0.42, 0.96, depth01));

          vec3 V = normalize(cameraPosition - vWorldPos);
          float ndotv = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = mix(0.14, 0.64, pow(1.0 - ndotv, 3.0));

          vec3 H = normalize(normalize(uSunDir) + V);
          float sunSpec = pow(max(0.0, dot(N, H)), 135.0) * 1.25;
          float warmSkySheen = pow(max(0.0, dot(N, H)), 16.0) * 0.14;

          vec3 col = mix(springBody, reflCol * 0.96, fresnel);
          col += vec3(1.00, 0.86, 0.54) * (sunSpec + warmSkySheen);

          float alpha = smoothstep(0.0, 0.06, depth01);
          gl_FragColor = vec4(col, alpha);
          #include <fog_fragment>
        }
      `,
    });

    waterMesh.material = crescentWaterMat;
    waterMesh.renderOrder = 1;

    let isRenderingRefl = false;
    waterMesh.onBeforeRender = (rndr, scn, cam) => {
      if (isRenderingRefl || !reflRT) return;
      camWorldPos.setFromMatrixPosition(cam.matrixWorld);
      if (camWorldPos.y <= 0.08) return;

      isRenderingRefl = true;
      viewVec.subVectors(waterWorldPos, camWorldPos);
      viewVec.reflect(waterNormal).negate().add(waterWorldPos);

      rotMat.extractRotation(cam.matrixWorld);
      lookAtPos.set(0, 0, -1).applyMatrix4(rotMat).add(camWorldPos);
      targetVec.subVectors(waterWorldPos, lookAtPos).reflect(waterNormal).negate().add(waterWorldPos);

      virtualCamera.position.copy(viewVec);
      virtualCamera.up.set(0, 1, 0).applyMatrix4(rotMat).reflect(waterNormal);
      virtualCamera.lookAt(targetVec);
      virtualCamera.near = cam.near;
      virtualCamera.far = cam.far;
      virtualCamera.updateMatrixWorld();
      virtualCamera.projectionMatrix.copy(cam.projectionMatrix);

      textureMatrix.set(
        0.5, 0.0, 0.0, 0.5,
        0.0, 0.5, 0.0, 0.5,
        0.0, 0.0, 0.5, 0.5,
        0.0, 0.0, 0.0, 1.0
      );
      textureMatrix.multiply(virtualCamera.projectionMatrix);
      textureMatrix.multiply(virtualCamera.matrixWorldInverse);

      reflPlane.setFromNormalAndCoplanarPoint(waterNormal, waterWorldPos);
      reflPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
      clipVec.set(reflPlane.normal.x, reflPlane.normal.y, reflPlane.normal.z, reflPlane.constant);
      const pm = virtualCamera.projectionMatrix;
      qVec.x = (Math.sign(clipVec.x) + pm.elements[8]) / pm.elements[0];
      qVec.y = (Math.sign(clipVec.y) + pm.elements[9]) / pm.elements[5];
      qVec.z = -1.0;
      qVec.w = (1.0 + pm.elements[10]) / pm.elements[14];
      clipVec.multiplyScalar(2.0 / clipVec.dot(qVec));
      pm.elements[2] = clipVec.x;
      pm.elements[6] = clipVec.y;
      pm.elements[10] = clipVec.z + 1.0 - 0.0005;
      pm.elements[14] = clipVec.w;

      waterMesh.visible = false;
      const heroGrp = scn.getObjectByName('PelicanHeroFlightRoot');
      const prevHeroVis = heroGrp ? heroGrp.visible : false;
      if (heroGrp) heroGrp.visible = false;
      const prevRT = rndr.getRenderTarget();
      const prevXr = rndr.xr.enabled;
      const prevShadowAuto = rndr.shadowMap.autoUpdate;
      rndr.xr.enabled = false;
      rndr.shadowMap.autoUpdate = false;
      rndr.setRenderTarget(reflRT);
      rndr.state.buffers.depth.setMask(true);
      if (rndr.autoClear === false) rndr.clear();
      rndr.render(scn, virtualCamera);
      rndr.xr.enabled = prevXr;
      rndr.shadowMap.autoUpdate = prevShadowAuto;
      rndr.setRenderTarget(prevRT);
      if (cam.viewport) rndr.state.viewport(cam.viewport);
      if (heroGrp) heroGrp.visible = prevHeroVis;
      waterMesh.visible = true;
      isRenderingRefl = false;
    };
  }

  // 5. Sunlit Golden Sunset Cumulus Clouds on Exit Horizon (`createVolumetricCloudSystem`, well-spaced fluffy banks!)
  const cumulusSystem = createVolumetricCloudSystem({
    sunDir: SUN_DIR,
    litColor: 0xffefd0,    // Sunlit cream-gold
    shadowColor: 0xb07c4e, // Rich warm bronze-apricot cloud underside for crisp cloud depth!
    rimColor: 0xffcf70,    // Golden silver lining
    opacity: 0.56,
    seed: 6088,
    clusters: [
      { center: [-135, 48, -235], radius: [42,  9, 20], puffs: 16, scale: [16, 30] },
      { center: [ -52, 52, -250], radius: [40,  9, 20], puffs: 16, scale: [16, 30] },
      { center: [  65, 50, -245], radius: [40,  9, 20], puffs: 16, scale: [16, 30] },
      { center: [ 155, 46, -230], radius: [38,  8, 18], puffs: 14, scale: [15, 28] },
      // Gentle exit cloud banks flanking the desert crossing (`t = 14..16s`)
      { center: [ -32, 32, -162], radius: [22,  6, 16], puffs: 14, scale: [10, 20] },
      { center: [  36, 33, -165], radius: [22,  6, 16], puffs: 14, scale: [10, 20] },
      { center: [   2, 29, -182], radius: [28,  7, 18], puffs: 16, scale: [12, 22] },
    ],
  });
  group.add(cumulusSystem.mesh);

  // Subtle low-skimming Omni wind-blown golden sand mist along desert crests
  const omniStardust = createLoopingVideoTexture('./assets/soarin_scene6_dunhuang/dh_omni_golden_sand_stardust.mp4');
  const omniSandVeilMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: {
      uVid: { value: omniStardust.vTex },
      uTint: { value: new THREE.Color(0xffd685) },
      uOpacity: { value: 0.22 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uVid;
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uVid, vUv).rgb;
        float luma = max(c.r, max(c.g, c.b));
        float fx = smoothstep(0.05, 0.28, vUv.x) * smoothstep(0.95, 0.72, vUv.x);
        float fy = smoothstep(0.08, 0.30, vUv.y) * smoothstep(0.92, 0.70, vUv.y);
        float w = smoothstep(0.05, 0.58, luma) * fx * fy * uOpacity;
        gl_FragColor = vec4(c * uTint * w * 1.15, w);
      }
    `,
  });
  const omniVeilGroup = new THREE.Group();
  group.add(omniVeilGroup);
  for (const cfg of [
    { pos: [-18.5, 14.8, -52.0], scale: [16, 4.5], rotY:  0.22, rotZ:  0.04 },
    { pos: [ -6.0, 16.5, -92.0], scale: [22, 5.5], rotY:  0.10, rotZ:  0.05 },
    { pos: [  4.0, 18.5,-126.0], scale: [24, 6.0], rotY: -0.12, rotZ:  0.04 },
  ]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(cfg.scale[0], cfg.scale[1]), omniSandVeilMat);
    m.position.set(...cfg.pos);
    m.rotation.set(0, cfg.rotY, cfg.rotZ);
    m.renderOrder = 4;
    omniVeilGroup.add(m);
  }

  // 6. V3 Protagonist-First Wide-Angle IMAX Choreography (`DURATION = 16.0s`, `FOV = 50.5°`, `0.0°` Roll):
  //    Matches `pelican_soarin_china_1min.mp4` & `s6_dunhuang_ref_board.jpg` 1:1 (`注意鹈鹕的比例和运镜，鹈鹕是主角`):
  //    - Camera stays `~3.00m – 3.15m` from Pelican using a wide `50.5°` lens so Pelican + Bicycle fills `43%–48%`
  //      of the vertical frame as the unmistakable foreground STAR PROTAGONIST across ALL beats!
  //    - Simultaneously, the wide-angle lens frames the ENTIRE emerald Crescent Moon Spring, curved wooden boardwalk,
  //      lush green oasis belt, 4-story Yueya Pavilion & 12-Camel S-Dune right behind/below Pelican (`看到后面的月牙泉，远景环绕`),
  //      then glides across the golden sunset Barchan sand dunes into warm cumulus cloud mist (`穿过沙漠来到重庆`)!
  const heroKeyframes = [
    { t:  0.0, pos: [ 36.0, 19.6,   4.5] }, // Wide East-SE panoramic entry
    { t:  2.0, pos: [ 23.5, 18.6,  18.5] }, // SE panoramic overlook (QA t = 2.0s: 3/4 front-left protagonist + Oasis behind!)
    { t:  5.8, pos: [  1.0, 18.0,  22.5] }, // Signature South hero overlook (QA t = 5.8s: 1:1 with `s6_dunhuang_ref_board.jpg`!)
    { t:  7.6, pos: [-16.5, 18.4,  17.5] }, // Rounding SW arc smoothly in 3/4 profile
    { t:  9.4, pos: [-31.5, 19.2,  -2.0] }, // West S-Dune & 12-Camel Caravan panoramic overlook (QA t = 9.4s)
    { t: 11.2, pos: [-31.0, 19.4, -36.0] }, // Turning smoothly North across the golden desert (`穿过沙漠`)
    { t: 13.8, pos: [-27.5, 19.6, -84.0] }, // Heroic 65-deg side-profile desert crossing over golden Barchan dunes (QA t = 13.8s)
    { t: 16.0, pos: [-22.5, 21.2,-134.0] }, // Entering warm sunlit golden sunset cloud mist (`来到重庆`)
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.38,
    bankGain: 0.40,
    maxBankRad: 0.18,
  });

  // 420-Mote World-Space Curved Golden Stardust Wake (`金色星尘弧形尾迹`, matching `s6_dunhuang_ref_board.jpg` bottom panels!)
  const WAKE_COUNT = 420;
  const wakeGeo = new THREE.PlaneGeometry(0.20, 0.20);
  const wakeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vUv = uv;
        vec4 mvCenter = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float sc = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
        vAlpha = clamp(sc * 1.15, 0.0, 1.0);
        mvCenter.xy += position.xy * sc;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float core = exp(-r * r * 6.0);
        float halo = pow(max(0.0, 1.0 - r), 2.5) * 0.68;
        float lum = (core + halo) * vAlpha;
        vec3 col = mix(vec3(1.00, 0.72, 0.22), vec3(1.00, 0.97, 0.84), core);
        gl_FragColor = vec4(col * lum * 1.25, clamp(lum, 0.0, 1.0));
      }
    `,
  });
  const wakeMesh = new THREE.InstancedMesh(wakeGeo, wakeMat, WAKE_COUNT);
  wakeMesh.visible = false;

  let wSeed = 60612;
  const wRand = () => { wSeed = (wSeed * 16807) % 2147483647; return (wSeed - 1) / 2147483646; };
  const wakeSeeds = Array.from({ length: WAKE_COUNT }, (_, i) => ({
    baseU: i / WAKE_COUNT,
    speed: 0.32 + wRand() * 0.16,
    latOff: (wRand() - 0.5) * 1.45,
    upOff: (wRand() - 0.52) * 0.95,
    freq: 1.8 + wRand() * 2.6,
    phase: wRand() * 6.283,
    size: 0.60 + wRand() * 1.15,
  }));
  const dummyWake = new THREE.Object3D();
  const tmpWakePos = new THREE.Vector3();
  const tmpWakeTang = new THREE.Vector3();

  const DH_GAZE = [
    { t:  0.0, yaw:  0.22, pitch:  0.12 },
    { t:  4.5, yaw:  0.20, pitch:  0.10 },
    { t:  8.8, yaw:  0.24, pitch:  0.08 },
    { t: 11.8, yaw:  0.08, pitch: -0.05 },
    { t: 14.5, yaw:  0.02, pitch: -0.08 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();
  const pChest = new THREE.Vector3();
  const vFwdOrbit = new THREE.Vector3();
  const vFwdDesert = new THREE.Vector3();
  const vFwd = new THREE.Vector3();
  const vRight = new THREE.Vector3();
  const vUp = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);

  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);
    // Visual protagonist center of Pelican + Vintage Red Bicycle (`y_local = 0.0` tire bottom .. `1.32` aviator cap)
    pChest.set(tmpH.x, tmpH.y + 0.62, tmpH.z);

    // 1. Orbit view direction (`0.0s – 10.8s`): aims across Pelican toward Crescent Moon Spring + Yueya Pavilion
    //    with `-14.6°` downward pitch so top ~23% is sunset sky/clouds & 100% of Crescent Moon Spring fits below!
    const westSweep01 = smoothstep01(6.8, 9.8, tc);
    const aimOx = THREE.MathUtils.lerp(2.0, 4.5, westSweep01);
    const aimOz = THREE.MathUtils.lerp(-21.5, -24.5, westSweep01);
    let odx = aimOx - tmpH.x;
    let odz = aimOz - tmpH.z;
    const odLen = Math.hypot(odx, odz) || 1.0;
    odx /= odLen;
    odz /= odLen;
    const orbitPitchY = THREE.MathUtils.lerp(-0.252, -0.242, westSweep01);
    const orbitHorizScale = Math.sqrt(Math.max(0.01, 1.0 - orbitPitchY * orbitPitchY));
    vFwdOrbit.set(odx * orbitHorizScale, orbitPitchY, odz * orbitHorizScale).normalize();

    // 2. Desert crossing view direction (`10.8s – 16.0s`): aims ~66° East of Pelican's Northward heading
    //    so Pelican rides as a commanding 46%-height side-profile protagonist across sunlit golden Barchan dunes & blazing sun!
    const desYaw = Math.atan2(tmpHz.x, tmpHz.z) - 1.15;
    const desPitchY = -0.115;
    const desHorizScale = Math.sqrt(1.0 - desPitchY * desPitchY);
    vFwdDesert.set(Math.sin(desYaw) * desHorizScale, desPitchY, Math.cos(desYaw) * desHorizScale).normalize();

    const bDes = quintic01(9.9, 12.6, tc);
    vFwd.copy(vFwdOrbit).lerp(vFwdDesert, bDes).normalize();
    vRight.crossVectors(vFwd, worldUp).normalize();
    vUp.crossVectors(vRight, vFwd).normalize();

    const fovDeg = THREE.MathUtils.lerp(51.0, 50.0, bDes);
    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(fovDeg * 0.5));
    const tanHalfH = tanHalfV * (16.0 / 9.0);

    // Lock Pelican + Bicycle at `zHero = 2.98m – 3.08m` (~45%–48% of screen height!) on the foreground left-third
    // (`xNdc = -0.33`, `yNdc = -0.03`..`+0.04`), leaving Yueya Pavilion, Crescent Moon Spring & 12-Camel Caravan 100% open!
    const zHero = THREE.MathUtils.lerp(2.98, 3.06, bDes);
    const xNdc = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(-0.33, -0.28, westSweep01),
      -0.28,
      bDes
    );
    const yNdc = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(-0.03, 0.04, westSweep01),
      -0.02,
      bDes
    );

    outPos
      .copy(pChest)
      .addScaledVector(vFwd, -zHero)
      .addScaledVector(vRight, -xNdc * zHero * tanHalfH)
      .addScaledVector(vUp, -yNdc * zHero * tanHalfV);

    outLook.copy(outPos).addScaledVector(vFwd, 28.0);
    return fovDeg;
  }, DURATION, 0.48);

  function update(tLocal, tGlobal, pelicanRig, camera, camMode = 'director') {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);

    atmoUniforms.uTime.value = tGlobal;
    cumulusSystem.update(tGlobal);

    const desertBoost = quintic01(10.6, 12.8, tCycle);
    const thrust = THREE.MathUtils.lerp(0.0, 0.42, desertBoost);
    const windStrength = THREE.MathUtils.lerp(1.18, 1.50, desertBoost);
    const nightLamp01 = THREE.MathUtils.lerp(0.70, 0.54, desertBoost);

    const bankRad = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz);
    pelicanRig.update(tGlobal, {
      position: pHero,
      tangent: vTang,
      bankRad,
      thrust,
      windStrength,
      pedalRate: 5.6 + desertBoost * 1.6,
      nightLamp01,
      tCycle,
      gazeSchedule: DH_GAZE,
      cycleLen: DURATION,
    });

    // Update 420-mote curved world-space golden stardust wake trailing Pelican's trajectory over the oasis!
    for (let i = 0; i < WAKE_COUNT; i++) {
      const ws = wakeSeeds[i];
      const u = (ws.baseU + tGlobal * ws.speed) % 1.0;
      const lagSec = 0.05 + u * 3.60;
      const tPast = Math.max(0.0, tCycle - lagSec);
      heroTrack.evaluate(tPast, tmpWakePos, tmpWakeTang, null);
      const rxW = -tmpWakeTang.z;
      const rzW = tmpWakeTang.x;
      const spread = Math.pow(u, 0.72);
      const swirlX = Math.sin(tGlobal * ws.freq + ws.phase) * 0.30 * spread;
      const swirlY = Math.cos(tGlobal * (ws.freq * 0.85) + ws.phase) * 0.22 * spread;
      dummyWake.position.set(
        tmpWakePos.x + rxW * (ws.latOff * spread + swirlX),
        tmpWakePos.y - 0.12 - u * 1.65 + ws.upOff * spread + swirlY,
        tmpWakePos.z + rzW * (ws.latOff * spread + swirlX)
      );
      const twinkle = 0.64 + 0.36 * Math.sin(tGlobal * 7.5 + ws.phase * 3.0);
      const env = Math.sin(Math.PI * Math.pow(u, 0.62)) * (tCycle > 0.15 ? 1.0 : tCycle / 0.15);
      dummyWake.scale.setScalar(Math.max(0.008, ws.size * env * twinkle));
      dummyWake.updateMatrix();
      wakeMesh.setMatrixAt(i, dummyWake.matrix);
    }
    wakeMesh.instanceMatrix.needsUpdate = true;

    sunLight.target.position.set(
      THREE.MathUtils.lerp(0.0, pHero.x, desertBoost),
      THREE.MathUtils.lerp(6.0, pHero.y, desertBoost),
      THREE.MathUtils.lerp(-22.0, pHero.z, desertBoost)
    );
    sunLight.position.copy(sunLight.target.position).addScaledVector(SUN_DIR, 96.0);
    pavilionLanternLight.intensity = 12.0 + Math.sin(tGlobal * 3.8) * 0.8;

    const isCaravanMacro = camMode === 'macro_camel_caravan';
    omniVeilGroup.visible = !isCaravanMacro;
    wakeMesh.visible = !isCaravanMacro;

    if (camMode === 'macro_crescent_pavilion') {
      camera.fov = 42;
      camera.position.set(27.5, 11.8, -1.5);
      camera.lookAt(5.0, 4.8, -27.5);
      camera.updateProjectionMatrix();
      return { beatText: '绿洲微距 · 翡翠月牙泉镜面倒影、浓密翠绿洲林带、环泉木栈道与四层重檐月牙阁' };
    }
    if (isCaravanMacro) {
      camera.fov = 38;
      camera.position.set(-34.0, 20.5, -4.0);
      camera.lookAt(-20.5, 15.2, -27.0);
      camera.updateProjectionMatrix();
      return { beatText: '丝路微距 · 鸣沙山S形刀锋金脊十二峰双峰骆驼商队、牵驼行者与沙脊足迹' };
    }

    applyStabilizedCam(tCycle, camera);

    const cloudExit01 = quintic01(14.0, 15.9, tCycle);
    cumulusSystem.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.56, 0.82, cloudExit01);
    omniSandVeilMat.uniforms.uOpacity.value = THREE.MathUtils.lerp(0.20, 0.38, cloudExit01);

    let beatText = '第一幕 · 熔金落日晴霞豁然见绿洲 · 远景环绕翡翠月牙泉与浓密翠林月牙阁';
    if (tCycle >= 4.2 && tCycle < 10.8) {
      beatText = '第二幕 · 远景环绕大漠明珠 · S形刀锋沙脊十二峰丝路驼队、月牙泉倒影与金色星尘同框';
    } else if (tCycle >= 10.8) {
      beatText = '第三幕 · 飞驰穿越金色起伏鸣沙山海 · 沐落日晴霞云雾飞向山城重庆';
    }
    return {
      beatText,
      fogDensityOverride: THREE.MathUtils.lerp(0.0012, 0.0042, cloudExit01),
    };
  }

  function measureClearanceProfile() {
    let minHeroClr = 999.0;
    let minCamClr = 999.0;
    let minCamHeroDist = 999.0;
    let maxCamHeroDist = 0.0;
    const pTest = new THREE.Vector3();
    const tTest = new THREE.Vector3();
    const hTest = new THREE.Vector3();
    const dummyCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 950);
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * DURATION;
      heroTrack.evaluate(t, pTest, tTest, hTest);
      const gyH = sampleTerrainY(pTest.x, pTest.z, 120.0, 0.0);
      minHeroClr = Math.min(minHeroClr, pTest.y - gyH);
      applyStabilizedCam(t, dummyCam);
      const gyC = sampleTerrainY(dummyCam.position.x, dummyCam.position.z, 120.0, 0.0);
      minCamClr = Math.min(minCamClr, dummyCam.position.y - gyC);
      const dCH = dummyCam.position.distanceTo(new THREE.Vector3(pTest.x, pTest.y + 0.62, pTest.z));
      minCamHeroDist = Math.min(minCamHeroDist, dCH);
      maxCamHeroDist = Math.max(maxCamHeroDist, dCH);
    }
    return {
      minHeroClearanceM: +minHeroClr.toFixed(2),
      minCameraClearanceM: +minCamClr.toFixed(2),
      camToPelicanDistRangeM: [+minCamHeroDist.toFixed(2), +maxCamHeroDist.toFixed(2)],
      hasRenderTargetDispose: typeof dispose === 'function',
    };
  }

  function dispose() {
    if (reflRT) {
      reflRT.dispose();
      reflRT = null;
    }
  }

  await applyStationHdPbrUpgrade(6, group, renderer);

  return {
    id: 6,
    slug: 'dunhuang',
    nameZh: '敦煌月牙泉',
    titleZh: '敦煌月牙泉 · 熔金大漠落日晴霞',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.52,
    fogColor: new THREE.Color(0xe6b46e),
    fogDensity: 0.0012,
    exposure: 1.02,
    transitionColor: '#dfa055',
    omniVideos: [omniStardust.vid],
    stageTris: Math.round(stageTris),
    measureClearanceProfile,
    dispose,
    update,
  };
}
