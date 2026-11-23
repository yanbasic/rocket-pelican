# Rocket Pelican

Real-time 60-FPS 3D WebGL browser experience powered by **Gemini 4 Hydrogen + Blender**, Nano Banana 2.1 PBR textures, and Omni 1.1 dynamic VFX.

## Highlights
- **7 Core Landmarks (Default · 122s Continuous Flight)**: Great Wall, Zhangjiajie Wulingyuan, Potala Palace, Dunhuang Crescent Lake, Hong Kong Victoria Harbour, Chongqing Hongyadong, and Shanghai Bund.
- **9 Landmarks Full Edition (`Shift` on Loading Screen or `?full=1` · 154s)**: Adds Forbidden City & Guilin Li River in a seamless sunrise-to-fireworks progression.
- **Chunked Progressive Streaming & GPU Disposal**: Loads only the active station + background-prefetches the next station, disposing distant geometries, textures, and video decoders automatically.
- **Interactive Pause Look-Around**: Pause at any moment to drag and rotate the camera around the current viewpoint.

## Quick Local Run
```bash
python3 -m http.server 8765
# Open http://localhost:8765/pelican_soarin_china_3d_master.html
```

## Live Demo
- GitHub Pages: https://yanbasic.github.io/rocket-pelican/
- Google Cloud Run: https://rocket-pelican-996912212833.us-central1.run.app
