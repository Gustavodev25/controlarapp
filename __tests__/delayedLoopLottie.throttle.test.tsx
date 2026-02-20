import { computeLottieReplayDelay } from '../utils/delayedLoopLottieThrottle';

describe('DelayedLoopLottie throttle', () => {
  it('increases delay as LOD increases', () => {
    const base = computeLottieReplayDelay({
      delay: 1000,
      throttleMultiplier: 1,
      lod: 0,
      activeAnimationCount: 1,
      maxConcurrentLottie: 4,
    });
    const lod2 = computeLottieReplayDelay({
      delay: 1000,
      throttleMultiplier: 1,
      lod: 2,
      activeAnimationCount: 1,
      maxConcurrentLottie: 4,
    });

    expect(lod2).toBeGreaterThan(base);
  });

  it('applies extra throttle when active animations exceed concurrency budget', () => {
    const normal = computeLottieReplayDelay({
      delay: 1200,
      throttleMultiplier: 1.1,
      lod: 1,
      activeAnimationCount: 2,
      maxConcurrentLottie: 4,
    });
    const throttled = computeLottieReplayDelay({
      delay: 1200,
      throttleMultiplier: 1.1,
      lod: 1,
      activeAnimationCount: 5,
      maxConcurrentLottie: 4,
    });

    expect(throttled).toBeGreaterThan(normal);
  });

  it('does not reduce delay when throttleMultiplier is below 1', () => {
    const baseline = computeLottieReplayDelay({
      delay: 900,
      throttleMultiplier: 1,
      lod: 0,
      activeAnimationCount: 0,
      maxConcurrentLottie: 4,
    });
    const belowOne = computeLottieReplayDelay({
      delay: 900,
      throttleMultiplier: 0.7,
      lod: 0,
      activeAnimationCount: 0,
      maxConcurrentLottie: 4,
    });

    expect(belowOne).toBe(baseline);
  });
});
