import { BlurView } from 'expo-blur';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated as NativeAnimated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface ProfileDropdownProps {
  visible: boolean;
  onSettings: () => void;
  onSignOut: () => void;
}

interface MorphTouchableProps extends TouchableOpacityProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

function MorphTouchable({
  children,
  style,
  radius = 12,
  onPressIn,
  onPressOut,
  ...props
}: MorphTouchableProps) {
  const pressProgress = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;
    return {
      borderRadius: radius + morph * 2 - pressed * 0.4,
      transform: [
        { translateY: pressed * 0.8 },
        { scaleX: 1 + morph * 0.005 - pressed * 0.006 },
        { scaleY: 1 + morph * 0.008 + pressed * 0.004 },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const pressed = pressProgress.value;
    const morph = morphProgress.value;
    return {
      transform: [
        { scaleX: 1 + morph * 0.002 - pressed * 0.002 },
        { scaleY: 1 - morph * 0.002 + pressed * 0.002 },
      ],
    };
  });

  return (
    <AnimatedTouchableOpacity
      {...props}
      activeOpacity={1}
      onPressIn={(event) => {
        pressProgress.value = withSpring(1, { damping: 18, stiffness: 230, mass: 0.45 });
        morphProgress.value = withSpring(1, { damping: 15, stiffness: 175, mass: 0.5 });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressProgress.value = withSpring(0, { damping: 17, stiffness: 205, mass: 0.48 });
        morphProgress.value = withSpring(0, { damping: 14, stiffness: 155, mass: 0.55 });
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      <Animated.View style={contentStyle}>
        {children}
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const INITIAL_SCALE_X = 0.955;
const INITIAL_SCALE_Y = 0.935;
const INITIAL_SHEET_Y = -10;

export function ProfileDropdown({ visible, onSettings, onSignOut }: ProfileDropdownProps) {
  const isOpenRef = useRef(false);
  const isClosingRef = useRef(false);

  const sheetOpacity = useRef(new NativeAnimated.Value(0)).current;
  const sheetScaleX = useRef(new NativeAnimated.Value(INITIAL_SCALE_X)).current;
  const sheetScaleY = useRef(new NativeAnimated.Value(INITIAL_SCALE_Y)).current;
  const radiusProgress = useRef(new NativeAnimated.Value(0)).current;
  const liquidImpulse = useRef(new NativeAnimated.Value(0)).current;
  const sheetY = useRef(new NativeAnimated.Value(INITIAL_SHEET_Y)).current;
  const contentProgress = useRef(new NativeAnimated.Value(0)).current;
  const arrowOpacity = useRef(new NativeAnimated.Value(0)).current;
  const arrowScale = useRef(new NativeAnimated.Value(0.65)).current;

  const sheetRadius = useMemo(
    () =>
      NativeAnimated.add(
        radiusProgress.interpolate({ inputRange: [0, 1], outputRange: [34, 20], extrapolate: 'clamp' }),
        liquidImpulse.interpolate({ inputRange: [0, 1], outputRange: [0, 7], extrapolate: 'clamp' })
      ),
    [radiusProgress, liquidImpulse]
  );

  const contentOpacity = useMemo(
    () => contentProgress.interpolate({ inputRange: [0, 0.34, 0.58, 1], outputRange: [0, 0, 1, 1], extrapolate: 'clamp' }),
    [contentProgress]
  );

  const contentTranslateY = useMemo(
    () => contentProgress.interpolate({ inputRange: [0, 1], outputRange: [-4, 0], extrapolate: 'clamp' }),
    [contentProgress]
  );

  const runOpenAnimation = useCallback(() => {
    if (isOpenRef.current && !isClosingRef.current) return;
    isOpenRef.current = true;
    isClosingRef.current = false;

    sheetOpacity.setValue(0);
    sheetScaleX.setValue(INITIAL_SCALE_X);
    sheetScaleY.setValue(INITIAL_SCALE_Y);
    radiusProgress.setValue(0);
    liquidImpulse.setValue(0);
    sheetY.setValue(INITIAL_SHEET_Y);
    contentProgress.setValue(0);
    arrowOpacity.setValue(0);
    arrowScale.setValue(0.65);

    NativeAnimated.parallel([
      NativeAnimated.timing(sheetOpacity, {
        toValue: 1,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.spring(sheetY, {
        toValue: 0,
        damping: 18,
        stiffness: 235,
        mass: 0.78,
        overshootClamping: false,
        useNativeDriver: false,
      }),

      NativeAnimated.sequence([
        NativeAnimated.timing(sheetScaleX, {
          toValue: 1.018,
          duration: 165,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        NativeAnimated.spring(sheetScaleX, {
          toValue: 1,
          damping: 13,
          stiffness: 190,
          mass: 0.62,
          overshootClamping: false,
          useNativeDriver: false,
        }),
      ]),

      NativeAnimated.sequence([
        NativeAnimated.timing(sheetScaleY, {
          toValue: 1.012,
          duration: 185,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        NativeAnimated.spring(sheetScaleY, {
          toValue: 1,
          damping: 13,
          stiffness: 185,
          mass: 0.62,
          overshootClamping: false,
          useNativeDriver: false,
        }),
      ]),

      NativeAnimated.timing(radiusProgress, {
        toValue: 1,
        duration: 230,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),

      NativeAnimated.sequence([
        NativeAnimated.timing(liquidImpulse, {
          toValue: 1,
          duration: 155,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        NativeAnimated.spring(liquidImpulse, {
          toValue: 0,
          damping: 11,
          stiffness: 145,
          mass: 0.58,
          overshootClamping: false,
          useNativeDriver: false,
        }),
      ]),

      NativeAnimated.timing(contentProgress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(arrowOpacity, {
        toValue: 1,
        duration: 200,
        delay: 80,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.spring(arrowScale, {
        toValue: 1,
        damping: 13,
        stiffness: 190,
        mass: 0.62,
        overshootClamping: false,
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    sheetOpacity, sheetScaleX, sheetScaleY,
    radiusProgress, liquidImpulse, sheetY,
    contentProgress, arrowOpacity, arrowScale,
  ]);

  const runCloseAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    if (!isOpenRef.current) return;

    isOpenRef.current = false;
    isClosingRef.current = true;

    NativeAnimated.parallel([
      NativeAnimated.timing(sheetOpacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(contentProgress, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(sheetScaleX, {
        toValue: INITIAL_SCALE_X,
        duration: 190,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(sheetScaleY, {
        toValue: INITIAL_SCALE_Y,
        duration: 205,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(radiusProgress, {
        toValue: 0,
        duration: 170,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(liquidImpulse, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(sheetY, {
        toValue: INITIAL_SHEET_Y,
        duration: 205,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(arrowOpacity, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),

      NativeAnimated.timing(arrowScale, {
        toValue: 0.65,
        duration: 170,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        isClosingRef.current = false;
      }
    });
  }, [
    sheetOpacity, sheetScaleX, sheetScaleY,
    radiusProgress, liquidImpulse, sheetY,
    contentProgress, arrowOpacity, arrowScale,
  ]);

  useEffect(() => {
    if (visible) {
      runOpenAnimation();
    } else {
      runCloseAnimation();
    }
  }, [visible, runOpenAnimation, runCloseAnimation]);

  return (
    <NativeAnimated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        {
          opacity: sheetOpacity,
          transform: [
            { translateY: sheetY },
            { scaleX: sheetScaleX },
            { scaleY: sheetScaleY },
          ],
        },
      ]}
    >
      <NativeAnimated.View
        style={[
          styles.arrow,
          {
            opacity: arrowOpacity,
            transform: [{ rotate: '45deg' }, { scale: arrowScale }],
          },
        ]}
      />

      <NativeAnimated.View style={[styles.blurShell, { borderRadius: sheetRadius }]}>
        <NativeAnimated.View style={[styles.blurClip, { borderRadius: sheetRadius }]}>
          <BlurView
            intensity={16}
            tint="dark"
            experimentalBlurMethod="dimezisBlurView"
            style={styles.blur}
          >
            <View style={styles.glassOverlay} />

            <NativeAnimated.View
              style={[
                styles.content,
                {
                  opacity: contentOpacity,
                  transform: [{ translateY: contentTranslateY }],
                },
              ]}
            >
              <MorphTouchable radius={12} style={styles.item} onPress={onSettings}>
                <Text style={styles.text}>Configuração</Text>
              </MorphTouchable>

              <View style={styles.divider} />

              <MorphTouchable radius={12} style={styles.item} onPress={onSignOut}>
                <Text style={styles.textDestructive}>Sair</Text>
              </MorphTouchable>
            </NativeAnimated.View>
          </BlurView>
        </NativeAnimated.View>
      </NativeAnimated.View>
    </NativeAnimated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 55,
    right: -10,
    width: 170,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 12,
  },

  arrow: {
    width: 14,
    height: 14,
    backgroundColor: 'rgba(17, 17, 17, 0.94)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    position: 'absolute',
    top: -7,
    right: 22,
    zIndex: 2,
  },

  blurShell: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    overflow: 'hidden',
    backgroundColor: 'rgba(17, 17, 17, 0.94)',
  },

  blurClip: {
    width: '100%',
    overflow: 'hidden',
  },

  blur: {
    width: '100%',
  },

  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 17, 17, 0.94)',
  },

  content: {
    paddingVertical: 4,
  },

  item: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },

  text: {
    color: '#E0E0E0',
    fontSize: 14,
    fontFamily: 'AROneSans_400Regular',
  },

  textDestructive: {
    color: '#FF6B6B',
    fontSize: 14,
    fontFamily: 'AROneSans_400Regular',
  },

  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
