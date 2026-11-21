// ============================================================================
// SHARED 3D VOLUMETRIC CUMULUS CLOUD SYSTEM & GPU MEMORY DISPOSAL UTILITIES
// Provides rich Pixar / Soarin' sunlit billowing cumulus cloud banks & sea-of-clouds
// plus strict recursive WebGL geometry/texture/video disposal (`分步回收`).
// ============================================================================
import * as THREE from 'three';

/**
 * Creates a GPU-instanced 3D volumetric cumulus cloud puff system.
 * Each instance is a soft camera-facing volumetric puff with analytical 3D sphere
 * normal shading, forward Henyey-Greenstein sun scattering, warm rim glow, and
 * silky soft alpha feathering (zero flat-plane clipping!).
 */
export function createVolumetricCloudSystem(opts = {}) {
  const {
    clusters = [],          // Array of { center:[x,y,z], radius:[rx,ry,rz], puffs:18, scale:[min,max] }
    sunDir = new THREE.Vector3(0.5, 0.4, -0.7).normalize(),
    litColor = 0xfff3d6,    // Warm sunlit cream-gold
    shadowColor = 0x7c8ca8, // Soft atmospheric slate-blue/amber shadow
    rimColor = 0xffd996,    // Golden silver-lining rim
    opacity = 0.62,
    seed = 1024,
  } = opts;

  let s = seed >>> 0 || 1337;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  let totalPuffs = 0;
  for (const c of clusters) totalPuffs += c.puffs || 16;
  if (totalPuffs === 0) totalPuffs = 1;

  const geo = new THREE.PlaneGeometry(1.0, 1.0);
  const instGeo = geo.clone();
  geo.dispose();

  const aCenter = new Float32Array(totalPuffs * 3);
  const aMeta = new Float32Array(totalPuffs * 4); // [size, rot, shadeY01, phase]

  let idx = 0;
  for (const cl of clusters) {
    const count = cl.puffs || 16;
    const [cx, cy, cz] = cl.center;
    const [rx, ry, rz] = cl.radius || [18, 7, 14];
    const [sMin, sMax] = cl.scale || [9.0, 20.0];
    for (let k = 0; k < count && idx < totalPuffs; k++, idx++) {
      // Concentrated toward core with fluffy outer lobes
      const u = rand() * Math.PI * 2.0;
      const v = rand() * 2.0 - 1.0;
      const rHoriz = Math.sqrt(Math.max(0.0, 1.0 - v * v));
      const dist = Math.pow(rand(), 0.58);
      const ox = Math.cos(u) * rHoriz * rx * dist;
      const oy = (v * 0.5 + 0.25 * rand()) * ry * dist;
      const oz = Math.sin(u) * rHoriz * rz * dist;

      aCenter[idx * 3 + 0] = cx + ox;
      aCenter[idx * 3 + 1] = cy + oy;
      aCenter[idx * 3 + 2] = cz + oz;

      const sz = THREE.MathUtils.lerp(sMax, sMin, dist * 0.65) * (0.82 + 0.36 * rand());
      const rot = rand() * Math.PI * 2.0;
      const shadeY = THREE.MathUtils.clamp((oy / Math.max(1.0, ry)) * 0.55 + 0.55, 0.08, 1.0);
      aMeta[idx * 4 + 0] = sz;
      aMeta[idx * 4 + 1] = rot;
      aMeta[idx * 4 + 2] = shadeY;
      aMeta[idx * 4 + 3] = rand() * 6.283;
    }
  }

  instGeo.setAttribute('aCenter', new THREE.InstancedBufferAttribute(aCenter, 3));
  instGeo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(aMeta, 4));

  const uniforms = {
    uTime: { value: 0.0 },
    uSunDir: { value: sunDir.clone().normalize() },
    uLitCol: { value: new THREE.Color(litColor) },
    uShadowCol: { value: new THREE.Color(shadowColor) },
    uRimCol: { value: new THREE.Color(rimColor) },
    uOpacity: { value: opacity },
  };

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    uniforms,
    vertexShader: `
      attribute vec3 aCenter;
      attribute vec4 aMeta;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vShadeY;
      varying float vPhase;
      varying float vCamFade;

      void main() {
        vUv = uv;
        vShadeY = aMeta.z;
        vPhase = aMeta.w;

        vec3 wCenter = (modelMatrix * vec4(aCenter, 1.0)).xyz;
        wCenter.x += sin(uTime * 0.22 + vPhase) * 0.85;
        wCenter.y += cos(uTime * 0.18 + vPhase * 1.3) * 0.35;

        vec4 mvCenter = viewMatrix * vec4(wCenter, 1.0);
        float camDist = length(mvCenter.xyz);
        // Smooth near-camera fade so flying directly through a cloud bank never pops!
        vCamFade = smoothstep(1.8, 9.5, camDist);

        float ang = aMeta.y + uTime * 0.025 * ( fract(vPhase) - 0.5 );
        float cs = cos(ang), sn = sin(ang);
        vec2 rotXY = vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * aMeta.x;

        mvCenter.xy += rotXY;
        vWorldPos = wCenter;
        gl_Position = projectionMatrix * mvCenter;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uLitCol;
      uniform vec3 uShadowCol;
      uniform vec3 uRimCol;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying float vShadeY;
      varying float vPhase;
      varying float vCamFade;

      float hash2(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
          mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        if (r >= 1.0) discard;

        // Multi-octave billowing cumulus silhouette perturbation
        vec2 np = p * 2.3 + vec2(vPhase * 1.7, vPhase * 0.9);
        float fbm = 0.58 * vnoise(np) + 0.28 * vnoise(np * 2.15 + 3.1) + 0.14 * vnoise(np * 4.4 + 7.4);
        float density = smoothstep(0.98, 0.18, r + (fbm - 0.5) * 0.36);
        if (density <= 0.004) discard;

        // Analytical 3D puff normal in view/world approximation for rich volumetric shading
        float nz = sqrt(max(0.05, 1.0 - min(0.95, r * r)));
        vec3 viewDir = normalize(vWorldPos - cameraPosition);
        vec3 sunD = normalize(uSunDir);
        float forwardScatter = pow(max(0.0, dot(viewDir, sunD)), 3.2);

        float topLit = clamp(vShadeY * 0.72 + (p.y * 0.32 + 0.24) + (fbm - 0.45) * 0.25, 0.0, 1.0);
        vec3 col = mix(uShadowCol, uLitCol, smoothstep(0.12, 0.86, topLit));

        // Golden silver-lining rim around outer thinner cloud edges facing sun
        float rim = (1.0 - nz) * (0.35 + 0.85 * forwardScatter);
        col += uRimCol * rim * 0.55;

        float alpha = density * uOpacity * vCamFade;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.95));
      }
    `,
  });

  const mesh = new THREE.InstancedMesh(instGeo, mat, totalPuffs);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  const idMat = new THREE.Matrix4();
  for (let i = 0; i < totalPuffs; i++) mesh.setMatrixAt(i, idMat);
  mesh.instanceMatrix.needsUpdate = true;

  return {
    mesh,
    uniforms,
    update(tGlobal) {
      uniforms.uTime.value = tGlobal;
    },
  };
}

