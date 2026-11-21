// ============================================================================
// PROGRESSIVE CHUNKED STREAMING & GPU MEMORY RECYCLING MANAGER (`station_stream_manager.js`)
// V3.5 High-FPS Hitch-Free Edition:
// - Instant startup: loads ONLY Station 01 to begin 60-FPS cinema playback immediately.
// - Deferred background prefetch + Async GPU Shader Pre-Compilation (`compileAsync`):
//   streams & compiles Station (i + 1) on background GPU threads AFTER Station i settles,
//   eliminating first-frame shader compilation freezes on station switches!
// - Immediate GPU & Video decoder recycling (`disposeStationResources`).
// ============================================================================
import { disposeStationResources } from './volumetric_clouds.js';
import { applyStationHdPbrUpgrade } from './hd_pbr_upgrader.js';

const yieldFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function createStationStreamManager({
  renderer,
  scene,
  camera,
  pelicanRig,
  stationManifest,
}) {
  const count = stationManifest.length;
  const loaded = new Array(count).fill(null);
  const inflight = new Array(count).fill(null);

  let totalFilmDuration = 0;
  const stationOffsets = stationManifest.map((m) => {
    const start = totalFilmDuration;
    totalFilmDuration += m.duration;
    return { start, end: totalFilmDuration, duration: m.duration };
  });

  async function ensureStationLoaded(idx, opts = {}) {
    const i = ((idx % count) + count) % count;
    if (loaded[i]) return loaded[i];
    if (inflight[i]) return inflight[i];

    const entry = stationManifest[i];
    const isBg = Boolean(opts.background);
    inflight[i] = (async () => {
      try {
        if (isBg) await yieldFrame();
        const mod = await import(entry.modulePath);
        if (isBg) await yieldFrame();
        const st = await mod.createStation(renderer);
        await applyStationHdPbrUpgrade(i + 1, st.group, renderer);
        (st.omniVideos || []).forEach((v) => {
          try { v.pause(); } catch (e) {}
        });
        // Pre-compile GLSL shaders asynchronously in background before station transition!
        if (isBg && typeof renderer.compileAsync === 'function') {
          await yieldFrame();
          try {
            st.group.visible = true;
            await renderer.compileAsync(st.group, camera, scene);
          } catch (e) {
            // Safe fallback if compileAsync encounters custom uniforms not yet bound
          }
        }
        st.group.visible = false;
        loaded[i] = st;
        return st;
      } finally {
        inflight[i] = null;
      }
    })();

    return inflight[i];
  }

  function recycleDistantStations(keepIndices) {
    const keep = new Set(keepIndices.map((k) => ((k % count) + count) % count));
    let disposedAny = false;
    for (let i = 0; i < count; i++) {
      if (loaded[i] && !keep.has(i)) {
        const st = loaded[i];
        loaded[i] = null;
        disposeStationResources(st, scene);
        disposedAny = true;
      }
    }
    if (disposedAny && renderer.renderLists) {
      renderer.renderLists.dispose();
    }
  }

  function prefetchNext(activeIdx) {
    const nextIdx = (activeIdx + 1) % count;
    if (loaded[nextIdx] || inflight[nextIdx]) return;
    ensureStationLoaded(nextIdx, { background: true }).catch((err) => {
      console.warn('[StreamManager] Prefetch warning:', err);
    });
  }

  function getLoadedStatus() {
    return loaded.map((st, idx) => ({
      station: idx + 1,
      slug: stationManifest[idx].slug,
      resident: Boolean(st),
      loading: Boolean(inflight[idx]),
    }));
  }

  return {
    count,
    stationManifest,
    stationOffsets,
    totalFilmDuration,
    ensureStationLoaded,
    recycleDistantStations,
    prefetchNext,
    getLoadedStatus,
    getStationSync: (idx) => loaded[((idx % count) + count) % count],
  };
}
