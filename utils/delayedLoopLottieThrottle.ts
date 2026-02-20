export interface ReplayDelayInput {
  delay: number;
  throttleMultiplier: number;
  lod: 0 | 1 | 2 | 3;
  activeAnimationCount: number;
  maxConcurrentLottie: number;
}

export const computeLottieReplayDelay = ({
  delay,
  throttleMultiplier,
  lod,
  activeAnimationCount,
  maxConcurrentLottie,
}: ReplayDelayInput) => {
  const lodFactor = lod >= 3 ? 1.75 : lod >= 2 ? 1.45 : lod >= 1 ? 1.2 : 1;
  const throttledDelay = Math.round(delay * Math.max(1, throttleMultiplier) * lodFactor);
  if (activeAnimationCount > maxConcurrentLottie) {
    return Math.round(throttledDelay * 1.8);
  }
  return throttledDelay;
};