/**
 * Strict recursive Three.js GPU & HTMLVideoElement memory disposer (`分步回收`).
 * Frees geometries, shader programs, 2K PBR textures, PMREM envMaps, RenderTargets, and Video decoders!
 */
export function disposeStationResources(station, scene = null) {
  if (!station) return;

  if (scene && station.group && station.group.parent === scene) {
    scene.remove(station.group);
  }

  // Custom station-specific cleanup hook (e.g., planar mirror WebGLRenderTarget)
  if (typeof station.dispose === 'function') {
    try { station.dispose(); } catch (e) {}
  }

  // Stop & release HTML5 <video> decoders
  if (Array.isArray(station.omniVideos)) {
    for (const vid of station.omniVideos) {
      if (!vid) continue;
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch (e) {}
    }
  }

  if (station.envTexture && typeof station.envTexture.dispose === 'function') {
    try { station.envTexture.dispose(); } catch (e) {}
  }

  const texSlots = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap',
    'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'envMap', 'lightMap',
  ];
  const disposedGeos = new Set();
  const disposedMats = new Set();
  const disposedTexs = new Set();

  function disposeTex(t) {
    if (t && !disposedTexs.has(t.uuid) && typeof t.dispose === 'function') {
      disposedTexs.add(t.uuid);
      try { t.dispose(); } catch (e) {}
    }
  }

  function disposeMat(m) {
    if (!m || disposedMats.has(m.uuid)) return;
    disposedMats.add(m.uuid);
    for (const k of texSlots) disposeTex(m[k]);
    if (m.uniforms) {
      for (const u of Object.values(m.uniforms)) {
        const val = u?.value;
        if (val && val.isTexture) disposeTex(val);
      }
    }
    try { m.dispose(); } catch (e) {}
  }

  if (station.group) {
    station.group.traverse((obj) => {
      if (obj.geometry && !disposedGeos.has(obj.geometry.uuid)) {
        disposedGeos.add(obj.geometry.uuid);
        try { obj.geometry.dispose(); } catch (e) {}
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach(disposeMat);
      } else if (obj.material) {
        disposeMat(obj.material);
      }
    });
    station.group.clear();
  }
}
