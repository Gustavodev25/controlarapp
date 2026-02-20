import {
  createLodHysteresisState,
  getAnimationBudget,
  getInitialLod,
  updateLodWithHysteresis,
} from '../services/performance/budgetEngine';
import { PerfSample, PerformanceFeatureFlags } from '../services/performance/types';

const FLAGS_ON: PerformanceFeatureFlags = {
  perfV2Enabled: true,
  lodDynamicEnabled: true,
  spriteAtlasEnabled: true,
  adaptiveFpsEnabled: true,
};

function makeSample(overrides?: Partial<PerfSample>): PerfSample {
  return {
    ts: 1_000,
    screen: '/dashboard',
    tier: 'entry_2gb_quad',
    lod: 2,
    uiFps: 28,
    jsFps: 27,
    p95FrameMs: 35,
    droppedFramesPct: 10,
    jsLagP95Ms: 18,
    ...overrides,
  };
}

describe('performance budget engine', () => {
  it('returns initial LOD per tier', () => {
    expect(getInitialLod('entry_2gb_quad')).toBe(2);
    expect(getInitialLod('mid_3gb_quad')).toBe(1);
    expect(getInitialLod('reference')).toBe(0);
  });

  it('reduces target fps when adaptive flag is disabled on entry tier', () => {
    const budget = getAnimationBudget({
      tier: 'entry_2gb_quad',
      lod: 1,
      activeLottieCount: 2,
      flags: { ...FLAGS_ON, adaptiveFpsEnabled: false },
    });
    expect(budget.targetFps).toBe(30);
  });

  it('downgrades lod after sustained high load', () => {
    const state = createLodHysteresisState();
    let lod: 0 | 1 | 2 | 3 = 1;
    let nextState = state;

    for (let i = 0; i < 7; i += 1) {
      const result = updateLodWithHysteresis(
        lod,
        makeSample({ ts: 1_000 + i * 1_000, p95FrameMs: 34, droppedFramesPct: 12 }),
        nextState
      );
      lod = result.nextLod;
      nextState = result.state;
    }

    expect(lod).toBeGreaterThan(1);
  });

  it('upgrades lod after sustained low load', () => {
    const state = createLodHysteresisState();
    let lod: 0 | 1 | 2 | 3 = 2;
    let nextState = state;

    for (let i = 0; i < 31; i += 1) {
      const result = updateLodWithHysteresis(
        lod,
        makeSample({
          ts: 1_000 + i * 1_000,
          p95FrameMs: 15,
          droppedFramesPct: 1,
          jsLagP95Ms: 5,
        }),
        nextState
      );
      lod = result.nextLod;
      nextState = result.state;
    }

    expect(lod).toBeLessThan(2);
  });
});
