import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  animationScheduler,
  clampLod,
  createLodHysteresisState,
  DEFAULT_PERFORMANCE_FLAGS,
  detectDeviceTier,
  getAnimationBudget,
  getInitialLod,
  PERFORMANCE_FLAGS_STORAGE_KEY,
  runtimeMonitor,
  updateLodWithHysteresis,
} from '@/services/performance';
import {
  AnimationBudget,
  DeviceTierInfo,
  LodLevel,
  PerfSample,
  PerformanceConfig,
  PerformanceFeatureFlags,
} from '@/services/performance/types';

const DEFAULT_FLAGS: PerformanceFeatureFlags = DEFAULT_PERFORMANCE_FLAGS;

const DEFAULT_CONFIG: PerformanceConfig = {
  realtimeHud: __DEV__,
  logToFile: __DEV__,
  adaptiveFps: true,
};

const FALLBACK_TIER: DeviceTierInfo = {
  tier: 'reference',
  reason: 'fallback',
};

interface PerformanceContextValue {
  tierInfo: DeviceTierInfo;
  lod: LodLevel;
  budget: AnimationBudget;
  flags: PerformanceFeatureFlags;
  config: PerformanceConfig;
  latestSample: PerfSample | null;
  activeAnimationCount: number;
  setLod: (lod: LodLevel) => void;
  registerAnimation: () => void;
  unregisterAnimation: () => void;
}

const PerformanceContext = createContext<PerformanceContextValue | null>(null);

function sanitizeFlags(raw: Partial<PerformanceFeatureFlags> | null): PerformanceFeatureFlags {
    if (!raw) {
        return DEFAULT_FLAGS;
    }
    const legacyRaw = raw as Partial<PerformanceFeatureFlags> & {
        perf_v2_enabled?: boolean;
        lod_dynamic_enabled?: boolean;
        sprite_atlas_enabled?: boolean;
        adaptive_fps_enabled?: boolean;
    };
    return {
        perfV2Enabled: legacyRaw.perfV2Enabled ?? legacyRaw.perf_v2_enabled ?? DEFAULT_FLAGS.perfV2Enabled,
        lodDynamicEnabled: legacyRaw.lodDynamicEnabled ?? legacyRaw.lod_dynamic_enabled ?? DEFAULT_FLAGS.lodDynamicEnabled,
        spriteAtlasEnabled: legacyRaw.spriteAtlasEnabled ?? legacyRaw.sprite_atlas_enabled ?? DEFAULT_FLAGS.spriteAtlasEnabled,
        adaptiveFpsEnabled: legacyRaw.adaptiveFpsEnabled ?? legacyRaw.adaptive_fps_enabled ?? DEFAULT_FLAGS.adaptiveFpsEnabled,
    };
}

