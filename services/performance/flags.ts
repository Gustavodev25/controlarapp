import AsyncStorage from '@react-native-async-storage/async-storage';
import { PerformanceFeatureFlags } from './types';

export const PERFORMANCE_FLAGS_STORAGE_KEY = '@controlar/perf_flags_v2';

export const DEFAULT_PERFORMANCE_FLAGS: PerformanceFeatureFlags = {
  perfV2Enabled: true,
  lodDynamicEnabled: true,
  spriteAtlasEnabled: true,
  adaptiveFpsEnabled: true,
};

export async function getPerformanceFlags(): Promise<PerformanceFeatureFlags> {
  try {
    const raw = await AsyncStorage.getItem(PERFORMANCE_FLAGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PERFORMANCE_FLAGS;
    }
    const parsed = JSON.parse(raw) as Partial<PerformanceFeatureFlags>;
    return {
      perfV2Enabled: parsed.perfV2Enabled ?? DEFAULT_PERFORMANCE_FLAGS.perfV2Enabled,
      lodDynamicEnabled: parsed.lodDynamicEnabled ?? DEFAULT_PERFORMANCE_FLAGS.lodDynamicEnabled,
      spriteAtlasEnabled: parsed.spriteAtlasEnabled ?? DEFAULT_PERFORMANCE_FLAGS.spriteAtlasEnabled,
      adaptiveFpsEnabled: parsed.adaptiveFpsEnabled ?? DEFAULT_PERFORMANCE_FLAGS.adaptiveFpsEnabled,
    };
  } catch {
    return DEFAULT_PERFORMANCE_FLAGS;
  }
}

export async function setPerformanceFlags(flags: PerformanceFeatureFlags): Promise<void> {
  await AsyncStorage.setItem(PERFORMANCE_FLAGS_STORAGE_KEY, JSON.stringify(flags));
}

export function getVariantFlags(variant: 'A' | 'B'): PerformanceFeatureFlags {
  if (variant === 'A') {
    return {
      perfV2Enabled: false,
      lodDynamicEnabled: false,
      spriteAtlasEnabled: false,
      adaptiveFpsEnabled: false,
    };
  }
  return {
    perfV2Enabled: true,
    lodDynamicEnabled: true,
    spriteAtlasEnabled: true,
    adaptiveFpsEnabled: true,
  };
}
