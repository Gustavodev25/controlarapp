export type DeviceTier = 'entry_2gb_quad' | 'mid_3gb_quad' | 'reference';

export type LodLevel = 0 | 1 | 2 | 3;

export interface AnimationBudget {
  targetFps: 30 | 45 | 60;
  maxConcurrentLottie: number;
  particleCount: number;
  blurIntensity: number;
  chartAnimationMs: number;
  spriteScale: 1 | 0.85 | 0.7;
}

export interface PerfSample {
  ts: number;
  screen: string;
  tier: DeviceTier;
  lod: LodLevel;
  uiFps: number;
  jsFps: number;
  p95FrameMs: number;
  droppedFramesPct: number;
  jsLagP95Ms: number;
  pssMb?: number;
  cpuPct?: number;
  gpuFrameP95Ms?: number;
  batteryDropPct30m?: number;
}

export interface PerformanceConfig {
  realtimeHud: boolean;
  logToFile: boolean;
  adaptiveFps: boolean;
}

export interface PerformanceFeatureFlags {
  perfV2Enabled: boolean;
  lodDynamicEnabled: boolean;
  spriteAtlasEnabled: boolean;
  adaptiveFpsEnabled: boolean;
}

export interface DeviceTierInfo {
  tier: DeviceTier;
  totalMemoryMb?: number;
  cpuCores?: number;
  deviceYearClass?: number;
  reason: string;
}

export interface RuntimeMonitorSnapshot {
  latest: PerfSample | null;
  samplesCollected: number;
}

export interface LodHysteresisState {
  highLoadMs: number;
  lowLoadMs: number;
  lastTs: number;
}
