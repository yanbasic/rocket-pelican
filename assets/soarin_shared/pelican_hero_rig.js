// ============================================================================
// SHARED PRODUCTION v6 PELICAN ROCKET BIKE HERO RIG MODULE
// - Exact coaxial rocket-booster nozzle flame anchoring at `[±0.148, 0.672, -0.7685]`
//   (scales strictly around each individual nozzle exit mouth — zero origin drift!)
// - Silky camera-facing 3D aerodynamic slipstream / airflow ribbons under & around
//   the bicycle wheels (zero crude floating dot particles!)
// ============================================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createLoopingVideoTexture(src) {
  const vid = document.createElement('video');
  vid.src = src;
  vid.loop = true;
  vid.muted = true;
  vid.playsInline = true;
  vid.crossOrigin = 'anonymous';
  vid.preload = 'auto';
  vid.play().catch(() => {});
  const vTex = new THREE.VideoTexture(vid);
  vTex.colorSpace = THREE.SRGBColorSpace;
  vTex.minFilter = THREE.LinearFilter;
  vTex.magFilter = THREE.LinearFilter;
  return { vid, vTex };
}

function createSlipstreamRibbonGeometry(segU = 36) {
  const vertCount = (segU + 1) * 2;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  const indices = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const base = i * 2;
    positions[base * 3 + 0] = u;
    positions[base * 3 + 1] = -1.0;
    positions[base * 3 + 2] = 0.0;
    uvs[base * 2 + 0] = u;
    uvs[base * 2 + 1] = 0.0;

    positions[(base + 1) * 3 + 0] = u;
    positions[(base + 1) * 3 + 1] = 1.0;
    positions[(base + 1) * 3 + 2] = 0.0;
    uvs[(base + 1) * 2 + 0] = u;
    uvs[(base + 1) * 2 + 1] = 1.0;

    if (i < segU) {
      const a = base;
      const b = base + 1;
      const c = base + 2;
      const d = base + 3;
      indices.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, -1.2), 4.0);
  return geo;
}

