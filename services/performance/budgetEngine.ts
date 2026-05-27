import {
  AnimationBudget,
  DeviceTier,
  LodHysteresisState,
  LodLevel,
  PerfSample,
  PerformanceFeatureFlags,
} from './types';

const BASE_BUDGETS: Record<LodLevel, AnimationBudget> = {
  0: {
    targetFps: 60,
    maxConcurrentLottie: 12,
    particleCount: 12,
    blurIntensity: 68,
    chartAnimationMs: 1000,
    spriteScale: 1,
  },
  1: {
    targetFps: 45,
    maxConcurrentLottie: 9,
    particleCount: 8,
    blurIntensity: 50,
    chartAnimationMs: 800,
    spriteScale: 0.85,
  },
  2: {
    targetFps: 30,
    maxConcurrentLottie: 6,
    particleCount: 5,
    blurIntensity: 32,
    chartAnimationMs: 650,
    spriteScale: 0.7,
  },
  3: {
    targetFps: 30,
    maxConcurrentLottie: 4,
    particleCount: 0,
    blurIntensity: 0,
    chartAnimationMs: 500,
    spriteScale: 0.7,
  },
};

const INITIAL_LOD_BY_TIER: Record<DeviceTier, LodLevel> = {
  entry_2gb_quad: 2,
  mid_3gb_quad: 1,
  reference: 0,
};

export function clampLod(lod: number): LodLevel {
  if (lod <= 0) return 0;
  if (lod >= 3) return 3;
  return lod as LodLevel;
}

export function getInitialLod(tier: DeviceTier): LodLevel {
  return INITIAL_LOD_BY_TIER[tier] ?? 1;
}

export function getAnimationBudget(params: {
  tier: DeviceTier;
  lod: LodLevel;
  activeLottieCount: number;
  flags: PerformanceFeatureFlags;
}): AnimationBudget {
  const { tier, flags, activeLottieCount } = params;
  const lod = clampLod(params.lod);

  if (!flags.perfV2Enabled) {
    return BASE_BUDGETS[0];
  }

  const base = BASE_BUDGETS[lod];
  let adjustedMaxLottie = base.maxConcurrentLottie;
  if (activeLottieCount > base.maxConcurrentLottie) {
    adjustedMaxLottie = Math.max(2, base.maxConcurrentLottie - 1);
  }

  let targetFps = base.targetFps;
  if (!flags.adaptiveFpsEnabled) {
    targetFps = tier === 'entry_2gb_quad' ? 30 : 60;
  }

  return {
    ...base,
    targetFps,
    maxConcurrentLottie: adjustedMaxLottie,
  };
}

export function createLodHysteresisState(): LodHysteresisState {
  return {
    highLoadMs: 0,
    lowLoadMs: 0,
    lastTs: 0,
  };
}

export function updateLodWithHysteresis(
  currentLod: LodLevel,
  sample: PerfSample,
  prev: LodHysteresisState
): { nextLod: LodLevel; state: LodHysteresisState } {
  const now = sample.ts;
  const elapsed = prev.lastTs > 0 ? Math.max(0, now - prev.lastTs) : 1000;

  const highLoad = sample.p95FrameMs > 28 || sample.droppedFramesPct > 8 || sample.jsLagP95Ms > 15;
  const lowLoad = sample.p95FrameMs < 18 && sample.droppedFramesPct < 3 && sample.jsLagP95Ms < 8;

  let highLoadMs = highLoad ? prev.highLoadMs + elapsed : 0;
  let lowLoadMs = lowLoad ? prev.lowLoadMs + elapsed : 0;
  let nextLod = currentLod;

  if (highLoadMs >= 6000 && currentLod < 3) {
    nextLod = clampLod(currentLod + 1);
    highLoadMs = 0;
    lowLoadMs = 0;
  } else if (lowLoadMs >= 30000 && currentLod > 0) {
    nextLod = clampLod(currentLod - 1);
    highLoadMs = 0;
    lowLoadMs = 0;
  }

  return {
    nextLod,
    state: {
      highLoadMs,
      lowLoadMs,
      lastTs: now,
    },
  };
}
