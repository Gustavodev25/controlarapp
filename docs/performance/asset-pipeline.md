# Asset Optimization Pipeline (ASTC/ETC2 + LOD)

## Goals
- Keep animation quality perceptually identical on mid/high tiers
- Reduce GPU bandwidth and decode cost on entry tier
- Enforce predictable size budgets for CI

## Texture Compression Profiles
- `ASTC` profile:
  - Use on devices with ASTC support
  - Preferred for quality/size balance
- `ETC2` profile:
  - Fallback for broader Android compatibility
- `WebP` fallback:
  - Runtime fallback for devices/toolchains without KTX2 pipeline support

## Suggested Offline Commands
- Atlas PNG -> KTX2 (ASTC):
  - `basisu -ktx2 -uastc -uastc_level 2 -q 128 -output_file atlas_astc atlas.png`
- Atlas PNG -> KTX2 (ETC1S):
  - `basisu -ktx2 -comp_level 3 -q 180 -output_file atlas_etc2 atlas.png`

## 3D LOD Policy (Future-ready)
- LOD0: 100% triangles, max `120k`
- LOD1: 60% triangles, max `72k`
- LOD2: 35% triangles, max `42k`

## CI Checks
- Run `npm run perf:check-assets`
- Fail build when:
  - PNG > 700 KB
  - GLB/GLTF/OBJ/FBX > 2 MB

## Current Status
- No 3D models found in `assets/`
- Pipeline is ready for future 3D asset introduction