export async function loadPelicanHeroRig(renderer, opts = {}) {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  const omniJetUrl = opts.omniJetUrl || './assets/soarin_scene1_gw/gw_omni_cyan_jet_boost.mp4';
  const omniJet = createLoopingVideoTexture(omniJetUrl);

  const rigRes = await fetch('./assets/pelican_3d/pelican_rocket_bike_rig.json');
  const rigData = await rigRes.json();

  const gltf = await new Promise((resolve, reject) => {
    new GLTFLoader().load('./assets/pelican_3d/pelican_rocket_bike.glb', resolve, undefined, reject);
  });

  const root = new THREE.Group();
  root.name = 'PelicanHeroFlightRoot';
  const bobGroup = new THREE.Group();
  root.add(bobGroup);

  const nodes = {};
  const featherUniforms = {
    uFeatherTime: { value: 0.0 },
    uWindStrength: { value: 1.15 },
  };
  const configuredMats = new Set();
  const plasmaCoreMats = [];
  const colNozzleOff = new THREE.Color(0x1c1614);
  const colNozzleOn = new THREE.Color(0x38eeff);

  gltf.scene.traverse((obj) => {
    if (obj.name) nodes[obj.name] = obj;
    if (!obj.isMesh) return;
    const m = obj.material;
    const mName = (m && m.name) ? m.name : '';
    // Skip casting shadow on the 280k tiny layered VolFeather shell cards (the solid
    // DownyUnderPlumage body + Bike frame/wheels cast the exact same silhouette at 8% cost!)
    obj.castShadow = !mName.includes('VolFeather');
    obj.receiveShadow = false;

    if (m && !configuredMats.has(m.uuid)) {
      configuredMats.add(m.uuid);
      if (mName.includes('RocketCyanPlasmaCore')) {
        plasmaCoreMats.push(m);
      }
      for (const tk of ['map', 'normalMap', 'roughnessMap']) {
        if (m[tk]) m[tk].anisotropy = maxAniso;
      }
      const isVolFeather = m.name && m.name.includes('VolFeather');
      const isDown = m.name && m.name.includes('DownyUnderPlumage');
      const isTealScarf = m.name && m.name.includes('TealGoldSilkScarf');

      if (isTealScarf) {
        m.customProgramCacheKey = () => 'soarin_scarf_wind_' + m.name;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uFeatherTime = featherUniforms.uFeatherTime;
          shader.uniforms.uWindStrength = featherUniforms.uWindStrength;
          shader.vertexShader = 'uniform float uFeatherTime;\nuniform float uWindStrength;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             float sWave = sin(uFeatherTime * 12.0 + position.x * 28.0 - position.y * 22.0);
             float vTipMask = smoothstep(0.06, 0.18, length(position.xy));
             transformed.z -= (0.0020 + 0.0018 * sWave) * vTipMask * uWindStrength;`
          );
        };
        m.needsUpdate = true;
      }

      if (isVolFeather || isDown) {
        const isBlack = m.name && m.name.includes('Black');
        m.transparent = false;
        m.alphaTest = 0.0;
        if (isBlack && m.sheen !== undefined) {
          m.sheen = 0.20;
          m.sheenColor = new THREE.Color(0x182638);
          m.sheenRoughness = 0.36;
        }
        m.customProgramCacheKey = () => `soarin_pelican_feather_${m.name}_${isVolFeather ? 1 : 0}_${isBlack ? 1 : 0}`;
        m.onBeforeCompile = (shader) => {
          shader.uniforms.uFeatherTime = featherUniforms.uFeatherTime;
          shader.uniforms.uWindStrength = featherUniforms.uWindStrength;
          shader.vertexShader = 'uniform float uFeatherTime;\nuniform float uWindStrength;\nvarying float vWindShimmer;\n' + shader.vertexShader;
          if (isVolFeather) {
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               float uTip = clamp(1.0 - uv.y, 0.0, 1.0);
               float tipWeight = smoothstep(0.18, 0.96, uTip) * pow(uTip, 1.55);
               vec3 lPos = position;

               float gustEnv = 0.78 + 0.32 * sin(lPos.z * 3.1 + uFeatherTime * 3.4) * cos(lPos.x * 3.5 - uFeatherTime * 2.0);
               float streamWave = sin(lPos.z * 14.0 + uFeatherTime * 11.5 + lPos.x * 8.0 + lPos.y * 5.0);
               float tipFlutter = sin(lPos.z * 28.0 + uFeatherTime * 21.0 + lPos.x * 43.0 + lPos.y * 37.0);
               float windSignal = (streamWave * 0.68 + tipFlutter * 0.32) * gustEnv * uWindStrength;

               float isCrown = smoothstep(0.28, 0.38, lPos.y);
               float normalAmp = mix(0.0034, 0.0062, isCrown);
               float streamDragAmp = mix(0.0020, 0.0042, isCrown);

               transformed += objectNormal * (windSignal * normalAmp * tipWeight);
               transformed.z -= (0.42 + 0.58 * streamWave) * gustEnv * uWindStrength * streamDragAmp * tipWeight;
               vWindShimmer = streamWave * tipWeight * uWindStrength;`
            );
          } else {
            shader.vertexShader = shader.vertexShader.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               vWindShimmer = 0.0;`
            );
          }
          const sheenTint = isBlack ? 'vec3(0.04, 0.06, 0.10)' : 'vec3(0.22, 0.20, 0.16)';
          shader.fragmentShader = 'varying float vWindShimmer;\n' + shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_fragment_end>',
            `#include <lights_fragment_end>
             vec3 fViewDir = normalize(vViewPosition);
             float fFresnel = pow(1.0 - abs(dot(normal, fViewDir)), 2.8);
             float shimmerGain = 1.0 + vWindShimmer * 0.26;
             reflectedLight.directSpecular += ${sheenTint} * fFresnel * 0.48 * shimmerGain;`
          );
        };
        m.needsUpdate = true;
      }
    }
  });
  bobGroup.add(gltf.scene);

  // 2-Bone Analytical Leg IK Cache
  const legIK = {};
  for (const side of ['R', 'L']) {
    const info = rigData.legs[side];
    const hip = new THREE.Vector3(...info.hip);
    const restKnee = new THREE.Vector3(...info.rest_knee);
    const restAnkle = new THREE.Vector3(...info.rest_ankle);
    legIK[side] = {
      hip,
      restThighDir: restKnee.clone().sub(hip).normalize(),
      restShinDir: restAnkle.clone().sub(restKnee).normalize(),
      L1: info.L_thigh,
      L2: info.L_shin,
      ankleOffset: restAnkle.clone().sub(new THREE.Vector3(...info.rest_pedal)),
      pedalX: info.rest_pedal[0],
      splaySign: side === 'R' ? -1.0 : 1.0,
      thighNode: nodes[`Leg_Thigh_${side}`],
      shinNode: nodes[`Leg_Shin_${side}`],
      footNode: nodes[`Foot_Webbed_${side}`],
      pedalNode: nodes[`Pedal_${side}`],
    };
  }

  // Pixar Wide-Open Eyeball + Fixed Glint + Retracted Spherical Eyelids
  const eyeRig = {};
  if (rigData.eye_rig) {
    for (const side of ['R', 'L']) {
      const er = rigData.eye_rig[side];
      if (!er) continue;
      eyeRig[side] = {
        ballNode: nodes[`Eye_Ball_${side}`],
        glintNode: nodes[`Eye_Glint_${side}`],
        upperLidNode: nodes[`Eyelid_Upper_${side}`],
        lowerLidNode: nodes[`Eyelid_Lower_${side}`],
        lidCloseAxis: new THREE.Vector3(...er.lid_close_axis_gltf).normalize(),
        gazeUpAxis: new THREE.Vector3(...er.gaze_up_axis_gltf).normalize(),
        gazePitchAxis: new THREE.Vector3(...er.gaze_pitch_axis_gltf).normalize(),
        upperCloseRad: er.upper_close_rad,
        lowerCloseRad: er.lower_close_rad,
      };
    }
  }

  // ==========================================================================
  // 1. EXACT COAXIAL ROCKET BOOSTER NOZZLE FLAMES (`[±0.148, 0.672, -0.7685]`)
  //    Each nozzle's `nozScaleNode` scales strictly around its own local `(0,0,0)`
  //    inside `nozAnchor` — guaranteeing 0.000mm positional drift at all throttles!
  // ==========================================================================
  const rocketUniforms = {
    uTime: { value: 0.0 },
    uThrust: { value: 1.0 },
    uOmniJetTex: { value: omniJet.vTex },
  };

  const machLatticeMat = new THREE.ShaderMaterial({
    uniforms: rocketUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrust;
      varying vec2 vUv;
      void main() {
        float d = vUv.x;
        float r = (vUv.y - 0.5) * 2.0;
        float ar = abs(r);
        // Tight nozzle-throat root (0.68 -> matches 0.045m inner bronze bell!) tapering cleanly aft
        float jetEnv = mix(0.68, 0.22, pow(d, 0.78));
        float radialMask = smoothstep(jetEnv + 0.16, jetEnv * 0.36, ar);
        float flow = d * 15.0 - uTime * 27.0;
        float waveAmp = jetEnv * 0.58;
        float w1 = abs(r - sin(flow) * waveAmp);
        float w2 = abs(r + sin(flow) * waveAmp);
        float rib = mix(0.14, 0.08, d);
        float s1 = exp(-pow(w1 / rib, 2.0));
        float s2 = exp(-pow(w2 / rib, 2.0));
        float xLat = clamp(s1 + s2, 0.0, 1.5);
        float halo = exp(-pow(ar / (jetEnv * 0.92), 2.0)) * 0.38;
        float node = exp(-pow(ar / (jetEnv * 0.38), 2.0)) * pow(max(0.0, cos(flow)), 6.0) * 0.56;
        float noz = smoothstep(0.18, 0.0, d) * smoothstep(0.82, 0.10, ar) * 0.95;
        float fade = smoothstep(0.0, 0.02, d) * pow(max(0.0, 1.0 - d), 0.78);
        float gain = clamp(uThrust, 0.0, 1.75);
        float lum = (halo + xLat * 0.86 + node + noz) * fade * radialMask * gain;
        vec3 c1 = vec3(0.08, 0.70, 1.00);
        vec3 c2 = vec3(0.48, 0.96, 1.00);
        vec3 c3 = vec3(0.95, 0.99, 1.00);
        vec3 col = mix(c1, c2, clamp(xLat * 0.75 + noz * 0.68, 0.0, 1.0));
        col = mix(col, c3, clamp((s1 * s2) * 0.72 + node * 0.60 + noz * 0.48, 0.0, 0.90));
        gl_FragColor = vec4(col * lum * 0.96, clamp(lum, 0.0, 1.0));
      }
    `,
  });

  const omniJetCrossMat = new THREE.ShaderMaterial({
    uniforms: rocketUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uOmniJetTex;
      uniform float uThrust;
      varying vec2 vUv;
      void main() {
        vec3 vc = texture2D(uOmniJetTex, vUv).rgb;
        float ar = abs(vUv.y - 0.5) * 2.0;
        // Conical nozzle-bell collar so video plasma starts strictly INSIDE the 0.045m bronze lip!
        float coneRadius = mix(0.34, 0.92, smoothstep(0.0, 0.30, vUv.x));
        float edgeY = smoothstep(coneRadius, coneRadius * 0.38, ar);
        float edgeX = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.74, vUv.x);
        float mask = edgeX * edgeY * clamp(uThrust, 0.0, 1.65) * 0.72;
        gl_FragColor = vec4(vc * mask, clamp(mask, 0.0, 1.0));
      }
    `,
  });

  const flareMat = new THREE.ShaderMaterial({
    uniforms: rocketUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uThrust;
      varying vec2 vUv;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float g = pow(max(0.0, 1.0 - r), 2.1) * clamp(uThrust, 0.0, 1.5);
        vec3 c = mix(vec3(0.16, 0.80, 1.0), vec3(0.95, 0.99, 1.0), pow(max(0.0, 1.0 - r), 1.5));
        gl_FragColor = vec4(c * g * 1.18, clamp(g, 0.0, 1.0));
      }
    `,
  });

  const coneCoreMat = new THREE.ShaderMaterial({
    uniforms: rocketUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThrust;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        // CylinderGeometry openEnded: vUv.y = 1.0 at nozzle throat, 0.0 at aft tip
        float d = 1.0 - vUv.y;
        float centerFacing = pow(abs(dot(vN, vV)), 0.85);
        float pulse = 0.86 + 0.14 * sin(d * 18.0 - uTime * 30.0);
        float axial = smoothstep(0.0, 0.03, d) * pow(max(0.0, 1.0 - d), 1.15);
        float lum = centerFacing * axial * pulse * clamp(uThrust, 0.0, 1.7) * 0.92;
        vec3 col = mix(vec3(0.14, 0.82, 1.00), vec3(0.96, 0.99, 1.00), pow(max(0.0, 1.0 - d), 1.6));
        gl_FragColor = vec4(col * lum, clamp(lum, 0.0, 1.0));
      }
    `,
  });

  const plumeGroup = new THREE.Group();
  bobGroup.add(plumeGroup);
  const nozScaleNodes = [];
  const omniJetSpinNodes = [];

  for (const noz of rigData.rocket_nozzles_gltf) {
    // Exact center of Mat_RocketNozzleBronze rear lip `[±0.148, 0.672, -0.7685]`
    const nozAnchor = new THREE.Group();
    nozAnchor.position.set(noz[0], noz[1], -0.7685);

    // Throat-to-lip glowing plasma disc seated right inside the hollow bronze nozzle bell
    const flareGeo = new THREE.CircleGeometry(0.046, 24);
    flareGeo.rotateY(Math.PI);
    const flareMesh = new THREE.Mesh(flareGeo, flareMat);
    flareMesh.position.z = 0.005;
    nozAnchor.add(flareMesh);

    // Per-nozzle scale node at local (0, 0, 0) so scaling NEVER translates nozzle position!
    const nozScaleNode = new THREE.Group();
    nozAnchor.add(nozScaleNode);
    nozScaleNodes.push(nozScaleNode);

    // Gapless 3D tapered plasma cone rooted 3cm inside the bronze nozzle throat!
    const coneLen = 0.78;
    const coneGeo = new THREE.CylinderGeometry(0.041, 0.009, coneLen, 20, 1, true);
    coneGeo.translate(0, -coneLen * 0.5 + 0.030, 0);
    coneGeo.rotateX(Math.PI * 0.5);
    nozScaleNode.add(new THREE.Mesh(coneGeo, coneCoreMat));

    const coreLen = 0.92;
    const coreW = 0.118;
    for (const roll of [0.0, Math.PI * 0.5]) {
      const pGeo = new THREE.PlaneGeometry(coreLen, coreW);
      // Root starts 3.0cm inside the hollow bronze bell (+0.030 along +Z)
      pGeo.translate(coreLen * 0.5 - 0.030, 0, 0);
      pGeo.rotateX(roll);
      pGeo.rotateY(Math.PI * 0.5);
      nozScaleNode.add(new THREE.Mesh(pGeo, machLatticeMat));
    }

    const omniCross = new THREE.Group();
    const omniLen = 1.04;
    const omniW = 0.22;
    for (const roll of [0.0, Math.PI * 0.5]) {
      const oGeo = new THREE.PlaneGeometry(omniLen, omniW);
      oGeo.translate(omniLen * 0.5 - 0.015, 0, 0);
      oGeo.rotateX(roll);
      oGeo.rotateY(Math.PI * 0.5);
      omniCross.add(new THREE.Mesh(oGeo, omniJetCrossMat));
    }
    nozScaleNode.add(omniCross);
    omniJetSpinNodes.push(omniCross);

    plumeGroup.add(nozAnchor);
  }

  const cyanJetLight = new THREE.PointLight(0x2ce2ff, 2.6, 2.6, 1.6);
  cyanJetLight.position.set(0.0, 0.672, -0.88);
  bobGroup.add(cyanJetLight);

  // Warm Front Brass Headlamp Volumetric Cone + PointLight
  const lampConeGeo = new THREE.CylinderGeometry(0.038, 0.24, 0.65, 20, 1, true);
  lampConeGeo.translate(0, -0.325, 0);
  lampConeGeo.rotateX(-Math.PI * 0.5);
  const lampConeUniforms = { uLampGain: { value: 0.22 } };
  const lampConeMat = new THREE.ShaderMaterial({
    uniforms: lampConeUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uLampGain;
      varying vec2 vUv;
      void main() {
        float fade = pow(vUv.y, 2.2) * uLampGain;
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.52) * fade, fade);
      }
    `,
  });
  const lampCone = new THREE.Mesh(lampConeGeo, lampConeMat);
  lampCone.position.set(...rigData.headlamp_lens_gltf);
  bobGroup.add(lampCone);

  const headLampLight = new THREE.PointLight(0xffdf94, 0.0, 8.0, 1.5);
  headLampLight.position.set(0.0, 0.74, 0.65);
  bobGroup.add(headLampLight);

  // ==========================================================================
  // 2. SILKY AERODYNAMIC SLIPSTREAM / AIRFLOW RIBBONS (`轻盈半透明流线气流`)
  //    Replaces crude floating wheel particles with gossamer camera-facing 3D
  //    wind streamlines peeling off the front/rear tires & rear hub!
  // ==========================================================================
  const slipSharedUniforms = {
    uAirTime: { value: 0.0 },
    uCurve: { value: 0.0 },
    uSlipGain: { value: 1.0 },
    uGround01: { value: 0.0 },
  };

  const slipRibbonGeo = createSlipstreamRibbonGeometry(36);
  const slipConfigs = [
    // Front wheel lower aerodynamic slipstream
    { origin: [0.0, 0.045, 0.44],  len: 2.05, hw0: 0.022, hw1: 0.068, seed: 1.15, opacity: 0.34 },
    // Rear wheel main aerodynamic slipstream
    { origin: [0.0, 0.048, -0.58], len: 2.75, hw0: 0.026, hw1: 0.084, seed: 2.85, opacity: 0.38 },
    // Left & Right axle / fender fine vortex airflow filaments
    { origin: [-0.076, 0.22, -0.56], len: 2.15, hw0: 0.013, hw1: 0.040, seed: 4.40, opacity: 0.28 },
    { origin: [ 0.076, 0.22, -0.56], len: 2.15, hw0: 0.013, hw1: 0.040, seed: 6.10, opacity: 0.28 },
  ];

  const slipstreamGroup = new THREE.Group();
  slipstreamGroup.name = 'AerodynamicSlipstreamGroup';
  root.add(slipstreamGroup);

  for (const cfg of slipConfigs) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: {
        uAirTime: slipSharedUniforms.uAirTime,
        uCurve: slipSharedUniforms.uCurve,
        uSlipGain: slipSharedUniforms.uSlipGain,
        uGround01: slipSharedUniforms.uGround01,
        uOrigin: { value: new THREE.Vector3(...cfg.origin) },
        uLen: { value: cfg.len },
        uHalfW0: { value: cfg.hw0 },
        uHalfW1: { value: cfg.hw1 },
        uSeed: { value: cfg.seed },
        uBaseOpacity: { value: cfg.opacity },
      },
      vertexShader: `
        uniform float uAirTime;
        uniform float uCurve;
        uniform float uGround01;
        uniform vec3 uOrigin;
        uniform float uLen;
        uniform float uHalfW0;
        uniform float uHalfW1;
        uniform float uSeed;
        varying float vU;
        varying float vSide;

        vec3 evalSpine(float u) {
          float z = uOrigin.z - u * uLen;
          float waveX = sin(u * 5.4 - uAirTime * 9.5 + uSeed) * 0.018 * u;
          float x = uOrigin.x + uCurve * (u * u) + waveX;
          float airY = -0.028 * u * u + cos(u * 4.6 - uAirTime * 8.2 + uSeed * 1.3) * 0.014 * u;
          float groundY = 0.008 * u + abs(sin(u * 4.2 - uAirTime * 8.5 + uSeed)) * 0.006 * u;
          float y = uOrigin.y + mix(airY, groundY, uGround01);
          return vec3(x, y, z);
        }

        void main() {
          float u = position.x;
          float side = position.y;
          vU = u;
          vSide = side;

          vec3 p0 = evalSpine(u);
          vec3 p1 = evalSpine(min(1.0, u + 0.025));
          vec4 mv0 = modelViewMatrix * vec4(p0, 1.0);
          vec4 mv1 = modelViewMatrix * vec4(p1, 1.0);
          vec3 tView = mv1.xyz - mv0.xyz;
          float tLen = length(tView);
          tView = tLen > 1e-5 ? (tView / tLen) : vec3(0.0, 0.0, -1.0);
          vec3 vRay = normalize(-mv0.xyz);
          vec3 perp = cross(tView, vRay);
          float pLen = length(perp);
          perp = pLen > 1e-5 ? (perp / pLen) : vec3(0.0, 1.0, 0.0);

          float hw = mix(uHalfW0, uHalfW1, pow(u, 0.68));
          mv0.xyz += perp * (side * hw);
          gl_Position = projectionMatrix * mv0;
        }
      `,
      fragmentShader: `
        uniform float uAirTime;
        uniform float uSlipGain;
        uniform float uSeed;
        uniform float uBaseOpacity;
        varying float vU;
        varying float vSide;

        void main() {
          // Dual silky laminar wind filaments inside a soft Gaussian slipstream envelope
          float envW = exp(-vSide * vSide * 2.8);
          float f1 = exp(-pow((vSide - 0.30 * sin(vU * 5.8 - uAirTime * 12.0 + uSeed)) / 0.36, 2.0));
          float f2 = exp(-pow((vSide + 0.26 * cos(vU * 7.2 - uAirTime * 14.5 + uSeed * 1.7)) / 0.30, 2.0));
          float crossProfile = envW * 0.45 + (f1 * 0.55 + f2 * 0.45) * 0.68;

          // Long continuous wind-gust streaks (zero dots!)
          float gustA = 0.62 + 0.38 * sin(vU * 7.0 - uAirTime * 17.5 + uSeed);
          float gustB = 0.68 + 0.32 * cos(vU * 3.6 - uAirTime * 11.0 - uSeed * 0.8);
          float headFade = smoothstep(0.0, 0.08, vU);
          float tailFade = pow(max(0.0, 1.0 - vU), 1.80);

          float alpha = crossProfile * gustA * gustB * headFade * tailFade * uBaseOpacity * uSlipGain;
          vec3 windCol = mix(vec3(0.88, 0.95, 1.00), vec3(0.99, 0.995, 1.00), clamp(f1 + f2, 0.0, 1.0) * 0.65);
          gl_FragColor = vec4(windCol, clamp(alpha, 0.0, 0.42));
        }
      `,
    });
    const rMesh = new THREE.Mesh(slipRibbonGeo, mat);
    rMesh.frustumCulled = false;
    rMesh.renderOrder = 5;
    slipstreamGroup.add(rMesh);
  }

  // Default Aperiodic Natural Blink & Saccadic Gaze Evaluators
  const DEFAULT_BLINKS = [1.45, 4.35, 4.62, 7.15, 9.55];
  function evalBlinkDefault(tCycle) {
    let b = 0.0;
    for (let i = 0; i < DEFAULT_BLINKS.length; i++) {
      const dt = (tCycle % 12.0) - DEFAULT_BLINKS[i];
      if (dt >= 0.0 && dt < 0.25) {
        let w = 0.0;
        if (dt < 0.065) {
          const u = dt / 0.065;
          w = u * u * (3.0 - 2.0 * u);
        } else if (dt < 0.095) {
          w = 1.0;
        } else {
          const u = (dt - 0.095) / 0.155;
          const s = u * u * (3.0 - 2.0 * u);
          w = 1.0 - Math.pow(s, 0.78);
        }
        if (w > b) b = w;
      }
    }
    return b;
  }

  const DEFAULT_GAZE = [
    { t: 0.00, yaw:  0.16, pitch: -0.06 },
    { t: 2.10, yaw: -0.08, pitch: -0.03 },
    { t: 3.70, yaw: -0.23, pitch: -0.02 },
    { t: 5.35, yaw:  0.10, pitch:  0.16 },
    { t: 6.75, yaw: -0.20, pitch: -0.02 },
    { t: 8.10, yaw:  0.04, pitch: -0.17 },
    { t: 10.2, yaw: -0.05, pitch: -0.12 },
  ];
  function evalGazeDefault(tCycle, gazeSchedule = DEFAULT_GAZE, cycleLen = 12.0) {
    const tc = ((tCycle % cycleLen) + cycleLen) % cycleLen;
    let idx = gazeSchedule.length - 1;
    for (let i = 0; i < gazeSchedule.length - 1; i++) {
      if (tc >= gazeSchedule[i].t && tc < gazeSchedule[i + 1].t) { idx = i; break; }
    }
    const cur = gazeSchedule[idx];
    const nxt = gazeSchedule[(idx + 1) % gazeSchedule.length];
    const segEnd = idx < gazeSchedule.length - 1 ? nxt.t : cycleLen;
    const rem = segEnd - tc;
    let s = 0.0;
    if (rem < 0.095) {
      const u = 1.0 - rem / 0.095;
      s = u * u * (3.0 - 2.0 * u);
    }
    return {
      yaw: cur.yaw + (nxt.yaw - cur.yaw) * s + Math.sin(tCycle * 2.9) * 0.008,
      pitch: cur.pitch + (nxt.pitch - cur.pitch) * s + Math.cos(tCycle * 2.3) * 0.007,
    };
  }

  // Scratch math objects
  const bbPivot = new THREE.Vector3(...rigData.bb_pivot);
  const crankR = rigData.crank_radius;
  const theta0 = rigData.initial_crank_theta_r_rad;
  const tmpPedal = new THREE.Vector3();
  const tmpAnkle = new THREE.Vector3();
  const tmpDelta = new THREE.Vector3();
  const tmpU = new THREE.Vector3();
  const tmpLat = new THREE.Vector3(1, 0, 0);
  const tmpPerp = new THREE.Vector3();
  const tmpKnee = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const qEyeYaw = new THREE.Quaternion();
  const qEyePitch = new THREE.Quaternion();
  const mLook = new THREE.Matrix4();
  const qFlight = new THREE.Quaternion();
  const qBank = new THREE.Quaternion();
  const qWheelie = new THREE.Quaternion();
  const upWorld = new THREE.Vector3(0, 1, 0);
  const fwdAxisZ = new THREE.Vector3(0, 0, 1);
  const pitchAxisX = new THREE.Vector3(1, 0, 0);
  const tmpBack = new THREE.Vector3();

  function update(tRaw, state = {}) {
    const {
      position = null,
      tangent = null,
      bankRad = 0.0,
      thrust = 1.10,
      windStrength = 1.15,
      pedalRate = 5.6,
      nightLamp01 = 0.0,
      groundRide01 = 0.0,
      wheelieRad = 0.0,
      tCycle = tRaw,
      gazeSchedule = DEFAULT_GAZE,
      cycleLen = 12.0,
    } = state;

    // Booster gating rule ("上坡或飞行是开助推，其他时候正常关闭就行"):
    // - Airborne (`1 - ground01`): Booster ON
    // - Surface riding (`ground01`): Booster ON ONLY during steep uphill climbs (`slopeY > 0.14`, e.g. Great Wall rampart);
    //   on flat/gentle surfaces (Forbidden City courtyard & marble bridge, Guilin river, Zhangjiajie pool, Qiansimen Bridge) -> OFF (0.0)!
    const ground01 = THREE.MathUtils.clamp(groundRide01, 0.0, 1.0);
    const slopeY = tangent ? tangent.y : 0.0;
    const uphillOnGround01 = THREE.MathUtils.smoothstep(slopeY, 0.14, 0.22);
    const boosterGate01 = Math.max(1.0 - ground01, ground01 * uphillOnGround01);
    const activeFlightThrust = Math.max(1.08, thrust);
    const effThrust = boosterGate01 * activeFlightThrust;

    rocketUniforms.uTime.value = tRaw;
    rocketUniforms.uThrust.value = effThrust;
    featherUniforms.uFeatherTime.value = tRaw;
    featherUniforms.uWindStrength.value = windStrength;

    for (let i = 0; i < plasmaCoreMats.length; i++) {
      const pm = plasmaCoreMats[i];
      if (pm.color) pm.color.copy(colNozzleOff).lerp(colNozzleOn, boosterGate01);
      if (pm.emissive) {
        pm.emissive.copy(colNozzleOn);
        pm.emissiveIntensity = 2.1 * boosterGate01;
      }
    }

    const boost01 = THREE.MathUtils.clamp((effThrust - 1.18) / 0.65, 0.0, 1.15);
    const lowThrottle01 = THREE.MathUtils.clamp(effThrust / 1.18, 0.0, 1.0);
    const plumeLenScale = effThrust < 1.18
      ? THREE.MathUtils.lerp(0.08, 0.68, lowThrottle01)
      : THREE.MathUtils.lerp(0.68, 1.22, boost01);
    const plumeRadScale = THREE.MathUtils.lerp(0.60, 1.04, Math.max(lowThrottle01 * 0.85, boost01));
    plumeGroup.visible = boosterGate01 > 0.02;
    for (const sn of nozScaleNodes) {
      sn.scale.set(plumeRadScale, plumeRadScale, Math.max(0.02, plumeLenScale));
    }
    for (const oc of omniJetSpinNodes) {
      oc.rotation.z = tRaw * 9.5;
    }

    // Update silky aerodynamic slipstream uniforms
    slipSharedUniforms.uAirTime.value = tRaw;
    slipSharedUniforms.uCurve.value = THREE.MathUtils.clamp(bankRad * 1.15, -0.38, 0.38);
    slipSharedUniforms.uGround01.value = ground01;
    slipSharedUniforms.uSlipGain.value = THREE.MathUtils.clamp(0.72 + 0.32 * (windStrength - 1.0) + 0.25 * boost01, 0.50, 1.35);

    lampConeUniforms.uLampGain.value = THREE.MathUtils.lerp(0.16, 0.68, nightLamp01);
    headLampLight.intensity = THREE.MathUtils.lerp(0.0, 3.8, nightLamp01);

    if (position) root.position.copy(position);
    if (tangent) {
      tmpBack.copy(root.position).sub(tangent);
      mLook.lookAt(root.position, tmpBack, upWorld);
      qFlight.setFromRotationMatrix(mLook);
      qBank.setFromAxisAngle(fwdAxisZ, bankRad);
      root.quaternion.copy(qFlight).multiply(qBank);
      if (Math.abs(wheelieRad) > 1e-4) {
        qWheelie.setFromAxisAngle(pitchAxisX, -wheelieRad);
        root.quaternion.multiply(qWheelie);
      }
    }

    // Constant, natural bicycle pedaling cadence ("登车速度不变") — zero speed jumps or phase-derivative spikes!
    const CONSTANT_PEDAL_RATE = 5.2;
    const pedalPhase = tRaw * CONSTANT_PEDAL_RATE;
    const wheelPhase = pedalPhase * 2.15;
    if (nodes.Wheel_Front) nodes.Wheel_Front.rotation.x = wheelPhase;
    if (nodes.Wheel_Rear) nodes.Wheel_Rear.rotation.x = wheelPhase;
    if (nodes.Crank_Assembly) nodes.Crank_Assembly.rotation.x = pedalPhase;

    for (const side of ['R', 'L']) {
      const ik = legIK[side];
      const th = (side === 'R' ? theta0 : theta0 + Math.PI) - pedalPhase;
      tmpPedal.set(ik.pedalX, bbPivot.y + Math.sin(th) * crankR, bbPivot.z + Math.cos(th) * crankR);
      if (ik.pedalNode) {
        ik.pedalNode.position.copy(tmpPedal);
        ik.pedalNode.rotation.x = 0.0;
      }
      tmpAnkle.copy(tmpPedal).add(ik.ankleOffset);
      tmpDelta.copy(tmpAnkle).sub(ik.hip);
      const dist = Math.min(ik.L1 + ik.L2 - 0.0045, Math.max(0.08, tmpDelta.length()));
      tmpU.copy(tmpDelta).normalize();
      tmpPerp.crossVectors(tmpU, tmpLat).normalize();
      if (tmpPerp.z < 0) tmpPerp.negate();
      tmpPerp.x += ik.splaySign * 0.10;
      tmpPerp.normalize();

      const cosA = THREE.MathUtils.clamp((ik.L1 * ik.L1 + dist * dist - ik.L2 * ik.L2) / (2.0 * ik.L1 * dist), -0.985, 0.985);
      const sinA = Math.sqrt(Math.max(0.0, 1.0 - cosA * cosA));
      tmpKnee.copy(ik.hip).addScaledVector(tmpU, ik.L1 * cosA).addScaledVector(tmpPerp, ik.L1 * sinA);

      if (ik.thighNode) {
        tmpDir.copy(tmpKnee).sub(ik.hip).normalize();
        tmpQuat.setFromUnitVectors(ik.restThighDir, tmpDir);
        ik.thighNode.quaternion.copy(tmpQuat);
      }
      if (ik.shinNode) {
        ik.shinNode.position.copy(tmpKnee);
        tmpDir.copy(tmpAnkle).sub(tmpKnee).normalize();
        tmpQuat.setFromUnitVectors(ik.restShinDir, tmpDir);
        ik.shinNode.quaternion.copy(tmpQuat);
      }
      if (ik.footNode) {
        ik.footNode.position.copy(tmpAnkle);
        ik.footNode.rotation.x = 0.0;
      }
    }

    // Soulful Saccadic Gaze + Natural Blinks + Collar-Hidden Unbroken Neck Turn
    const gaze = state.gazeOverride || evalGazeDefault(tCycle, gazeSchedule, cycleLen);
    const blink01 = state.blinkOverride !== undefined ? state.blinkOverride : evalBlinkDefault(tCycle);
    for (const side of ['R', 'L']) {
      const er = eyeRig[side];
      if (!er) continue;
      if (er.ballNode) {
        qEyeYaw.setFromAxisAngle(er.gazeUpAxis, gaze.yaw);
        qEyePitch.setFromAxisAngle(er.gazePitchAxis, gaze.pitch);
        er.ballNode.quaternion.copy(qEyeYaw).multiply(qEyePitch);
      }
      if (er.upperLidNode) er.upperLidNode.quaternion.setFromAxisAngle(er.lidCloseAxis, er.upperCloseRad * blink01);
      if (er.lowerLidNode) er.lowerLidNode.quaternion.setFromAxisAngle(er.lidCloseAxis, er.lowerCloseRad * blink01);
      if (er.glintNode) {
        const gv = 1.0 - THREE.MathUtils.smoothstep(blink01, 0.35, 0.78);
        er.glintNode.visible = gv > 0.02;
        er.glintNode.scale.setScalar(Math.max(0.01, gv));
      }
    }

    if (nodes.Pelican_Head) {
      const lagGaze = evalGazeDefault(Math.max(0.0, tCycle - 0.12), gazeSchedule, cycleLen);
      nodes.Pelican_Head.rotation.x = Math.sin(tRaw * 5.2) * 0.010 + lagGaze.pitch * 0.14 - boost01 * 0.04;
      nodes.Pelican_Head.rotation.y = lagGaze.yaw * 0.24 + Math.sin(tRaw * 1.4) * 0.016;
      nodes.Pelican_Head.rotation.z = Math.cos(tRaw * 2.4) * 0.010 - lagGaze.yaw * 0.06;
    }
    if (nodes.Pelican_Body_Wings) {
      nodes.Pelican_Body_Wings.rotation.x = Math.sin(tRaw * 5.2) * 0.012 + boost01 * 0.035;
      nodes.Pelican_Body_Wings.rotation.z = Math.sin(tRaw * 2.6) * 0.014;
    }

    const airFloat = Math.max(0.0, 1.0 - ground01);
    bobGroup.position.y = Math.sin(tRaw * 2.4) * 0.022 * airFloat;
    cyanJetLight.intensity = (2.4 + Math.sin(tRaw * 38.0) * 0.30) * effThrust;
  }

  function localToWorld(lx, ly, lz, outVec) {
    return outVec.set(lx, ly, lz).applyQuaternion(root.quaternion).add(root.position);
  }

  return {
    root,
    nodes,
    rigData,
    omniVideos: [omniJet.vid],
    update,
    localToWorld,
  };
}

export function evaluateSplinePose(spline, u, outPos, outTang, outPrevTang) {
  const uc = THREE.MathUtils.clamp(u, 0.0, 0.9995);
  const uNext = Math.min(1.0, uc + 0.008);
  const uPrev = Math.max(0.0, uc - 0.008);
  spline.getPointAt(uc, outPos);
  spline.getPointAt(uNext, outTang);
  spline.getPointAt(uPrev, outPrevTang);
  outPrevTang.copy(outPos).sub(outPrevTang).normalize();
  outTang.sub(outPos).normalize();
  const yawNow = Math.atan2(outTang.x, outTang.z);
  const yawPrv = Math.atan2(outPrevTang.x, outPrevTang.z);
  let dYaw = yawNow - yawPrv;
  while (dYaw > Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  const bankRad = THREE.MathUtils.clamp(-dYaw * 6.0, -0.32, 0.32);
  return bankRad;
}
