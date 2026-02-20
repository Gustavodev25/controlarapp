# Performance Feature Flags

Storage key: `@controlar/perf_flags_v2`

Supported keys:
- `perfV2Enabled` or `perf_v2_enabled`
- `lodDynamicEnabled` or `lod_dynamic_enabled`
- `spriteAtlasEnabled` or `sprite_atlas_enabled`
- `adaptiveFpsEnabled` or `adaptive_fps_enabled`

## A/B Mapping
- Variant A (baseline):
  - all flags `false`
- Variant B (optimized):
  - all flags `true`

Use helpers:
- `getVariantFlags('A' | 'B')`
- `setPerformanceFlags(flags)`
