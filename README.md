# Pelican Over China

Real-time 60-FPS 3D WebGL browser experience powered by **Gemini 4 Hydrogen + Blender 3D**, Nano Banana 2.1 PBR textures, and Omni 1.1 dynamic VFX.

## Highlights
- **8 Iconic Landmarks (138s Continuous Flight)**: Great Wall, Zhangjiajie Wulingyuan, Guilin Li River, Potala Palace, Forbidden City, Dunhuang Crescent Lake, Chongqing Hongyadong, and Shanghai Bund.
- **Chunked Progressive Streaming & GPU Disposal**: Loads only the active station + background-prefetches the next station, disposing distant geometries, textures, and video decoders automatically.
- **Interactive Pause Look-Around**: Pause at any moment to drag and rotate the camera around the current viewpoint.

## Quick Local Run
```bash
python3 -m http.server 8765
# Open http://localhost:8765/pelican_soarin_china_3d_master.html
```

## Deploy to Google Cloud Run
```bash
gcloud run deploy pelican-over-china --source . --region us-central1 --allow-unauthenticated --memory 1Gi --cpu 1
```
