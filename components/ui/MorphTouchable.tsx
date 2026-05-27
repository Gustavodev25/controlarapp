import React from 'react';
import {
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const MORPH_PRESS_SPRING = {
  damping: 16,
  stiffness: 250,
  mass: 0.42,
} as const;

const MORPH_SHAPE_SPRING = {
  damping: 13,
  stiffness: 190,
  mass: 0.48,
} as const;

const MORPH_RELEASE_PRESS_SPRING = {
  damping: 15,
  stiffness: 215,
  mass: 0.45,
} as const;

const MORPH_RELEASE_SHAPE_SPRING = {
  damping: 11,
  stiffness: 145,
  mass: 0.52,
} as const;

interface MorphTouchableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

export function MorphTouchable({
  children,
  style,
  radius,
  activeOpacity = 1,
  onPressIn,
  onPressOut,
  onTouchCancel,
  ...props
}: MorphTouchableProps) {
  const press = useSharedValue(0);
  const morph = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const pressed = press.value;
    const morphed = morph.value;

    return {
      ...(typeof radius === 'number'
        ? { borderRadius: radius + morphed * 3 - pressed * 0.8 }
        : null),
      transform: [
        { translateY: pressed * 1.4 },
        { scaleX: 1 + morphed * 0.012 - pressed * 0.012 },
        { scaleY: 1 + morphed * 0.016 + pressed * 0.008 },
      ],
    };
  });

  return (
    <AnimatedTouchableOpacity
      {...props}
      activeOpacity={activeOpacity}
      onPressIn={(event) => {
        press.value = withSpring(1, MORPH_PRESS_SPRING);
        morph.value = withSpring(1, MORPH_SHAPE_SPRING);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.value = withSpring(0, MORPH_RELEASE_PRESS_SPRING);
        morph.value = withSpring(0, MORPH_RELEASE_SHAPE_SPRING);
        onPressOut?.(event);
      }}
      onTouchCancel={(event) => {
        press.value = withSpring(0, MORPH_RELEASE_PRESS_SPRING);
        morph.value = withSpring(0, MORPH_RELEASE_SHAPE_SPRING);
        onTouchCancel?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedTouchableOpacity>
  );
}
