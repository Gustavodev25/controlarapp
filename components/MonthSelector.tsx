import { CalendarCheck2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  minDate: Date;
  maxDate: Date;
  allowFuture?: boolean;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const SELECTOR_HEIGHT = 36;
const SELECTOR_RADIUS = 24;

const CURRENT_WIDTH = 124;
const CURRENT_WITH_FUTURE_WIDTH = 146;
const EXPANDED_WIDTH = 172;

const LABEL_WIDTH = 80;
const NAV_BUTTON_SIZE = 24;
const RESET_BUTTON_SIZE = 24;

const SPRING_ENTRY = {
  damping: 16,
  stiffness: 195,
  mass: 1.05,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

const SPRING_MORPH = {
  damping: 15,
  stiffness: 185,
  mass: 1.08,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

const SPRING_STRETCH = {
  damping: 12,
  stiffness: 165,
  mass: 1.1,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

const SPRING_RECOIL = {
  damping: 16,
  stiffness: 150,
  mass: 1.05,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

const SPRING_SETTLE = {
  damping: 22,
  stiffness: 160,
  mass: 1,
  overshootClamping: false,
  restDisplacementThreshold: 0.001,
  restSpeedThreshold: 0.001,
} as const;

const PRESS_SPRING = {
  damping: 16,
  stiffness: 360,
  mass: 0.5,
  overshootClamping: false,
} as const;

const LABEL_SPRING = {
  damping: 18,
  stiffness: 260,
  mass: 0.7,
  overshootClamping: false,
} as const;

function monthStart(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSelectorWidth(isCurrent: boolean, allowFuture: boolean) {
  if (!isCurrent) return EXPANDED_WIDTH;
  return allowFuture ? CURRENT_WITH_FUTURE_WIDTH : CURRENT_WIDTH;
}

export default function MonthSelector({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  allowFuture = false,
}: Props) {
  const reducedMotionRef = useRef(false);
  const direction = useRef(0);

  const today = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const normalizedCurrent = useMemo(() => monthStart(currentMonth), [currentMonth]);
  const normalizedMin = useMemo(() => monthStart(minDate), [minDate]);
  const normalizedMax = useMemo(() => monthStart(maxDate), [maxDate]);

  const effectiveMax = useMemo(() => {
    if (allowFuture) return normalizedMax;
    return today < normalizedMax ? today : normalizedMax;
  }, [allowFuture, normalizedMax, today]);

  const isCurrent = useMemo(
    () =>
      normalizedCurrent.getMonth() === today.getMonth() &&
      normalizedCurrent.getFullYear() === today.getFullYear(),
    [normalizedCurrent, today]
  );

  const previousMonth = useMemo(() => {
    const d = new Date(normalizedCurrent);
    d.setMonth(d.getMonth() - 1);
    return monthStart(d);
  }, [normalizedCurrent]);

  const nextMonth = useMemo(() => {
    const d = new Date(normalizedCurrent);
    d.setMonth(d.getMonth() + 1);
    return monthStart(d);
  }, [normalizedCurrent]);

  const canGoPrevious = previousMonth >= normalizedMin;
  const canGoNext = nextMonth <= effectiveMax;

  const showReset = !isCurrent;
  const showNext = !isCurrent || allowFuture;

  const label = useMemo(() => {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  }, [currentMonth]);

  const visibility = useSharedValue(0);
  const squash = useSharedValue(1);
  const contentReveal = useSharedValue(1);

  const targetWidth = useSharedValue(getSelectorWidth(isCurrent, allowFuture));
  const targetHeight = useSharedValue(SELECTOR_HEIGHT);
  const targetRadius = useSharedValue(SELECTOR_RADIUS);

  const stateMorph = useSharedValue(isCurrent ? 0 : 1);

  const leftPress = useSharedValue(0);
  const rightPress = useSharedValue(0);
  const resetPress = useSharedValue(0);

  const animatedWidth = useDerivedValue(() =>
    withSpring(targetWidth.value, SPRING_MORPH)
  );

  const animatedHeight = useDerivedValue(() =>
    withSpring(targetHeight.value, SPRING_MORPH)
  );

  const animatedRadius = useDerivedValue(() =>
    withSpring(targetRadius.value, SPRING_MORPH)
  );

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) reducedMotionRef.current = enabled;
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reducedMotionRef.current = enabled;
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const reduced = reducedMotionRef.current;

    squash.value = 0.84;

    visibility.value = reduced
      ? withTiming(1, { duration: 120 })
      : withSpring(1, SPRING_ENTRY);

    squash.value = reduced
      ? withTiming(1, { duration: 120 })
      : withSequence(
        withSpring(1.085, SPRING_STRETCH),
        withSpring(0.976, SPRING_RECOIL),
        withSpring(1, SPRING_SETTLE)
      );
  }, [visibility, squash]);

  useEffect(() => {
    const reduced = reducedMotionRef.current;

    targetWidth.value = getSelectorWidth(isCurrent, allowFuture);
    targetHeight.value = SELECTOR_HEIGHT;
    targetRadius.value = isCurrent ? SELECTOR_RADIUS : 22;

    stateMorph.value = withSpring(isCurrent ? 0 : 1, SPRING_MORPH);

    contentReveal.value = 0;
    contentReveal.value = withDelay(
      reduced ? 0 : 75,
      withSpring(1, LABEL_SPRING)
    );

    if (!reduced) {
      squash.value = withSequence(
        withSpring(1.075, SPRING_STRETCH),
        withSpring(0.978, SPRING_RECOIL),
        withSpring(1, SPRING_SETTLE)
      );
    } else {
      squash.value = withTiming(1, { duration: 120 });
    }
  }, [
    label,
    isCurrent,
    allowFuture,
    targetWidth,
    targetHeight,
    targetRadius,
    stateMorph,
    contentReveal,
    squash,
  ]);

  const handlePrevious = useCallback(() => {
    if (!canGoPrevious) return;

    direction.current = -1;

    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    d.setDate(1);

    onMonthChange(d);
  }, [canGoPrevious, currentMonth, onMonthChange]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;

    direction.current = 1;

    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);

    onMonthChange(d);
  }, [canGoNext, currentMonth, onMonthChange]);

  const handleReset = useCallback(() => {
    direction.current = currentMonth > today ? -1 : 1;
    onMonthChange(today);
  }, [currentMonth, today, onMonthChange]);

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const pressAmount = Math.max(leftPress.value, rightPress.value, resetPress.value);

    const stretchX = interpolate(
      squash.value,
      [0.84, 0.976, 1, 1.085],
      [0.92, 0.99, 1, 1.04],
      Extrapolation.CLAMP
    );

    const stretchY = interpolate(
      squash.value,
      [0.84, 0.976, 1, 1.085],
      [1.08, 1.018, 1, 0.976],
      Extrapolation.CLAMP
    );

    const baseScaleX = interpolate(
      visibility.value,
      [0, 0.34, 0.68, 1],
      [0.18, 1.028, 0.992, 1],
      Extrapolation.CLAMP
    );

    const baseScaleY = interpolate(
      visibility.value,
      [0, 0.42, 0.78, 1],
      [0.18, 0.94, 1.012, 1],
      Extrapolation.CLAMP
    );

    const pressScaleX = interpolate(
      pressAmount,
      [0, 1],
      [1, 0.986],
      Extrapolation.CLAMP
    );

    const pressScaleY = interpolate(
      pressAmount,
      [0, 1],
      [1, 1.035],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      visibility.value,
      [0, 0.5, 0.82, 1],
      [14, -3, 1, 0],
      Extrapolation.CLAMP
    );

    return {
      width: animatedWidth.value,
      height: animatedHeight.value,
      borderRadius: animatedRadius.value,
      opacity: interpolate(
        visibility.value,
        [0, 0.22, 1],
        [0, 0.86, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        { translateY },
        { scaleX: baseScaleX * stretchX * pressScaleX },
        { scaleY: baseScaleY * stretchY * pressScaleY },
      ],
    };
  });

  const contentCounterStyle = useAnimatedStyle(() => {
    const counterX = interpolate(
      squash.value,
      [0.84, 0.976, 1, 1.085],
      [1.09, 1.012, 1, 0.962],
      Extrapolation.CLAMP
    );

    const counterY = interpolate(
      squash.value,
      [0.84, 0.976, 1, 1.085],
      [0.93, 0.984, 1, 1.024],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scaleX: counterX }, { scaleY: counterY }],
    };
  });

  const resetContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stateMorph.value, [0, 0.35, 1], [0, 0, 1], Extrapolation.CLAMP),
    width: interpolate(stateMorph.value, [0, 1], [0, RESET_BUTTON_SIZE], Extrapolation.CLAMP),
    marginLeft: interpolate(stateMorph.value, [0, 1], [0, 6], Extrapolation.CLAMP),
    marginRight: interpolate(stateMorph.value, [0, 1], [0, 4], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          stateMorph.value,
          [0, 0.4, 1],
          [0.35, 0.7, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const resetButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(resetPress.value, [0, 1], [0.82, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(resetPress.value, [0, 1], [1, 0.88], Extrapolation.CLAMP),
      },
    ],
  }));

  const labelAnimatedStyle = useAnimatedStyle(() => {
    const slideDirection = direction.current === 0 ? 1 : direction.current;

    return {
      opacity: interpolate(
        contentReveal.value,
        [0, 0.45, 1],
        [0, 0.35, 1],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          translateY: interpolate(
            contentReveal.value,
            [0, 1],
            [4, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          translateX: interpolate(
            contentReveal.value,
            [0, 1],
            [slideDirection * 5, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            contentReveal.value,
            [0, 1],
            [0.965, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  const leftButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(leftPress.value, [0, 1], [0.68, 1], Extrapolation.CLAMP) *
      (canGoPrevious ? 1 : 0.35),
    transform: [
      {
        translateX: interpolate(leftPress.value, [0, 1], [0, -1.4], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(leftPress.value, [0, 1], [1, 0.88], Extrapolation.CLAMP),
      },
    ],
  }));

  const rightButtonAnimatedStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(rightPress.value, [0, 1], [0.68, 1], Extrapolation.CLAMP) *
      (canGoNext ? 1 : 0.35),
    transform: [
      {
        translateX: interpolate(rightPress.value, [0, 1], [0, 1.4], Extrapolation.CLAMP),
      },
      {
        scale: interpolate(rightPress.value, [0, 1], [1, 0.88], Extrapolation.CLAMP),
      },
    ],
  }));

  return (
    <Animated.View
      style={[styles.container, containerAnimatedStyle]}
      layout={LinearTransition.springify()
      .damping(15)
      .stiffness(185)
      .mass(1.08)}
    >
      <Animated.View style={[styles.content, contentCounterStyle]}>
        <Animated.View style={[styles.resetContainer, resetContainerStyle]}>
          {showReset && (
            <AnimatedTouchableOpacity
              onPress={handleReset}
              onPressIn={() => {
                resetPress.value = withSpring(1, PRESS_SPRING);
              }}
              onPressOut={() => {
                resetPress.value = withSpring(0, PRESS_SPRING);
              }}
              onTouchCancel={() => {
                resetPress.value = withSpring(0, PRESS_SPRING);
              }}
              style={[styles.resetBtn, resetButtonStyle]}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <CalendarCheck2 size={14} color="#F5F5F7" strokeWidth={2.4} />
            </AnimatedTouchableOpacity>
          )}
        </Animated.View>

        <AnimatedTouchableOpacity
          onPress={handlePrevious}
          onPressIn={() => {
            leftPress.value = withSpring(1, PRESS_SPRING);
          }}
          onPressOut={() => {
            leftPress.value = withSpring(0, PRESS_SPRING);
          }}
          onTouchCancel={() => {
            leftPress.value = withSpring(0, PRESS_SPRING);
          }}
          style={[styles.arrowBtn, leftButtonAnimatedStyle]}
          activeOpacity={0.75}
          disabled={!canGoPrevious}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={15} color="#F5F5F7" strokeWidth={2.4} />
        </AnimatedTouchableOpacity>

        <View style={styles.labelWrapper}>
          <Animated.Text
            key={label}
            entering={FadeIn.duration(140).springify().damping(18).stiffness(240)}
            exiting={FadeOut.duration(80)}
            style={[styles.label, labelAnimatedStyle]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        </View>

        {showNext && (
          <AnimatedTouchableOpacity
            onPress={handleNext}
            onPressIn={() => {
              rightPress.value = withSpring(1, PRESS_SPRING);
            }}
            onPressOut={() => {
              rightPress.value = withSpring(0, PRESS_SPRING);
            }}
            onTouchCancel={() => {
              rightPress.value = withSpring(0, PRESS_SPRING);
            }}
            style={[styles.arrowBtn, rightButtonAnimatedStyle]}
            activeOpacity={0.75}
            disabled={!canGoNext}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight size={15} color="#F5F5F7" strokeWidth={2.4} />
          </AnimatedTouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    alignSelf: 'flex-start',
    overflow: 'hidden',

    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#252525',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },

  content: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    gap: 4,
    zIndex: 5,
  },

  resetContainer: {
    height: RESET_BUTTON_SIZE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  resetBtn: {
    width: RESET_BUTTON_SIZE,
    height: RESET_BUTTON_SIZE,
    borderRadius: RESET_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  arrowBtn: {
    width: NAV_BUTTON_SIZE,
    height: NAV_BUTTON_SIZE,
    borderRadius: NAV_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  labelWrapper: {
    overflow: 'hidden',
    width: LABEL_WIDTH,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    color: '#F5F5F7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
    position: 'absolute',
  },
});
