# Final Performance Summary - 2026-03-23

## Release Decision
- Decision: pending
- Scope: Android first

## Before/After
| Metric | Entry target | Mid target | Reference target | Before | After | Status |
|---|---:|---:|---:|---:|---:|---|
| UI FPS p95 | >=30 | >=45 | >=55 | - | - | - |
| Frame p95 ms | <=33 | <=22 | <=18 | - | - | - |
| Dropped frames % | <=8 | <=4 | <=2 | - | - | - |
| PSS peak MB | <=430 | <=520 | <=620 | - | - | - |
| CPU avg % | <=55 | <=45 | <=35 | - | - | - |
| Battery drop 30m % | <=9 | <=7 | <=5.5 | - | - | - |

## Files Changed
- `services/performance/*`
- `contexts/PerformanceContext.tsx`
- `hooks/usePerformanceBudget.ts`
- `components/performance/PerformanceHUD.tsx`
- `components/animation/SpriteAtlasPlayer.tsx`
- `scripts/perf/*`

## Risks
- Atlas assets still require production generation pipeline.
- GPU batching currently uses scheduler/object pooling path; full native batching can be expanded if needed.