export function PerformanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [flags, setFlags] = useState<PerformanceFeatureFlags>(DEFAULT_FLAGS);
  const [config, setConfig] = useState<PerformanceConfig>(DEFAULT_CONFIG);
  const [tierInfo, setTierInfo] = useState<DeviceTierInfo>(FALLBACK_TIER);
  const [lod, setLodState] = useState<LodLevel>(0);
  const [latestSample, setLatestSample] = useState<PerfSample | null>(null);
  const [activeAnimationCount, setActiveAnimationCount] = useState(0);

  const hysteresisRef = useRef(createLodHysteresisState());
  const flagsRef = useRef(flags);
  const configRef = useRef(config);

  useEffect(() => {
    let mounted = true;
    const loadFlags = async () => {
      try {
        const raw = await AsyncStorage.getItem(PERFORMANCE_FLAGS_STORAGE_KEY);
        if (!mounted) return;
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as Partial<PerformanceFeatureFlags>;
        setFlags(sanitizeFlags(parsed));
      } catch {
        // Keep defaults when local flags are not available.
      }
    };
    void loadFlags();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const detectTier = async () => {
      try {
        const info = await detectDeviceTier();
        if (!mounted) {
          return;
        }
        setTierInfo(info);
        setLodState(getInitialLod(info.tier));
      } catch (error) {
        if (!mounted) {
          return;
        }
        if (__DEV__) {
          console.warn('[Performance] Failed to detect device tier. Using fallback tier.', error);
        }
        setTierInfo(FALLBACK_TIER);
        setLodState(getInitialLod(FALLBACK_TIER.tier));
      }
    };
    void detectTier();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setConfig((prev) => ({
      ...prev,
      realtimeHud: __DEV__ && flags.perfV2Enabled,
      adaptiveFps: flags.adaptiveFpsEnabled,
    }));
  }, [flags.adaptiveFpsEnabled, flags.perfV2Enabled]);

  const budget = useMemo(
    () =>
      getAnimationBudget({
        tier: tierInfo.tier,
        lod,
        activeLottieCount: activeAnimationCount,
        flags,
      }),
    [tierInfo.tier, lod, activeAnimationCount, flags]
  );

  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    runtimeMonitor.setConfig(config);
    if (!flags.perfV2Enabled) {
      setLatestSample(null);
      runtimeMonitor.stop();
      return;
    }
    runtimeMonitor.start(config);
    const unsubscribe = runtimeMonitor.subscribe((sample) => {
      const currentFlags = flagsRef.current;
      const currentConfig = configRef.current;

      if (currentConfig.realtimeHud) {
        setLatestSample(sample);
      }

      if (!currentFlags.perfV2Enabled || !currentFlags.lodDynamicEnabled || !currentFlags.adaptiveFpsEnabled) {
        return;
      }

      setLodState((prevLod) => {
        const result = updateLodWithHysteresis(prevLod, sample, hysteresisRef.current);
        hysteresisRef.current = result.state;
        return result.nextLod;
      });
    });
    return () => {
      unsubscribe();
      runtimeMonitor.stop();
    };
  }, [config, flags.perfV2Enabled]);

  useEffect(() => {
    runtimeMonitor.setScreen(pathname || 'unknown');
  }, [pathname]);

  useEffect(() => {
    runtimeMonitor.setTier(tierInfo.tier);
  }, [tierInfo.tier]);

  useEffect(() => {
    runtimeMonitor.setLod(lod);
    runtimeMonitor.setTargetFps(budget.targetFps);
    animationScheduler.setBudget(budget);
  }, [lod, budget]);

  useEffect(() => {
    if (!config.realtimeHud && latestSample !== null) {
      setLatestSample(null);
    }
  }, [config.realtimeHud, latestSample]);

  const setLod = useCallback((nextLod: LodLevel) => {
    setLodState(clampLod(nextLod));
  }, []);

  const registerAnimation = useCallback(() => {
    setActiveAnimationCount((prev) => prev + 1);
  }, []);

  const unregisterAnimation = useCallback(() => {
    setActiveAnimationCount((prev) => Math.max(0, prev - 1));
  }, []);

  const value = useMemo(
    () => ({
      tierInfo,
      lod,
      budget,
      flags,
      config,
      latestSample,
      activeAnimationCount,
      setLod,
      registerAnimation,
      unregisterAnimation,
    }),
    [
      tierInfo,
      lod,
      budget,
      flags,
      config,
      latestSample,
      activeAnimationCount,
      setLod,
      registerAnimation,
      unregisterAnimation,
    ]
  );

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

export function usePerformance(): PerformanceContextValue {
  const context = useContext(PerformanceContext);
  if (!context) {
    return {
      tierInfo: FALLBACK_TIER,
      lod: 0,
      budget: {
        targetFps: 60,
        maxConcurrentLottie: 12,
        particleCount: 12,
        blurIntensity: 68,
        chartAnimationMs: 1000,
        spriteScale: 1,
      },
      flags: DEFAULT_FLAGS,
      config: DEFAULT_CONFIG,
      latestSample: null,
      activeAnimationCount: 0,
      setLod: () => undefined,
      registerAnimation: () => undefined,
      unregisterAnimation: () => undefined,
    };
  }
  return context;
}
