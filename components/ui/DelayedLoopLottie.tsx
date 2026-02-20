import React, { useEffect, useRef } from 'react';
import LottieView from 'lottie-react-native';
import { computeLottieReplayDelay } from '@/utils/delayedLoopLottieThrottle';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { animationScheduler } from '@/services/performance';

interface DelayedLoopLottieProps {
  source: any;
  style?: any;
  delay?: number;
  initialDelay?: number;
  renderMode?: 'AUTOMATIC' | 'HARDWARE' | 'SOFTWARE';
  resizeMode?: 'cover' | 'contain' | 'center';
  jitterRatio?: number;
  throttleMultiplier?: number;
  disabled?: boolean;
}

export const DelayedLoopLottie = ({
  source,
  style,
  delay = 3000,
  initialDelay = 100,
  renderMode = 'AUTOMATIC',
  resizeMode = 'contain',
  jitterRatio = 0,
  throttleMultiplier = 1,
  disabled = false,
}: DelayedLoopLottieProps) => {
  const lottieRef = useRef<LottieView>(null);
  const instanceId = useRef(`delayed-lottie-${Math.random().toString(36).slice(2)}`).current;
  const { budget, activeAnimationCount, lod, registerAnimation, unregisterAnimation } = usePerformanceBudget();

  useEffect(() => {
    if (disabled) {
      animationScheduler.cancelByPrefix(instanceId);
      return () => {
        animationScheduler.cancelByPrefix(instanceId);
      };
    }

    registerAnimation();
    const startDisposer = animationScheduler.scheduleOnce(`${instanceId}:start`, () => {
      lottieRef.current?.play();
    }, initialDelay);
    return () => {
      startDisposer();
      animationScheduler.cancelByPrefix(instanceId);
      unregisterAnimation();
    };
  }, [disabled, initialDelay, instanceId, registerAnimation, unregisterAnimation]);

  const replayDelay = computeLottieReplayDelay({
    delay,
    throttleMultiplier,
    lod,
    activeAnimationCount,
    maxConcurrentLottie: budget.maxConcurrentLottie,
  });

  return (
    <LottieView
      ref={lottieRef}
      source={source}
      loop={false}
      style={style}
      renderMode={renderMode}
      resizeMode={resizeMode}
      onAnimationFinish={() => {
        if (disabled) {
          return;
        }
        animationScheduler.scheduleOnce(`${instanceId}:replay`, () => {
          lottieRef.current?.play();
        }, replayDelay + Math.round(Math.random() * replayDelay * jitterRatio));
      }}
    />
  );
};
