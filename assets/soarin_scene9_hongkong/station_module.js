// ============================================================================
// STATION 07 (IN FILM ORDER): 香港维多利亚港 · 维港实景天际线、张保仔号与中环摩天轮
// (HONG KONG VICTORIA HARBOUR — PHOTOREALISTIC CYCLORAMA EDITION:
//  True Victoria Harbour Blue-Hour Backdrop (`hk_harbor_backdrop.jpg`),
//  High-Detail 3D Aqua Luna Junk Boat with Scalloped Bamboo-Batten Crimson Sails,
//  Central Harbourfront Wood Road, Observation Wheel, & Side-to-Street-to-Skyline Flight)
// ============================================================================
import * as THREE from 'three';
import { createLoopingVideoTexture } from '../soarin_shared/pelican_hero_rig.js';
import {
  quintic01,
  createHeroTrajectory,
  applyHorizontalOffset,
  createStabilizedCameraDirector,
} from '../soarin_shared/cinema_cam_rig.js';
import { createVolumetricCloudSystem } from '../soarin_shared/volumetric_clouds.js';

const HK_DIR = './assets/soarin_scene9_hongkong';

function loadTex(loader, file, srgb = true, repeat = [1, 1], aniso = 4) {
  return new Promise((resolve, reject) => {
    loader.load(
      `${HK_DIR}/${file}`,
      (tex) => {
        tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat[0], repeat[1]);
        tex.anisotropy = aniso;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

export async function createStation(renderer) {
  const group = new THREE.Group();
  group.name = 'Station09_HongKong_VictoriaHarbour';

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 6);
  const texLoader = new THREE.TextureLoader();
  const DURATION = 16.0;
  const SUN_DIR = new THREE.Vector3(-0.55, 0.18, -0.82).normalize();

  const [
    backdropTex,
    woodAlb, woodNrm, woodRgh,
    sailAlb, sailNrm, sailRgh,
  ] = await Promise.all([
    loadTex(texLoader, 'hk_harbor_backdrop.jpg', true, [1, 1], maxAniso),
    loadTex(texLoader, 'hd_hk_boardwalk_timber_albedo.jpg', true, [10.0, 2.2], maxAniso),
    loadTex(texLoader, 'hd_hk_boardwalk_timber_normal.jpg', false, [10.0, 2.2], maxAniso),
    loadTex(texLoader, 'hd_hk_boardwalk_timber_roughness.jpg', false, [10.0, 2.2], maxAniso),
    loadTex(texLoader, 'hd_hk_junk_crimson_sail_albedo.jpg', true, [1, 1], maxAniso),
    loadTex(texLoader, 'hd_hk_junk_crimson_sail_normal.jpg', false, [1, 1], maxAniso),
    loadTex(texLoader, 'hd_hk_junk_crimson_sail_roughness.jpg', false, [1, 1], maxAniso),
  ]);
  backdropTex.wrapS = THREE.ClampToEdgeWrapping;
  backdropTex.wrapT = THREE.ClampToEdgeWrapping;

  // ============================================================================
  // 1. BLUE-HOUR SKY DOME + SEAMLESS CURVED VICTORIA HARBOUR BACKDROP CYCLORAMA
  // ============================================================================
  const skyDomeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vWDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWDir;
      void main() {
        float h = clamp(normalize(vWDir).y, -0.2, 1.0);
        vec3 deepCobalt  = vec3(0.036, 0.100, 0.220);
        vec3 midBlueHour = vec3(0.110, 0.210, 0.360);
        vec3 slateHoriz  = vec3(0.230, 0.280, 0.370);
        vec3 col = mix(slateHoriz, midBlueHour, smoothstep(-0.02, 0.22, h));
        col = mix(col, deepCobalt, smoothstep(0.20, 0.72, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(680, 48, 32), skyDomeMat);
  group.add(skyDome);

  // Curved Victoria Harbour Cyclorama using the exact cleaned `hk_harbor_backdrop.jpg`!
  // Crops the bottom water band (`v < 0.195`) seamlessly into 3D water at `Y = 0.0`,
  // and feathers left/right/top edges into the matching Blue-Hour sky dome.
  {
    const cycMat = new THREE.ShaderMaterial({
      uniforms: {
        uBackdrop: { value: backdropTex },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uBackdrop;
        varying vec2 vUv;
        void main() {
          // Map cylinder V [0..1] onto photo V [0.185..0.98] so waterline aligns cleanly at Y=0
          float imgU = 1.0 - vUv.x;
          float imgV = mix(0.185, 0.985, vUv.y);
          vec3 col = texture2D(uBackdrop, vec2(imgU, imgV)).rgb;

          // Smooth feathering on left/right/top edges into sky dome
          float sideFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          float topFade  = smoothstep(1.0, 0.80, vUv.y);
          float botFade  = smoothstep(0.0, 0.03, vUv.y);
          float alpha = sideFade * topFade * botFade;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const cycGeo = new THREE.CylinderGeometry(168, 168, 108, 72, 1, true, Math.PI * 0.54, Math.PI * 0.92);
    const cycMesh = new THREE.Mesh(cycGeo, cycMat);
    cycMesh.position.set(0.0, 52.0, 12.0);
    cycMesh.renderOrder = 1;
    group.add(cycMesh);
  }

  let envTexture = null;
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(48, 24, 16), skyDomeMat));
    const addCard = (pos, sz, col) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(...sz), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      m.position.set(...pos);
      m.lookAt(0, 0, 0);
      envScene.add(m);
    };
    addCard([0, 6, -24], [32, 16], 0xffd27a);
    addCard([18, 4, -18], [18, 12], 0xff521b);
    addCard([-20, 10, -18], [20, 12], 0x60a5fa);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTexture = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  }

  // Lighting Rig
  const hemi = new THREE.HemisphereLight(0x7aa7e0, 0x1e2c44, 1.35);
  group.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffcf96, 1.85);
  sunLight.position.copy(SUN_DIR).multiplyScalar(110);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 220;
  const sc = 46;
  sunLight.shadow.camera.left = -sc;
  sunLight.shadow.camera.right = sc;
  sunLight.shadow.camera.top = sc;
  sunLight.shadow.camera.bottom = -sc;
  sunLight.shadow.bias = -0.0005;
  group.add(sunLight, sunLight.target);

  const harborBounce = new THREE.DirectionalLight(0x38bdf8, 0.65);
  harborBounce.position.set(45, 22, 35);
  group.add(harborBounce);

  const atmoUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR },
  };

  // ============================================================================
  // 2. CENTRAL WATERFRONT WOOD ROAD (`X = -38..+22, Z = +12`) + LAMPS & PALMS
  // ============================================================================
  const DECK_Y = 3.20;
  const WHEEL_R = 0.28;
  const boardMat = new THREE.MeshStandardMaterial({
    map: woodAlb, normalMap: woodNrm, normalScale: new THREE.Vector2(1.10, 1.10),
    roughnessMap: woodRgh, roughness: 0.70, metalness: 0.05,
  });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x5c6470, roughness: 0.70, metalness: 0.10 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd9ad5b, roughness: 0.26, metalness: 0.85 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.36, metalness: 0.72 });

  // Horizontal Waterfront Timber Boardwalk along the Central Shore (`X = -36..+24, Z = +12`)
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(62.0, 0.55, 13.0), boardMat);
  boardwalk.position.set(-6.0, DECK_Y - 0.275, 12.0);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  const seawall = new THREE.Mesh(
    new THREE.BoxGeometry(64.0, 4.2, 14.5),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78, metalness: 0.12 })
  );
  seawall.position.set(-6.0, DECK_Y - 2.55, 12.0);
  seawall.receiveShadow = true;
  group.add(seawall);

  // Dark Timber Harbour Pilings along the front/south seawall face (`Z = +19.3`)
  {
    const pilingGeo = new THREE.CylinderGeometry(0.24, 0.28, 4.4, 8);
    const pilingMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.88 });
    const pilingInst = new THREE.InstancedMesh(pilingGeo, pilingMat, 16);
    const dm = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      dm.position.set(-34.0 + i * 3.8, 1.5, 19.4);
      dm.updateMatrix();
      pilingInst.setMatrixAt(i, dm.matrix);
    }
    pilingInst.instanceMatrix.needsUpdate = true;
    group.add(pilingInst);
  }

  // Harbourside Coping Curbs, Warm LED Strip & Brushed Brass Railings (North side `Z = +5.6` & South side `Z = +18.4`)
  for (const sideZ of [5.6, 18.4]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(62.0, 0.55, 0.85), graniteMat);
    curb.position.set(-6.0, DECK_Y + 0.05, sideZ);
    group.add(curb);
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(61.5, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffcf70 }));
    ledStrip.position.set(-6.0, DECK_Y + 0.06, sideZ + (sideZ < 12 ? -0.45 : +0.45));
    group.add(ledStrip);

    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 60.0, 10), brassMat);
    topRail.rotation.z = Math.PI * 0.5;
    topRail.position.set(-6.0, DECK_Y + 0.96, sideZ);
    group.add(topRail);
  }
  {
    const postGeo = new THREE.CylinderGeometry(0.05, 0.068, 1.02, 8);
    const postInst = new THREE.InstancedMesh(postGeo, darkSteelMat, 48);
    const dm = new THREE.Object3D();
    let idx = 0;
    for (const sideZ of [5.6, 18.4]) {
      for (let i = 0; i < 24; i++) {
        dm.position.set(-34.0 + i * 2.45, DECK_Y + 0.51, sideZ);
        dm.updateMatrix();
        postInst.setMatrixAt(idx++, dm.matrix);
      }
    }
    postInst.instanceMatrix.needsUpdate = true;
    group.add(postInst);
  }

  // Vintage Waterfront Lamps & Wooden Benches along the Wood Road
  {
    const lampPoleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.09, 3.6, 8), darkSteelMat, 20);
    const lampGlobeInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffdf94 }), 20);
    const benchInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.2, 0.42, 0.75),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.72 }),
      10
    );
    const dm = new THREE.Object3D();
    let idx = 0, bIdx = 0;
    for (const sz of [6.4, 17.6]) {
      for (let i = 0; i < 10; i++) {
        const px = -30.0 + i * 5.6;
        dm.position.set(px, DECK_Y + 1.80, sz);
        dm.updateMatrix();
        lampPoleInst.setMatrixAt(idx, dm.matrix);
        dm.position.set(px, DECK_Y + 3.68, sz);
        dm.updateMatrix();
        lampGlobeInst.setMatrixAt(idx, dm.matrix);
        idx++;
        if (i % 2 === 1) {
          dm.position.set(px + 2.0, DECK_Y + 0.25, sz + (sz < 12 ? 0.65 : -0.65));
          dm.updateMatrix();
          benchInst.setMatrixAt(bIdx++, dm.matrix);
        }
      }
    }
    lampPoleInst.instanceMatrix.needsUpdate = true;
    lampGlobeInst.instanceMatrix.needsUpdate = true;
    benchInst.instanceMatrix.needsUpdate = true;
    group.add(lampPoleInst, lampGlobeInst, benchInst);
  }

  // Curved Tropical Palm Trees framing the Wood Road (placed along South edge `Z = +18.8` so North harbour view stays wide open!)
  {
    const palmGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4330, roughness: 0.86 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1b4d2b, roughness: 0.44, metalness: 0.08, side: THREE.DoubleSide });
    const planterStoneMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.72 });
    const uplightMat = new THREE.MeshBasicMaterial({ color: 0xffd17a });

    const frondGeo = new THREE.PlaneGeometry(0.54, 2.55, 4, 8);
    frondGeo.translate(0, 1.275, 0);
    const fPos = frondGeo.attributes.position;
    for (let i = 0; i < fPos.count; i++) {
      const y = fPos.getY(i);
      const t = y / 2.55;
      const taper = Math.sin(Math.pow(Math.max(0.05, t), 0.72) * Math.PI);
      const x = fPos.getX(i) * taper;
      const arch = Math.sin(t * Math.PI * 0.78) * 0.65 - Math.pow(t, 2.1) * 0.95;
      fPos.setXYZ(i, x, arch + y * 0.25, y * 0.86);
    }
    frondGeo.computeVertexNormals();

    const palmCoords = [[-26, 18.8], [-12, 18.8], [+2, 18.8], [+16, 18.8]];
    palmCoords.forEach(([px, pz], idx) => {
      const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.42, 10), planterStoneMat);
      planter.position.set(px, DECK_Y + 0.21, pz);
      const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.58, 12), uplightMat);
      glowRing.rotation.x = -Math.PI * 0.5;
      glowRing.position.set(px, DECK_Y + 0.44, pz);
      palmGroup.add(planter, glowRing);

      const lean = (idx % 2 === 0 ? 1 : -1) * 0.16;
      for (let seg = 0; seg < 4; seg++) {
        const rBot = 0.20 - seg * 0.025;
        const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(rBot - 0.024, rBot, 1.15, 8), trunkMat);
        segMesh.position.set(px + lean * seg * 0.18, DECK_Y + 0.75 + seg * 1.08, pz);
        segMesh.rotation.z = -lean * (0.08 + seg * 0.04);
        palmGroup.add(segMesh);
      }
      for (let f = 0; f < 14; f++) {
        const frond = new THREE.Mesh(frondGeo, leafMat);
        frond.position.set(px + lean * 0.62, DECK_Y + 4.45, pz);
        frond.rotation.y = (f / 14) * Math.PI * 2 + idx * 0.45;
        frond.rotation.x = 0.18 + (f % 3) * 0.14;
        frond.scale.setScalar(0.86 + (f % 3) * 0.12);
        palmGroup.add(frond);
      }
    });
    group.add(palmGroup);
  }

  // ============================================================================
  // 3. HONG KONG OBSERVATION WHEEL (`X = -38.0, Z = +10.0` at left end of Wood Road)
  // ============================================================================
  const wheelRoot = new THREE.Group();
  wheelRoot.position.set(-38.0, DECK_Y, +10.0);
  wheelRoot.rotation.y = THREE.MathUtils.degToRad(58);
  group.add(wheelRoot);

  const wheelSpinner = new THREE.Group();
  const FERRIS_R = 12.6;
  wheelSpinner.position.set(0, 15.2, 0);
  wheelRoot.add(wheelSpinner);

  const gondolaPivots = [];
  {
    const whiteSteel = new THREE.MeshStandardMaterial({ color: 0xeaf2ff, roughness: 0.28, metalness: 0.68 });
    const ledRimMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
    const magentaRimMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });

    const wheelBase = new THREE.Mesh(new THREE.BoxGeometry(16.0, 4.2, 10.0), graniteMat);
    wheelBase.position.set(0, -1.6, 0);
    wheelRoot.add(wheelBase);

    for (const zOff of [-1.8, +1.8]) {
      for (const legTilt of [-0.42, +0.42]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.40, 16.8, 10), whiteSteel);
        leg.position.set(Math.sin(legTilt) * 6.6, 7.8, zOff);
        leg.rotation.z = legTilt;
        wheelRoot.add(leg);
      }
    }
    for (const zOff of [-0.95, +0.95]) {
      const outerRing = new THREE.Mesh(new THREE.TorusGeometry(FERRIS_R, 0.20, 10, 56), whiteSteel);
      outerRing.position.z = zOff;
      wheelSpinner.add(outerRing);
      const ledRing = new THREE.Mesh(
        new THREE.TorusGeometry(FERRIS_R - 0.34, 0.085, 8, 56),
        zOff > 0 ? ledRimMat : magentaRimMat
      );
      ledRing.position.z = zOff * 1.08;
      wheelSpinner.add(ledRing);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 3.0, 20), magentaRimMat);
    hub.rotation.x = Math.PI * 0.5;
    wheelSpinner.add(hub);

    const spokeGeo = new THREE.CylinderGeometry(0.055, 0.055, FERRIS_R * 2, 6);
    for (let i = 0; i < 12; i++) {
      const sp = new THREE.Mesh(spokeGeo, whiteSteel);
      sp.rotation.z = (i / 12) * Math.PI;
      wheelSpinner.add(sp);
    }

    const cabGlassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe4ff, emissive: 0xffcf70, emissiveIntensity: 0.90, roughness: 0.16, metalness: 0.45,
    });
    const cabRoofGeo = new THREE.CylinderGeometry(0.46, 0.55, 0.24, 12);
    const cabBodyGeo = new THREE.CylinderGeometry(0.55, 0.42, 0.88, 12);
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const piv = new THREE.Group();
      piv.position.set(Math.cos(ang) * FERRIS_R, Math.sin(ang) * FERRIS_R, 0);
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 6), whiteSteel);
      hanger.position.y = -0.30;
      const cabRoof = new THREE.Mesh(cabRoofGeo, whiteSteel);
      cabRoof.position.y = -0.64;
      const cabBody = new THREE.Mesh(cabBodyGeo, cabGlassMat);
      cabBody.position.y = -1.12;
      piv.add(hanger, cabRoof, cabBody);
      wheelSpinner.add(piv);
      gondolaPivots.push(piv);
    }
  }

  // ============================================================================
  // 4. HIGH-DETAIL 3D AQUA LUNA (張保仔號) JUNK BOAT (`X = +16.0, Z = -28.0`)
  // ============================================================================
  const junkBoatGroup = new THREE.Group();
  junkBoatGroup.position.set(+20.0, 0.05, -10.0);
  junkBoatGroup.scale.setScalar(1.28);
  junkBoatGroup.rotation.y = Math.PI * 0.28;
  group.add(junkBoatGroup);
  {
    const darkTeak = new THREE.MeshStandardMaterial({ color: 0x2a150d, roughness: 0.58, metalness: 0.08 });
    const trimGold = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.40, metalness: 0.55 });
    const warmWindow = new THREE.MeshBasicMaterial({ color: 0xffe29a });
    const lanternGlow = new THREE.MeshBasicMaterial({ color: 0xff6b2b });
    const deckWood = new THREE.MeshStandardMaterial({ map: woodAlb, color: 0x854d27, roughness: 0.72 });
    const sailMat = new THREE.MeshStandardMaterial({
      map: sailAlb, normalMap: sailNrm, normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: sailRgh, roughness: 0.55,
      emissiveMap: sailAlb, emissive: new THREE.Color(0xff4a16), emissiveIntensity: 1.05, side: THREE.DoubleSide,
    });

    // Sculpted Curved Chinese Junk Hull (tapered bow, flared gunwale, raised stern poop deck!)
    const hullGeo = new THREE.CylinderGeometry(2.1, 1.4, 15.5, 14, 6);
    hullGeo.rotateX(Math.PI * 0.5);
    const hp = hullGeo.attributes.position;
    for (let i = 0; i < hp.count; i++) {
      let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
      const tZ = z / 7.75; // -1 stern .. +1 bow
      const beamScale = tZ > 0 ? Math.max(0.18, Math.cos(tZ * 1.35)) : (0.85 - Math.abs(tZ) * 0.12);
      x *= beamScale * 1.15;
      // Sheer curve: bow & stern sweep upward cleanly
      const sheer = Math.pow(tZ, 2) * 1.35 + (tZ < -0.35 ? 0.65 : 0.0);
      if (y > 0) y = y * 0.55 + sheer;
      else y = y * 0.48;
      hp.setXYZ(i, x, y + 0.85, z);
    }
    hullGeo.computeVertexNormals();
    const hullMesh = new THREE.Mesh(hullGeo, darkTeak);
    junkBoatGroup.add(hullMesh);

    // Main Deck + Raised Stern Poop Deck + Gold Gunwale Trim
    const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 11.2), deckWood);
    mainDeck.position.set(0, 1.65, -0.4);
    const poopDeck = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.85, 3.6), darkTeak);
    poopDeck.position.set(0, 2.15, -5.6);
    junkBoatGroup.add(mainDeck, poopDeck);

    // Two-Tier Glowing Lower & Upper Passenger Cabins with Timber Mullion Frames
    const lowerCabin = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.25, 6.8), darkTeak);
    lowerCabin.position.set(0, 2.35, -1.0);
    const lowerWin = new THREE.Mesh(new THREE.BoxGeometry(2.76, 0.72, 5.8), warmWindow);
    lowerWin.position.set(0, 2.40, -1.0);
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 7.6), darkTeak);
    upperRoof.position.set(0, 3.05, -1.0);
    const upperCabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 4.4), darkTeak);
    upperCabin.position.set(0, 3.60, -1.4);
    const upperWin = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.52, 3.8), warmWindow);
    upperWin.position.set(0, 3.62, -1.4);
    junkBoatGroup.add(lowerCabin, lowerWin, upperRoof, upperCabin, upperWin);

    // 18 Glowing Amber/Crimson String Lanterns along Deck Railings & Stern
    const lGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lInst = new THREE.InstancedMesh(lGeo, lanternGlow, 18);
    const dm = new THREE.Object3D();
    let li = 0;
    for (const sx of [-1.55, +1.55]) {
      for (let k = 0; k < 8; k++) {
        dm.position.set(sx, 3.22, -4.4 + k * 1.15);
        dm.updateMatrix();
        lInst.setMatrixAt(li++, dm.matrix);
      }
    }
    for (const sx of [-0.95, +0.95]) {
      dm.position.set(sx, 3.35, -7.45);
      dm.updateMatrix();
      lInst.setMatrixAt(li++, dm.matrix);
    }
    lInst.instanceMatrix.needsUpdate = true;
    junkBoatGroup.add(lInst);

    // 3 Tall Wooden Masts + Curved Scalloped Bat-Wing Crimson Junk Sails with Horizontal Bamboo Battens
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x3b2112, roughness: 0.72 });
    const sparMat = new THREE.MeshStandardMaterial({ color: 0x281409, roughness: 0.78 });
    const sailSpecs = [
      [-3.4, 8.8,  4.4, 6.2, -0.06], // Mizzen (aft)
      [+0.6, 11.4, 5.8, 8.0,  0.02], // Main (tallest hero center)
      [+4.8, 8.2,  4.0, 5.4,  0.14], // Foremast (raked forward)
    ];
    for (const [mz, mh, sw, sh, rake] of sailSpecs) {
      const mastGroup = new THREE.Group();
      mastGroup.position.set(0, 1.6, mz);
      mastGroup.rotation.x = rake;

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, mh, 10), mastMat);
      mast.position.y = mh * 0.5;
      mastGroup.add(mast);

      // Tapered scalloped junk sail geometry (wider at middle-top, curved outward wind belly!)
      const sailGeo = new THREE.PlaneGeometry(sw, sh, 10, 12);
      const sp = sailGeo.attributes.position;
      for (let i = 0; i < sp.count; i++) {
        let sx = sp.getX(i);
        const sy = sp.getY(i);
        const u = sx / (sw * 0.5);
        const v = (sy + sh * 0.5) / sh; // 0 bottom .. 1 top
        // Classic curved top/leach taper of Chinese lug sail
        const widthEnv = 0.82 + Math.sin(v * Math.PI * 0.82) * 0.25 - v * 0.18;
        sx *= widthEnv;
        const topDroop = (u > 0 ? u * 0.35 : 0) * v * 0.9;
        const belly = (1.0 - u * u * 0.75) * Math.sin(Math.max(0.08, v) * Math.PI) * 0.85;
        sp.setXYZ(i, sx, sy - topDroop, belly);
      }
      sailGeo.computeVertexNormals();
      const sail = new THREE.Mesh(sailGeo, sailMat);
      sail.rotation.y = Math.PI * 0.38;
      sail.position.set(0.28, 1.5 + sh * 0.5, 0);
      mastGroup.add(sail);

      // Horizontal dark bamboo batten spars across the sail
      for (let b = 0; b < 6; b++) {
        const by = 1.5 + (b / 5) * sh * 0.94;
        const bLen = sw * (0.85 + Math.sin((b / 5) * Math.PI * 0.8) * 0.20);
        const batten = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, bLen, 6), sparMat);
        batten.rotation.set(0, Math.PI * 0.38, Math.PI * 0.5);
        batten.position.set(0.32, by, 0);
        mastGroup.add(batten);
      }
      junkBoatGroup.add(mastGroup);
    }
  }

  // ============================================================================
  // 5. ORGANIC VICTORIA HARBOUR WATER SHADER (`Y = 0.0`) WITH CRIMSON JUNK REFLECTION
  // ============================================================================
  const waterUniforms = {
    uTime: atmoUniforms.uTime,
    uSunDir: atmoUniforms.uSunDir,
    uSkyMap: { value: backdropTex },
    uJunkPos: { value: new THREE.Vector2(20.0, -10.0) },
  };
  {
    const hwGeo = new THREE.PlaneGeometry(420, 320, 128, 128);
    hwGeo.rotateX(-Math.PI * 0.5);
    const hwMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: `
        uniform float uTime;
        varying vec3 vWPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += sin(wp.x * 0.16 + uTime * 0.90) * cos(wp.z * 0.14 - uTime * 0.70) * 0.03;
          vWPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform sampler2D uSkyMap;
        uniform vec2 uJunkPos;
        varying vec3 vWPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float waveH(vec2 xz) {
          float t = uTime;
          vec2 q1 = vec2(xz.x * 0.86 - xz.y * 0.50, xz.x * 0.50 + xz.y * 0.86);
          vec2 q2 = vec2(xz.x * 0.64 + xz.y * 0.77, -xz.x * 0.77 + xz.y * 0.64);
          float h = (vnoise(q1 * 0.52 + vec2(t * 0.30, -t * 0.24)) - 0.5) * 0.055;
          h += (vnoise(q2 * 1.45 - vec2(t * 0.55, t * 0.42)) - 0.5) * 0.030;
          h += (vnoise(xz * 3.40 + vec2(t * 0.85, -t * 0.68)) - 0.5) * 0.015;
          return h;
        }

        void main() {
          vec2 xz = vWPos.xz;
          float eps = 0.085;
          float h0 = waveH(xz);
          float hx = waveH(xz + vec2(eps, 0.0));
          float hz = waveH(xz + vec2(0.0, eps));
          vec3 nrm = normalize(vec3(h0 - hx, eps * 2.05, h0 - hz));

          vec2 dj = xz - uJunkPos;
          float rj = length(dj) + 1e-4;
          if (rj < 24.0) {
            float jOsc = sin(rj * 3.2 - uTime * 5.2) * exp(-rj * 0.16);
            nrm = normalize(vec3(nrm.x - (dj.x / rj) * jOsc * 0.14, nrm.y, nrm.z - (dj.y / rj) * jOsc * 0.14));
          }

          vec3 V = normalize(cameraPosition - vWPos);
          float NdotV = max(0.02, dot(nrm, V));
          float fresnel = 0.14 + 0.84 * pow(1.0 - NdotV, 3.0);

          // Reflect the Victoria Harbour backdrop photo!
          vec3 reflDir = normalize(reflect(-V, nrm));
          float reflU = clamp(0.5 + reflDir.x * 0.42 + nrm.x * 0.12, 0.04, 0.96);
          float reflV = clamp(0.22 + abs(reflDir.y) * 0.55, 0.20, 0.88);
          vec3 skyRefl = texture2D(uSkyMap, vec2(reflU, reflV)).rgb;

          vec3 deepHarbor = vec3(0.014, 0.040, 0.090);

          // Fiery crimson-orange reflection shimmer in front of Aqua Luna junk boat
          float junkColDist = abs(xz.x - uJunkPos.x);
          float junkZFade = smoothstep(-34.0, -24.0, xz.y) * smoothstep(+40.0, -10.0, xz.y);
          float junkWidth = exp(-pow(junkColDist / (4.2 + abs(xz.y - uJunkPos.y) * 0.15), 2.0));
          float junkRipple = smoothstep(0.32, 0.78, vnoise(vec2(xz.x * 1.3 + nrm.x * 4.8, xz.y * 0.42 + uTime * 0.9)));
          vec3 crimsonRefl = vec3(1.00, 0.22, 0.06) * junkWidth * junkZFade * (0.48 + junkRipple * 1.25);

          // Cool violet-blue reflection under Observation Wheel (X = -38)
          float wheelRefl = exp(-pow((xz.x + 38.0) / 10.0, 2.0)) * smoothstep(+12.0, -48.0, xz.y);

          vec3 col = mix(deepHarbor, skyRefl * 0.85, fresnel);
          col += crimsonRefl;
          col += vec3(0.48, 0.44, 1.00) * wheelRefl * (0.28 + fresnel * 0.35);

          vec3 H = normalize(normalize(uSunDir) + V);
          float NdotH = max(0.0, dot(nrm, H));
          col += vec3(1.00, 0.68, 0.34) * (pow(NdotH, 120.0) * 1.25 + pow(NdotH, 24.0) * 0.22);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const hwMesh = new THREE.Mesh(hwGeo, hwMat);
    hwMesh.position.set(0.0, 0.0, -70.0);
    group.add(hwMesh);
  }

  // ============================================================================
  // 6. OMNI 1.1 HARBOR MIST & NEON BOKEH VFX + VOLUMETRIC CLOUDS
  // ============================================================================
  const omniMist = createLoopingVideoTexture(`${HK_DIR}/hk_omni_harbor_mist.mp4`);
  const omniNeon = createLoopingVideoTexture(`${HK_DIR}/hk_omni_neon_firefly.mp4`);
  const makeOmniMat = (tex, op) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uMap: { value: tex }, uOpacity: { value: op } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uOpacity; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(uMap, vUv).rgb;
        float luma = dot(c, vec3(0.299, 0.587, 0.114));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x)
                   * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        float a = smoothstep(0.10, 0.50, luma) * edge * uOpacity;
        gl_FragColor = vec4(c, a);
      }
    `,
  });
  for (const [tex, op, px, py, pz, sx, sy, ry] of [
    [omniMist.tex, 0.32, -16, 4.5, -24, 52, 16, 0.0],
    [omniNeon.tex, 0.42, +16, 6.5, -28, 34, 16, -0.22],
  ]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(sx, sy), makeOmniMat(tex, op));
    p.position.set(px, py, pz);
    p.rotation.y = ry;
    p.renderOrder = 5;
    group.add(p);
  }

  const twilightClouds = createVolumetricCloudSystem({
    sunDir: SUN_DIR, litColor: 0xffc68c, shadeColor: 0x3b486b, opacity: 0.35,
    puffs: [
      { pos: [-55, 62, -115], scale: [38, 14, 22] },
      { pos: [ 45, 66, -120], scale: [42, 16, 24] },
    ],
  });
  group.add(twilightClouds.group);

  // ============================================================================
  // 7. EXACT CHOREOGRAPHY:
  //    Far side over water (beside Aqua Luna) -> Land on Wood Road (Z = +12) ->
  //    Turn Left toward Observation Wheel (X = -38) -> Turn Right & Climb Up toward Skyline!
  // ============================================================================
  const heroKeyframes = [
    { t:  0.0, pos: [+24.0, 6.4, -14.0] }, // Far-right over water right beside detailed Aqua Luna
    { t:  2.4, pos: [+15.5, 4.8, + 1.0] }, // Sweeping inward toward Wood Road
    { t:  4.8, pos: [+ 7.5, DECK_Y + WHEEL_R, +12.0] }, // Touchdown onto Wood Road!
    { t:  7.2, pos: [- 6.5, DECK_Y + WHEEL_R, +12.0] }, // Ride along Wood Road turning left
    { t:  9.4, pos: [-22.5, DECK_Y + WHEEL_R, +11.0] }, // Headed directly toward 摩天轮!
    { t: 11.4, pos: [-24.0, 7.2, -2.0] },  // Bank right & liftoff past Observation Wheel
    { t: 13.8, pos: [-10.0, 17.5, -38.0] }, // Climb upward toward Two IFC & The Center!
    { t: 16.0, pos: [+ 2.0, 28.0, -76.0] }, // High ascent facing full skyline (zero collision!)
  ];

  const heroTrack = createHeroTrajectory(heroKeyframes, DURATION, {
    smoothHalfWindowSec: 0.30,
    bankGain: 0.52,
    maxBankRad: 0.28,
    surfaceConstraintFn: (t, outPos) => {
      // Lock cleanly to Wood Road height during t = 4.6..9.6s
      const roadIn = quintic01(4.3, 4.9, t);
      const roadOut = 1.0 - quintic01(9.3, 9.8, t);
      const roadW = roadIn * roadOut;
      if (roadW > 0.001) {
        outPos.y = THREE.MathUtils.lerp(outPos.y, DECK_Y + WHEEL_R, roadW);
      }
    },
  });

  const HK_GAZE = [
    { t: 0.0, yaw: -0.15, pitch: -0.05 },
    { t: 5.0, yaw: +0.18, pitch: -0.02 },
    { t: 9.0, yaw: -0.22, pitch: +0.06 },
    { t: 13.5, yaw: 0.0, pitch: +0.12 },
  ];

  const pHero = new THREE.Vector3();
  const vTang = new THREE.Vector3();
  const vHoriz = new THREE.Vector3();
  const tmpH = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpHz = new THREE.Vector3();

  const applyStabilizedCam = createStabilizedCameraDirector((tc, outPos, outLook) => {
    heroTrack.evaluate(tc, tmpH, tmpT, tmpHz);

    // Phase 0 (t=0..5.2s): Camera stays on south harbour side (+Z) showing full Victoria Harbour panorama
    //   while following Pelican from far water -> Wood Road touchdown (NEVER turns away from skyline!)
    // Phase 1 (t=5.2..9.5s): Follow Pelican along Wood Road turning left toward Observation Wheel
    // Phase 2 (t=9.5..16.0s): Follow Pelican turning right & climbing up toward the Victoria Harbour skyline!
    const wFullToRoad = 1.0 - quintic01(4.4, 6.2, tc);
    const wWheelTurn  = quintic01(5.2, 9.2, tc) * (1.0 - quintic01(9.2, 11.4, tc));
    const wClimb      = quintic01(9.5, 13.0, tc);

    const t01 = quintic01(0.0, 5.0, tc);
    const fullCamPos = new THREE.Vector3(
      THREE.MathUtils.lerp(0.0, +10.5, t01),
      THREE.MathUtils.lerp(9.6, 6.2, t01),
      THREE.MathUtils.lerp(46.0, 22.5, t01)
    );
    const fullLookAt = new THREE.Vector3(
      THREE.MathUtils.lerp(0.0, tmpH.x * 0.65 - 2.0, t01),
      THREE.MathUtils.lerp(15.0, 6.2, t01),
      THREE.MathUtils.lerp(-40.0, -12.0, t01)
    );

    // Chase camera behind/beside Pelican during Wood Road & Climb
    let rightOff = THREE.MathUtils.lerp(+1.6, +2.1, wWheelTurn);
    rightOff = THREE.MathUtils.lerp(rightOff, -2.0, wClimb);

    const aheadOff = THREE.MathUtils.lerp(-4.2, -3.5, wClimb);
    const upOff = THREE.MathUtils.lerp(1.35, 1.15, wClimb);

    const chasePos = new THREE.Vector3();
    const chaseLook = new THREE.Vector3();
    applyHorizontalOffset(tmpH, tmpHz, rightOff, upOff, aheadOff, chasePos);
    chasePos.y = Math.max(1.8, chasePos.y);
    applyHorizontalOffset(tmpH, tmpHz, THREE.MathUtils.lerp(-0.4, 0.0, wClimb), 1.35, 9.0, chaseLook);

    outPos.lerpVectors(chasePos, fullCamPos, wFullToRoad);
    outLook.lerpVectors(chaseLook, fullLookAt, wFullToRoad);

    return THREE.MathUtils.lerp(52.0, 56.0, wFullToRoad);
  }, DURATION, 0.30);

  function update(tLocal, tGlobal, pelicanRig, camera) {
    const tCycle = THREE.MathUtils.clamp(tLocal, 0.0, DURATION);
    atmoUniforms.uTime.value = tGlobal;
    twilightClouds.update(tGlobal);

    const wheelAng = tGlobal * 0.14;
    wheelSpinner.rotation.z = wheelAng;
    for (const piv of gondolaPivots) piv.rotation.z = -wheelAng;

    junkBoatGroup.position.x = 20.0 - Math.sin(tGlobal * 0.10) * 1.2;
    waterUniforms.uJunkPos.value.set(junkBoatGroup.position.x, junkBoatGroup.position.z);

    const roadIn = quintic01(4.3, 4.9, tCycle);
    const roadOut = 1.0 - quintic01(9.3, 9.8, tCycle);
    const groundRide01 = roadIn * roadOut;
    const liftoffBoost = 1.0 - groundRide01;
    const bankRad = heroTrack.evaluate(tCycle, pHero, vTang, vHoriz) * (1.0 - groundRide01 * 0.94);

    pelicanRig.update(tGlobal, {
      position: pHero, tangent: vTang, bankRad,
      thrust: groundRide01 * 0.08 + liftoffBoost * 1.38,
      windStrength: THREE.MathUtils.lerp(1.05, 1.42, liftoffBoost),
      pedalRate: 5.2, groundRide01, nightLamp01: 0.72,
      tCycle, gazeSchedule: HK_GAZE, cycleLen: DURATION,
    });

    sunLight.target.position.copy(pHero);
    sunLight.position.copy(pHero).addScaledVector(SUN_DIR, 95.0);
    applyStabilizedCam(tCycle, camera);

    return {
      beatText: '维多利亚港 · 远海红帆船畔降落中环木栈道，左转摩天轮后右转腾空直冲维港天际线',
      fogDensityOverride: 0.0008,
    };
  }

  return {
    id: 9,
    slug: 'hongkong',
    nameZh: '香港维多利亚港',
    titleZh: '香港维多利亚港 · 维港全景与红帆摩天轮',
    duration: DURATION,
    group,
    envTexture,
    envIntensity: 0.92,
    fogColor: new THREE.Color(0x132642),
    fogDensity: 0.0008,
    exposure: 1.06,
    transitionColor: '#ffbe82',
    omniVideos: [omniMist.vid, omniNeon.vid],
    stageTris: 14500,
    update,
  };
}
