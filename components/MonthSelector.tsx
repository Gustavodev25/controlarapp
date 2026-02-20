import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MORPH_CONFIG = {
  duration: 380,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

interface Props {
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  minDate: Date;
  maxDate: Date;
  allowFuture?: boolean;
}

export default function MonthSelector({
  currentMonth,
  onMonthChange,
  minDate,
  maxDate,
  allowFuture = false,
}: Props) {

  const today = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  }, []);

  const direction = useRef(0);

  const isCurrent = useMemo(
    () =>
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear(),
    [currentMonth, today]
  );

  const morph = useSharedValue(isCurrent ? 0 : 1);

  useEffect(() => {
    morph.value = withTiming(isCurrent ? 0 : 1, MORPH_CONFIG);
  }, [isCurrent]);

  const containerStyle = useAnimatedStyle(() => {
    return {
      borderRadius: interpolate(morph.value, [0, 1], [100, 24]),
      backgroundColor: interpolateColor(
        morph.value,
        [0, 1],
        ['#141414', '#1A1A1A']
      ),
      borderColor: interpolateColor(
        morph.value,
        [0, 1],
        ['#2B2B2B', '#333333']
      ),
    };
  });

  const resetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.3, 1], [0, 0, 1]),
    width: interpolate(morph.value, [0, 1], [0, 24]),
    height: interpolate(morph.value, [0, 1], [0, 24]),
    marginRight: interpolate(morph.value, [0, 1], [0, 4]),
    transform: [
      { scale: interpolate(morph.value, [0, 0.4, 1], [0.3, 0.6, 1]) },
    ],
  }));

  const handlePrevious = useCallback(() => {
    direction.current = -1;
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() - 1);
    onMonthChange(d);
  }, [currentMonth]);

  const handleNext = useCallback(() => {
    direction.current = 1;
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + 1);
    onMonthChange(d);
  }, [currentMonth]);

  const handleReset = useCallback(() => {
    direction.current =
      currentMonth > today ? -1 : 1;
    onMonthChange(today);
  }, [currentMonth, today]);

  const label = useMemo(() => {
    const months = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  }, [currentMonth]);

  // Label transition: subtle fade
  const entering = FadeIn.duration(220);
  const exiting = FadeOut.duration(160);

  return (
    <Animated.View style={[styles.container, containerStyle]}>

      {/* RESET — Lottie assinatura icon, morphs in with scale */}
      <Animated.View style={[styles.resetContainer, resetStyle]}>
        {!isCurrent && (
          <TouchableOpacity
            onPress={handleReset}
            style={styles.resetBtn}
            activeOpacity={0.7}
          >
            <DelayedLoopLottie
              source={require('../assets/assinaturabranco.json')}
              style={{ width: 15, height: 15 }}
              delay={500}
              throttleMultiplier={3}
            />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* LEFT ARROW */}
      <TouchableOpacity onPress={handlePrevious} style={styles.arrowBtn} activeOpacity={0.6}>
        <ChevronLeft size={14} color="#888" />
      </TouchableOpacity>

      {/* LABEL — fixed size, absolute positioned text */}
      <View style={styles.labelWrapper}>
        <Animated.Text
          key={label}
          entering={entering}
          exiting={exiting}
          style={styles.label}
        >
          {label}
        </Animated.Text>
      </View>

      {/* RIGHT ARROW — only visible when not on current month, or if allowFuture is true */}
      {(!isCurrent || allowFuture) && (
        <TouchableOpacity onPress={handleNext} style={styles.arrowBtn} activeOpacity={0.6}>
          <ChevronRight size={14} color="#888" />
        </TouchableOpacity>
      )}

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
  },
  resetContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtn: {
    padding: 4,
  },
  labelWrapper: {
    overflow: 'hidden',
    width: 80,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    position: 'absolute',
  },
});
