// ============================================================================
// SHARED ULTRA-HD NANO BANANA 2.1 PBR MATERIAL UPGRADE ENGINE (`hd_pbr_upgrader.js`)
// Upgrades all 8 Soarin' Over China 3D station stages with 40 bespoke 1536²/1024²
// seamlessly tiled PBR material sets (125 Albedo + Multi-Scale Scharr Normal +
// Roughness + Emissive maps):
// - Disposes superseded low-res embedded GLB textures immediately (zero VRAM bloat!)
// - Calibrates exact UV repeat & normal relief per architectural/natural material
// - Uses 8x anisotropic filtering on hero surfaces for razor-sharp grazing angles
// - Fully compatible with `disposeStationResources` progressive memory recycling!
// ============================================================================
import * as THREE from 'three';

const STATION_PBR_REGISTRY = {
  // ================= STATION 01: GREAT WALL =================
  1: {
    dir: './assets/soarin_scene1_gw',
    sets: {
      ming_brick:    { file: 'hd_s1_ming_brick',    em: false },
      granite_steps: { file: 'hd_s1_granite_steps', em: false },
      xieshan_tiles: { file: 'hd_s1_xieshan_tiles', em: false },
      dougong:       { file: 'hd_s1_dougong_timber',em: false },
      pine_canopy:   { file: 'hd_s1_pine_canopy',   em: false },
    },
    bindings: [
      { match: 'Mat_GW_BrickWall',      set: 'ming_brick',    repeat: [1.35, 1.35], normalScale: 1.35, color: 0xfbf4ea },
      { match: 'Mat_GW_GraniteSteps',   set: 'granite_steps', repeat: [1.50, 1.50], normalScale: 1.30, color: 0xfcfaf5 },
      { match: 'Mat_GW_RoofTiles',      set: 'xieshan_tiles', repeat: [1.45, 1.45], normalScale: 1.40, color: 0x8d97a3 },
      { match: 'Mat_GW_PaintedDougong', set: 'dougong',       repeat: [1.20, 1.20], normalScale: 1.10, color: 0xffffff },
      { match: 'Mat_GW_CrimsonTimber',  set: 'dougong',       repeat: [1.00, 1.00], normalScale: 0.95, color: 0xc84638 },
      { match: 'Mat_GW_PineNeedles',    set: 'pine_canopy',   repeat: [1.40, 1.40], normalScale: 1.15, color: 0x82ae58 },
      { match: 'Mat_GW_ForestCanopy',   set: 'pine_canopy',   repeat: [1.60, 1.60], normalScale: 1.10, color: 0x88b65c },
      { match: 'Mat_GW_MountainForest', set: 'pine_canopy',   repeat: [2.40, 2.40], normalScale: 1.25, color: 0x7eac54 },
    ],
  },

  // ================= STATION 02: ZHANGJIAJIE =================
  2: {
    dir: './assets/soarin_scene2_zhangjiajie',
    sets: {
      sandstone: { file: 'hd_s2_quartz_sandstone',    em: false },
      caprock:   { file: 'hd_s2_mossy_caprock',       em: false },
      needles:   { file: 'hd_s2_wuling_pine_needles', em: false },
      bark:      { file: 'hd_s2_red_pine_bark',       em: false },
      spillway:  { file: 'hd_s2_wet_spillway_rock',   em: false },
    },
    bindings: [
      { match: 'Mat_ZJJ_WetBlockSandstone',  set: 'sandstone', repeat: [2.40, 2.40], normalScale: 1.55, color: 0xfff5e8 },
      { match: 'Mat_ZJJ_SandstoneStrata',    set: 'sandstone', repeat: [2.20, 2.20], normalScale: 1.45, color: 0xfff2e2 },
      { match: 'Mat_ZJJ_MossyCaprock',       set: 'caprock',   repeat: [2.00, 2.00], normalScale: 1.30, color: 0x6ba054 },
      { match: 'Mat_ZJJ_PineNeedles',        set: 'needles',   repeat: [1.50, 1.50], normalScale: 1.20, color: 0x78ac56 },
      { match: 'Mat_ZJJ_PineBark',           set: 'bark',      repeat: [1.40, 1.40], normalScale: 1.35, color: 0xb88e6e },
      { match: 'Mat_ZJJ_GlisteningSpillway', set: 'spillway',  repeat: [2.00, 2.00], normalScale: 1.25, color: 0x9aa4aa, roughnessBias: 0.28 },
      { match: 'Mat_ZJJ_CliffStoneWalk',     set: 'spillway',  repeat: [1.60, 1.60], normalScale: 1.20, color: 0xe6dfd2 },
    ],
  },

  // ================= STATION 03: GUILIN LI RIVER =================
  3: {
    dir: './assets/soarin_scene3_guilin',
    sets: {
      karst:   { file: 'hd_s3_velvet_karst',          em: false },
      weave:   { file: 'hd_s3_golden_bamboo_weave',   em: false },
      foliage: { file: 'hd_s3_bamboo_foliage',        em: false },
      tiles:   { file: 'hd_s3_glazed_pavilion_tiles', em: false },
      pebbles: { file: 'hd_s3_river_pebble_stone',    em: false },
    },
    bindings: [
      { match: 'Mat_GL_VelvetKarst',    set: 'karst',   repeat: [2.20, 2.20], normalScale: 1.45, color: 0xbde09a },
      { match: 'Mat_GL_KarstLimestone', set: 'karst',   repeat: [1.80, 1.80], normalScale: 1.40, color: 0xd8dfd0 },
      { match: 'Mat_GL_WovenBamboo',    set: 'weave',   repeat: [1.60, 1.60], normalScale: 1.25, color: 0xfbe2a8 },
      { match: 'Mat_GL_WeatheredStraw', set: 'weave',   repeat: [1.80, 1.80], normalScale: 1.30, color: 0xd8b276 },
      { match: 'Mat_GL_BambooLeaf',     set: 'foliage', repeat: [1.50, 1.50], normalScale: 1.15, color: 0xc2ec7e },
      { match: 'Mat_GL_LushCanopy',     set: 'foliage', repeat: [1.80, 1.80], normalScale: 1.20, color: 0x9ed678 },
      { match: 'Mat_GL_PavilionTiles',  set: 'tiles',   repeat: [1.60, 1.60], normalScale: 1.35, color: 0x94a8ac },
      { match: 'Mat_GL_PebbleBank',     set: 'pebbles', repeat: [1.80, 1.80], normalScale: 1.35, color: 0xe6e8da },
    ],
  },

  // ================= STATION 04: TIBET POTALA PALACE =================
  4: {
    dir: './assets/soarin_scene4_potala',
    sets: {
      white_stone: { file: 'hd_s4_white_palace_stone',    em: false },
      red_bianma:  { file: 'hd_s4_red_palace_bianma',     em: false },
      gold_roof:   { file: 'hd_s4_hammered_gold_roof',    em: false },
      town_facade: { file: 'hd_s4_tibetan_town_facade',   em: false },
      snow_rock:   { file: 'hd_s4_himalaya_snow_granite', em: false },
    },
    bindings: [
      { match: 'Mat_PT_WhitePalace',     set: 'white_stone', repeat: [1.80, 1.80], normalScale: 1.30, color: 0xfffdf8 },
      { match: 'Mat_PT_WhiteStoneSteps', set: 'white_stone', repeat: [1.60, 1.60], normalScale: 1.25, color: 0xfaf7f0 },
      { match: 'Mat_PT_RedPalace',       set: 'red_bianma',  repeat: [1.60, 1.60], normalScale: 1.38, color: 0xe86254 },
      { match: 'Mat_PT_BianmaMaroon',    set: 'red_bianma',  repeat: [1.80, 1.80], normalScale: 1.45, color: 0x8e2c2a },
      { match: 'Mat_PT_GildedGold',      set: 'gold_roof',   repeat: [1.80, 1.80], normalScale: 1.35, color: 0xffd862, metalness: 0.88, roughnessBias: 0.24 },
      { match: 'Mat_PT_SnowPeaks',       set: 'snow_rock',   repeat: [2.80, 2.80], normalScale: 1.35, color: 0xffffff },
    ],
  },

  // ================= STATION 05: BEIJING FORBIDDEN CITY =================
  5: {
    dir: './assets/soarin_scene5_forbiddencity',
    sets: {
      yellow_tiles: { file: 'hd_s5_imperial_yellow_tiles',   em: false },
      marble:       { file: 'hd_s5_carved_hanbaiyu_marble',  em: false },
      paving:       { file: 'hd_s5_imperial_stone_paving',   em: false },
      lattice:      { file: 'hd_s5_vermilion_lattice_doors', em: false },
      grey_brick:   { file: 'hd_s5_ming_city_brick_tile',    em: false },
    },
    bindings: [
      { match: 'Mat_FC_ImperialYellowTiles', set: 'yellow_tiles', repeat: [2.10, 2.10], normalScale: 1.45, color: 0xffcf48, roughnessBias: 0.30 },
      { match: 'Mat_FC_WhiteMarble',         set: 'marble',       repeat: [1.60, 1.60], normalScale: 1.25, color: 0xfffcf5 },
      { match: 'Mat_FC_PalacePaving',        set: 'paving',       repeat: [1.85, 1.85], normalScale: 1.30, color: 0xfbf8f2 },
      { match: 'Mat_FC_CrimsonLacquerCol',   set: 'lattice',      repeat: [1.40, 1.40], normalScale: 1.25, color: 0xf46048 },
      { match: 'Mat_FC_FortressGreyBrick',   set: 'grey_brick',   repeat: [1.80, 1.80], normalScale: 1.35, color: 0xbec0c4 },
      { match: 'Mat_FC_HutongGreyTiles',     set: 'grey_brick',   repeat: [2.00, 2.00], normalScale: 1.35, color: 0x9a9da4 },
    ],
  },

  // ================= STATION 06: DUNHUANG CRESCENT MOON SPRING =================
  6: {
    dir: './assets/soarin_scene6_dunhuang',
    sets: {
      sand:    { file: 'hd_s6_rippled_golden_sand',   em: false },
      brocade: { file: 'hd_s6_tang_silkroad_brocade', em: false },
      fur:     { file: 'hd_s6_bactrian_camel_fur',    em: false },
      tiles:   { file: 'hd_s6_yueya_glazed_tiles',    em: false },
      bark:    { file: 'hd_s6_desert_poplar_bark',    em: false },
    },
    bindings: [
      { match: 'Mat_DH_GoldenSand',     set: 'sand',    repeat: [2.20, 2.20], normalScale: 1.35, color: 0xfff5e2 },
      { match: 'Mat_DH_SandFootprints', set: 'sand',    repeat: [1.80, 1.80], normalScale: 1.45, color: 0xe6c89a },
      { match: 'Mat_DH_SilkRoadRug',    set: 'brocade', repeat: [1.40, 1.40], normalScale: 1.25, color: 0xffffff },
      { match: 'Mat_DH_CamelFur',       set: 'fur',     repeat: [1.50, 1.50], normalScale: 1.20, color: 0xdca068 },
      { match: 'Mat_DH_PavilionTiles',  set: 'tiles',   repeat: [1.60, 1.60], normalScale: 1.35, color: 0xc2ab8e },
      { match: 'Mat_DH_HuyangBark',     set: 'bark',    repeat: [1.50, 1.50], normalScale: 1.40, color: 0xdcb88e },
    ],
  },

  // ================= STATION 07: CHONGQING HONGYADONG =================
  7: {
    dir: './assets/soarin_scene7_hongyadong',
    sets: {
      skyscraper: { file: 'hd_s7_chongqing_skyscraper_night', em: true  },
      asphalt:    { file: 'hd_s7_bridge_asphalt_road',        em: false },
      lattice:    { file: 'hd_s7_bayu_glowing_lattice',       em: true  },
      tiles:      { file: 'hd_s7_sichuan_dark_tiles',         em: false },
      embankment: { file: 'hd_s7_carved_cliff_embankment',    em: false },
    },
    bindings: [
      { match: 'Mat_HYD_RoadDeck',   set: 'asphalt',    repeat: [2.40, 2.40], normalScale: 1.25, color: 0x748296 },
      { match: 'Mat_HYD_LitWindows', set: 'lattice',    repeat: [1.45, 1.45], normalScale: 1.25, color: 0xffe49e, emissive: 0xffa832, emissiveIntensity: 2.15 },
      { match: 'Mat_HYD_GreyTiles',  set: 'tiles',      repeat: [1.75, 1.75], normalScale: 1.40, color: 0xc8b294 },
      { match: 'Mat_HYD_CliffStone', set: 'embankment', repeat: [2.00, 2.00], normalScale: 1.45, color: 0x8e9eb6 },
    ],
  },

  // ================= STATION 08: SHANGHAI BUND & LUJIAZUI =================
  8: {
    dir: './assets/soarin_scene8_shanghai',
    sets: {
      supertall: { file: 'hd_s8_lujiazui_supertall_glass', em: true  },
      bund_stone:{ file: 'hd_s8_bund_artdeco_granite',     em: true  },
      pearl_gem: { file: 'hd_s8_pearl_ruby_geodesic',      em: true  },
      copper:    { file: 'hd_s8_verdigris_copper_dome',    em: false },
      porphyry:  { file: 'hd_s8_bund_porphyry_paving',     em: false },
    },
    bindings: [
      { match: 'Mat_SH_GlassCurtain_Cool',      set: 'supertall', repeat: [2.40, 2.40], normalScale: 1.15, color: 0x9cd2ff, emissive: 0x92d4ff, emissiveIntensity: 1.55 },
      { match: 'Mat_SH_GlassCurtain_Warm',      set: 'supertall', repeat: [2.40, 2.40], normalScale: 1.15, color: 0xffe8c2, emissive: 0xffd28a, emissiveIntensity: 1.65 },
      { match: 'Mat_SH_Bund_Neoclassical',      set: 'bund_stone',repeat: [1.80, 1.80], normalScale: 1.35, color: 0xfff0d4, emissive: 0xffc668, emissiveIntensity: 1.25 },
      { match: 'Mat_SH_Bund_CarvedStoneTrim',   set: 'bund_stone',repeat: [1.60, 1.60], normalScale: 1.35, color: 0xffebc4 },
      { match: 'Mat_SH_Glow_PearlSpheres',      set: 'pearl_gem', repeat: [1.60, 1.60], normalScale: 1.30, color: 0x8e1248, emissive: 0xff248c, emissiveIntensity: 1.95 },
      { match: 'Mat_SH_PeaceHotel_Copper',      set: 'copper',    repeat: [1.60, 1.60], normalScale: 1.30, color: 0x46b892 },
      { match: 'Mat_SH_Promenade_Walkway',      set: 'porphyry',  repeat: [2.20, 2.20], normalScale: 1.30, color: 0xd4c8ba },
    ],
  },
};

