import { usePerformance } from '@/contexts/PerformanceContext';

export function usePerformanceBudget() {
  const perf = usePerformance();
  const isEntryTier = perf.tierInfo.tier === 'entry_2gb_quad';
  const isMidTier = perf.tierInfo.tier === 'mid_3gb_quad';
  const allowSensorEffects = perf.lod <= 1;
  const shouldUseSpriteAtlas = perf.flags.perfV2Enabled && perf.flags.spriteAtlasEnabled;

  return {
    ...perf,
    isEntryTier,
    isMidTier,
    allowSensorEffects,
    shouldUseSpriteAtlas,
  };
}