function loadTexAsync(loader, url, isSrgb, maxAniso) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = maxAniso;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function cloneWithRepeat(tex, rx, ry) {
  if (!tex) return null;
  if (Math.abs(rx - 1.0) < 1e-3 && Math.abs(ry - 1.0) < 1e-3) return tex;
  const c = tex.clone();
  c.wrapS = THREE.RepeatWrapping;
  c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.colorSpace = tex.colorSpace;
  c.anisotropy = tex.anisotropy;
  c.needsUpdate = true;
  return c;
}

/**
 * Loads & binds all Ultra-HD NB 2.1 PBR sets for `stationId` (`1..8`) onto `rootGroup`,
 * freeing superseded embedded GLB textures immediately so VRAM stays lean & crisp!
 */
export async function applyStationHdPbrUpgrade(stationId, rootGroup, renderer) {
  const cfg = STATION_PBR_REGISTRY[stationId];
  if (!cfg || !rootGroup) return {};
  if (rootGroup.userData.__hdPbrUpgraded) return rootGroup.userData.__hdPbrSets || {};

  const loader = new THREE.TextureLoader();
  const heroAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  const loadedSets = {};

  await Promise.all(
    Object.entries(cfg.sets).map(async ([key, s]) => {
      const base = `${cfg.dir}/${s.file}`;
      const [albedo, normal, roughness, emissive] = await Promise.all([
        loadTexAsync(loader, `${base}_albedo.jpg`, true, heroAniso),
        loadTexAsync(loader, `${base}_normal.jpg`, false, heroAniso),
        loadTexAsync(loader, `${base}_roughness.jpg`, false, heroAniso),
        s.em ? loadTexAsync(loader, `${base}_emissive.jpg`, true, heroAniso) : Promise.resolve(null),
      ]);
      loadedSets[key] = { albedo, normal, roughness, emissive };
    })
  );

  const upgradedMats = new Set();
  const disposedOldTex = new Set();

  const replaceSlot = (mat, slot, newTex) => {
    if (!newTex) return;
    const oldTex = mat[slot];
    if (oldTex && oldTex !== newTex && !disposedOldTex.has(oldTex.uuid)) {
      disposedOldTex.add(oldTex.uuid);
      oldTex.dispose();
    }
    mat[slot] = newTex;
  };

  rootGroup.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m || upgradedMats.has(m.uuid)) continue;
      const mName = m.name || '';
      const rule = cfg.bindings.find((b) => mName.includes(b.match));
      if (!rule) continue;
      const texSet = loadedSets[rule.set];
      if (!texSet || !texSet.albedo) continue;

      upgradedMats.add(m.uuid);
      const [rx, ry] = rule.repeat || [1, 1];
      replaceSlot(m, 'map', cloneWithRepeat(texSet.albedo, rx, ry));
      replaceSlot(m, 'normalMap', cloneWithRepeat(texSet.normal, rx, ry));
      replaceSlot(m, 'roughnessMap', cloneWithRepeat(texSet.roughness, rx, ry));
      if (texSet.emissive) {
        replaceSlot(m, 'emissiveMap', cloneWithRepeat(texSet.emissive, rx, ry));
      }

      if (m.normalScale && rule.normalScale !== undefined) {
        m.normalScale.set(rule.normalScale, rule.normalScale);
      }
      if (rule.color !== undefined && m.color) {
        m.color.setHex(rule.color);
      }
      if (rule.metalness !== undefined && 'metalness' in m) {
        m.metalness = rule.metalness;
      }
      if (rule.roughnessBias !== undefined && 'roughness' in m) {
        m.roughness = rule.roughnessBias;
      }
      if (rule.emissive !== undefined && m.emissive) {
        m.emissive.setHex(rule.emissive);
      }
      if (rule.emissiveIntensity !== undefined && 'emissiveIntensity' in m) {
        m.emissiveIntensity = rule.emissiveIntensity;
      }
      m.needsUpdate = true;
    }
  });

  rootGroup.userData.__hdPbrUpgraded = true;
  rootGroup.userData.__hdPbrSets = loadedSets;
  return loadedSets;
}
