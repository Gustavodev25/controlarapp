import { GlobalSyncBanner } from '@/components/ui/GlobalSyncBanner';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, type GlassStyle } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router, Tabs } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TAB_BAR_HEIGHT = 58;
const TAB_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 340);
const TAB_BAR_RADIUS = 34;

const ACTIVE_PILL_WIDTH = 54;
const ACTIVE_PILL_HEIGHT = 42;
const ACTIVE_PILL_RADIUS = 21;

const MENU_WIDTH = 218;

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

const MICRO_SPRING = {
  damping: 17,
  stiffness: 360,
  mass: 0.55,
  overshootClamping: false,
} as const;

const TABS = [
  { key: 'dashboard', title: 'Visão Geral', icon: require('../../assets/home.json') },
  { key: 'open-finance', title: 'Contas Bancárias', icon: require('../../assets/banco.json') },
  { key: 'transactions', title: 'Transações', icon: require('../../assets/carteirabranca.json') },
  { key: 'recurrence', title: 'Recorrências', icon: require('../../assets/calendario.json') },
  { key: 'planning', title: 'Caixinhas', icon: require('../../assets/caixinhas.json') },
];

type MenuKey = 'transactions' | 'recurrence' | null;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

interface TabItemProps {
  title: string;
  icon: any;
  isActive: boolean;
  onPress: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

const TabItem = ({
  icon: IconSource,
  isActive,
  onPress,
  onInteractionStart,
  onInteractionEnd,
}: TabItemProps) => {
  const activeProgress = useSharedValue(isActive ? 1 : 0);
  const pressProgress = useSharedValue(0);
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, MICRO_SPRING);

    if (isActive) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.reset();
    }
  }, [isActive, activeProgress]);

  const iconStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      activeProgress.value,
      [0, 1],
      [0.94, 1.08],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      activeProgress.value,
      [0, 1],
      [0, -0.8],
      Extrapolation.CLAMP
    );

    const pressScale = interpolate(
      pressProgress.value,
      [0, 1],
      [1, 0.96],
      Extrapolation.CLAMP
    );

    return {
      opacity: interpolate(activeProgress.value, [0, 1], [0.62, 1], Extrapolation.CLAMP),
      transform: [
        { translateY: translateY + pressProgress.value * 0.8 },
        { scale: scale * pressScale },
      ],
    };
  });

  const pressGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressProgress.value, [0, 1], [0, 0.16], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(pressProgress.value, [0, 1], [0.9, 1.04], Extrapolation.CLAMP),
      },
    ],
  }));

  const colorFilters = useMemo(
    () => [
      {
        keypath: '**',
        color: isActive ? '#D97757' : '#F7F2EF',
      },
    ],
    [isActive]
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        onInteractionStart?.();
        pressProgress.value = withSpring(1, MICRO_SPRING);
      }}
      onPressOut={() => {
        onInteractionEnd?.();
        pressProgress.value = withSpring(0, MICRO_SPRING);
      }}
      onTouchCancel={onInteractionEnd}
      style={styles.tabItem}
    >
      <Animated.View pointerEvents="none" style={[styles.tabPressGlow, pressGlowStyle]} />

      <Animated.View style={[styles.iconContainer, iconStyle]}>
        <LottieView
          ref={lottieRef}
          source={IconSource}
          autoPlay={false}
          loop={false}
          style={styles.tabIcon}
          colorFilters={colorFilters}
          renderMode="HARDWARE"
        />
      </Animated.View>
    </AnimatedPressable>
  );
};

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const insets = useSafeAreaInsets();
  const { budget, lod } = usePerformanceBudget();

  const isGlassAvailable = useMemo(() => {
    try {
      return typeof isGlassEffectAPIAvailable === 'function' && isGlassEffectAPIAvailable();
    } catch {
      return false;
    }
  }, []);

  const currentRouteName = state.routes[state.index].name;

  const [activeTab, setActiveTab] = useState(currentRouteName);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [visibleMenu, setVisibleMenu] = useState<MenuKey>(null);

  const reducedMotionRef = useRef(false);

  const barVisibility = useSharedValue(0);
  const barSquash = useSharedValue(1);
  const barPressProgress = useSharedValue(0);
  const barMorphProgress = useSharedValue(0);

  const targetBarWidth = useSharedValue(TAB_BAR_WIDTH);
  const targetBarHeight = useSharedValue(TAB_BAR_HEIGHT);
  const targetBarRadius = useSharedValue(TAB_BAR_RADIUS);

  const indicatorTargetX = useSharedValue(0);
  const indicatorTargetWidth = useSharedValue(ACTIVE_PILL_WIDTH);
  const indicatorSquash = useSharedValue(1);
  const liquidFlash = useSharedValue(0);

  const menuProgress = useSharedValue(0);
  const menuSquash = useSharedValue(1);
  const menuContentReveal = useSharedValue(0);

  const backdropProgress = useSharedValue(0);

  const glassViewProps = useAnimatedProps(() => {
    const glassEffectStyle: GlassStyle = barVisibility.value > 0.01 ? 'regular' : 'none';
    return {
      glassEffectStyle,
    };
  });

  const menuGlassViewProps = useAnimatedProps(() => {
    const glassEffectStyle: GlassStyle = menuProgress.value > 0.01 ? 'regular' : 'none';
    return {
      glassEffectStyle,
    };
  });

  const animatedBarWidth = useDerivedValue(() =>
    withSpring(targetBarWidth.value, SPRING_MORPH)
  );

  const animatedBarHeight = useDerivedValue(() =>
    withSpring(targetBarHeight.value, SPRING_MORPH)
  );

  const animatedBarRadius = useDerivedValue(() =>
    withSpring(targetBarRadius.value, SPRING_MORPH)
  );

  const animatedIndicatorX = useDerivedValue(() =>
    withSpring(indicatorTargetX.value, SPRING_MORPH)
  );

  const animatedIndicatorWidth = useDerivedValue(() =>
    withSpring(indicatorTargetWidth.value, SPRING_MORPH)
  );

  const tabWidth = tabBarWidth > 0 ? tabBarWidth / TABS.length : TAB_BAR_WIDTH / TABS.length;

  const tabBarLeft = (SCREEN_WIDTH - TAB_BAR_WIDTH) / 2;
  const screenTabWidth = TAB_BAR_WIDTH / TABS.length;

  const transactionsAnchorX = tabBarLeft + screenTabWidth * 2 + screenTabWidth / 2;
  const recurrenceAnchorX = tabBarLeft + screenTabWidth * 3 + screenTabWidth / 2;

  const activeMenuAnchorX =
    visibleMenu === 'recurrence' ? recurrenceAnchorX : transactionsAnchorX;

  const menuLeft = Math.max(
    14,
    Math.min(activeMenuAnchorX - MENU_WIDTH / 2, SCREEN_WIDTH - MENU_WIDTH - 14)
  );

  const menuBottom = 90 + Math.max(insets.bottom - 8, 0);

  const backdropBlurIntensity =
    budget.blurIntensity <= 0 ? 0 : Math.round(Math.max(12, budget.blurIntensity * 0.45));
  const tabBlurIntensity =
    budget.blurIntensity <= 0 ? 0 : Math.min(26, Math.round(budget.blurIntensity * 0.45));
  const menuIconLoop = lod <= 1;

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

    barSquash.value = 0.84;

    barVisibility.value = reduced
      ? withTiming(1, { duration: 120 })
      : withSpring(1, SPRING_ENTRY);

    barSquash.value = reduced
      ? withTiming(1, { duration: 120 })
      : withSequence(
        withSpring(1.085, SPRING_STRETCH),
        withSpring(0.976, SPRING_RECOIL),
        withSpring(1, SPRING_SETTLE)
      );
  }, [barVisibility, barSquash]);

  useEffect(() => {
    if (!visibleMenu) {
      if (currentRouteName === 'invoices') {
        setActiveTab('transactions');
      } else {
        setActiveTab(currentRouteName);
      }
    }
  }, [currentRouteName, visibleMenu]);

  useEffect(() => {
    const index = TABS.findIndex((tab) => tab.key === activeTab);

    if (index !== -1 && tabWidth > 0) {
      const centeredX = index * tabWidth + (tabWidth - ACTIVE_PILL_WIDTH) / 2;

      indicatorTargetX.value = centeredX;
      indicatorTargetWidth.value = ACTIVE_PILL_WIDTH;

      const reduced = reducedMotionRef.current;

      if (reduced) {
        indicatorSquash.value = withTiming(1, { duration: 120 });
      } else {
        indicatorSquash.value = withSequence(
          withSpring(1.085, SPRING_STRETCH),
          withSpring(0.976, SPRING_RECOIL),
          withSpring(1, SPRING_SETTLE)
        );
      }

      liquidFlash.value = 0;
      liquidFlash.value = withSequence(
        withTiming(1, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [
    activeTab,
    tabWidth,
    indicatorTargetX,
    indicatorTargetWidth,
    indicatorSquash,
    liquidFlash,
  ]);

  useEffect(() => {
    const isOpen = !!visibleMenu;
    const reduced = reducedMotionRef.current;

    targetBarWidth.value = isOpen ? TAB_BAR_WIDTH + 8 : TAB_BAR_WIDTH;
    targetBarHeight.value = isOpen ? TAB_BAR_HEIGHT + 4 : TAB_BAR_HEIGHT;
    targetBarRadius.value = isOpen ? TAB_BAR_RADIUS + 2 : TAB_BAR_RADIUS;

    if (isOpen) {
      menuSquash.value = 0.84;
      menuContentReveal.value = 0;

      menuProgress.value = reduced
        ? withTiming(1, { duration: 120 })
        : withSpring(1, SPRING_ENTRY);

      menuSquash.value = reduced
        ? withTiming(1, { duration: 120 })
        : withSequence(
          withSpring(1.085, SPRING_STRETCH),
          withSpring(0.976, SPRING_RECOIL),
          withSpring(1, SPRING_SETTLE)
        );

      menuContentReveal.value = withTiming(1, {
        duration: reduced ? 90 : 240,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      menuContentReveal.value = withTiming(0, {
        duration: 90,
        easing: Easing.out(Easing.quad),
      });

      menuSquash.value = withTiming(0.84, {
        duration: 160,
        easing: Easing.inOut(Easing.cubic),
      });

      menuProgress.value = withTiming(0, {
        duration: 190,
        easing: Easing.inOut(Easing.cubic),
      });
    }

    backdropProgress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? 220 : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [
    visibleMenu,
    menuProgress,
    menuSquash,
    menuContentReveal,
    backdropProgress,
    targetBarWidth,
    targetBarHeight,
    targetBarRadius,
  ]);

  const closeMenus = () => {
    setVisibleMenu(null);

    if (currentRouteName === 'invoices') {
      setActiveTab('transactions');
    } else {
      setActiveTab(currentRouteName);
    }
  };

  const startNavMorph = () => {
    barPressProgress.value = withSpring(1, {
      damping: 16,
      stiffness: 250,
      mass: 0.42,
    });
    barMorphProgress.value = withSpring(1, {
      damping: 13,
      stiffness: 190,
      mass: 0.48,
    });
  };

  const endNavMorph = () => {
    barPressProgress.value = withSpring(0, {
      damping: 15,
      stiffness: 215,
      mass: 0.45,
    });
    barMorphProgress.value = withSpring(0, {
      damping: 11,
      stiffness: 145,
      mass: 0.52,
    });
  };

  const handlePress = (tabKey: string) => {
    if (tabKey === 'transactions' || tabKey === 'recurrence') {
      const nextMenu = visibleMenu === tabKey ? null : (tabKey as MenuKey);

      if (nextMenu && visibleMenu !== nextMenu) {
        menuProgress.value = 0;
        menuSquash.value = 0.84;
        menuContentReveal.value = 0;
      }

      setVisibleMenu(nextMenu);

      if (nextMenu) {
        setActiveTab(nextMenu);
      } else if (currentRouteName === 'invoices') {
        setActiveTab('transactions');
      } else {
        setActiveTab(currentRouteName);
      }

      return;
    }

    setVisibleMenu(null);
    setActiveTab(tabKey);
    navigation.navigate(tabKey);
  };

  const handleTransactionsPress = () => {
    setVisibleMenu(null);
    setActiveTab('transactions');
    router.push(`/transactions?filter=account`);
  };

  const handleInvoicesPress = () => {
    setVisibleMenu(null);
    setActiveTab('transactions');
    router.push('/invoices');
  };

  const handleSubscriptionsPress = () => {
    setVisibleMenu(null);
    setActiveTab('recurrence');
    router.push({
      pathname: '/recurrence',
      params: { tab: 'subscriptions' },
    });
  };

  const handleRemindersPress = () => {
    setVisibleMenu(null);
    setActiveTab('recurrence');
    router.push({
      pathname: '/recurrence',
      params: { tab: 'reminders' },
    });
  };

  const tabBarAnimatedStyle = useAnimatedStyle(() => {
    const pressed = barPressProgress.value;
    const morph = barMorphProgress.value;

    const stretchX = interpolate(
      barSquash.value,
      [0.84, 0.976, 1, 1.085],
      [0.92, 0.99, 1, 1.04],
      Extrapolation.CLAMP
    );

    const stretchY = interpolate(
      barSquash.value,
      [0.84, 0.976, 1, 1.085],
      [1.08, 1.018, 1, 0.976],
      Extrapolation.CLAMP
    );

    const baseScaleX = interpolate(
      barVisibility.value,
      [0, 0.34, 0.68, 1],
      [0.18, 1.028, 0.992, 1],
      Extrapolation.CLAMP
    );

    const baseScaleY = interpolate(
      barVisibility.value,
      [0, 0.42, 0.78, 1],
      [0.18, 0.94, 1.012, 1],
      Extrapolation.CLAMP
    );

    const translateY = interpolate(
      barVisibility.value,
      [0, 0.5, 0.82, 1],
      [28, -4, 1.2, 0],
      Extrapolation.CLAMP
    );

    return {
      width: animatedBarWidth.value,
      height: animatedBarHeight.value,
      opacity: interpolate(barVisibility.value, [0, 0.22, 1], [0, 0.86, 1]),
      transform: [
        { translateY: translateY + pressed * 1.4 },
        { scaleX: baseScaleX * stretchX * (1 + morph * 0.012 - pressed * 0.012) },
        { scaleY: baseScaleY * stretchY * (1 + morph * 0.016 + pressed * 0.008) },
      ],
    };
  });

  const tabBarInnerAnimatedStyle = useAnimatedStyle(() => {
    const pressed = barPressProgress.value;
    const morph = barMorphProgress.value;

    return {
      borderRadius: animatedBarRadius.value + morph * 4 - pressed * 1.2,
      backgroundColor: isGlassAvailable ? 'transparent' : '#101010',
    };
  });

  const tabBarContentCounterStyle = useAnimatedStyle(() => {
    const counterX = interpolate(
      barSquash.value,
      [0.84, 0.976, 1, 1.085],
      [1.09, 1.012, 1, 0.962],
      Extrapolation.CLAMP
    );

    const counterY = interpolate(
      barSquash.value,
      [0.84, 0.976, 1, 1.085],
      [0.93, 0.984, 1, 1.024],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scaleX: counterX }, { scaleY: counterY }],
    };
  });

  const indicatorStyle = useAnimatedStyle(() => ({
    width: animatedIndicatorWidth.value,
    transform: [{ translateX: animatedIndicatorX.value }],
  }));

  const indicatorInnerStyle = useAnimatedStyle(() => {
    const flashScaleX = interpolate(
      liquidFlash.value,
      [0, 0.45, 1],
      [1, 1.16, 1],
      Extrapolation.CLAMP
    );

    const flashScaleY = interpolate(
      liquidFlash.value,
      [0, 0.45, 1],
      [1, 0.94, 1],
      Extrapolation.CLAMP
    );

    const stretchX = interpolate(
      indicatorSquash.value,
      [0.976, 1, 1.085],
      [0.99, 1, 1.08],
      Extrapolation.CLAMP
    );

    const stretchY = interpolate(
      indicatorSquash.value,
      [0.976, 1, 1.085],
      [1.02, 1, 0.95],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scaleX: flashScaleX * stretchX },
        { scaleY: flashScaleY * stretchY },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropProgress.value,
  }));

  const menuAnimatedStyle = useAnimatedStyle(() => {
    const p = menuProgress.value;
    const startX = activeMenuAnchorX - (menuLeft + MENU_WIDTH / 2);

    const stretchX = interpolate(
      menuSquash.value,
      [0.84, 0.976, 1, 1.085],
      [0.92, 0.99, 1, 1.04],
      Extrapolation.CLAMP
    );

    const stretchY = interpolate(
      menuSquash.value,
      [0.84, 0.976, 1, 1.085],
      [1.08, 1.018, 1, 0.976],
      Extrapolation.CLAMP
    );

    const baseScaleX = interpolate(
      p,
      [0, 0.36, 0.72, 1],
      [0.18, 1.038, 0.992, 1],
      Extrapolation.CLAMP
    );

    const baseScaleY = interpolate(
      p,
      [0, 0.42, 0.78, 1],
      [0.18, 0.94, 1.014, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: interpolate(p, [0, 0.22, 1], [0, 0.86, 1], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(p, [0, 1], [startX, 0], Extrapolation.CLAMP),
        },
        {
          translateY: interpolate(
            p,
            [0, 0.55, 0.82, 1],
            [30, -4, 1.2, 0],
            Extrapolation.CLAMP
          ),
        },
        { scaleX: baseScaleX * stretchX },
        { scaleY: baseScaleY * stretchY },
      ],
    };
  });

  const menuContentAnimatedStyle = useAnimatedStyle(() => {
    const counterX = interpolate(
      menuSquash.value,
      [0.84, 0.976, 1, 1.085],
      [1.09, 1.012, 1, 0.962],
      Extrapolation.CLAMP
    );

    const counterY = interpolate(
      menuSquash.value,
      [0.84, 0.976, 1, 1.085],
      [0.93, 0.984, 1, 1.024],
      Extrapolation.CLAMP
    );

    return {
      opacity: menuContentReveal.value,
      transform: [
        {
          translateY: interpolate(menuContentReveal.value, [0, 1], [4, 0], Extrapolation.CLAMP),
        },
        { scaleX: counterX },
        { scaleY: counterY },
      ],
    };
  });

  const menuArrowStyle = useAnimatedStyle(() => {
    const p = menuProgress.value;

    return {
      opacity: interpolate(p, [0, 0.76, 1], [0, 0, 1], Extrapolation.CLAMP),
      transform: [
        { rotate: '45deg' },
        {
          scale: interpolate(p, [0, 1], [0.38, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={styles.fullScreenContainer} pointerEvents="box-none">
      {!!visibleMenu && (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(160)}
          style={[StyleSheet.absoluteFill, styles.backdropLayer, backdropStyle]}
        >
          {backdropBlurIntensity > 0 ? (
            <BlurView intensity={backdropBlurIntensity} tint="dark" style={StyleSheet.absoluteFill}>
              <Pressable
                style={[StyleSheet.absoluteFill, styles.backdropPressable]}
                onPress={closeMenus}
              />
            </BlurView>
          ) : (
            <Pressable
              style={[StyleSheet.absoluteFill, styles.backdropPressable]}
              onPress={closeMenus}
            />
          )}
        </Animated.View>
      )}

      {!!visibleMenu && (
        <Animated.View
          exiting={ZoomOut.duration(130)}
          style={[
            styles.menuContainer,
            {
              left: menuLeft,
              bottom: menuBottom,
            },
            menuAnimatedStyle,
          ]}
        >
          <View style={[styles.menuBox, { backgroundColor: isGlassAvailable ? 'transparent' : '#101010' }]}>
            {isGlassAvailable ? (
              <AnimatedGlassView
                pointerEvents="none"
                animatedProps={menuGlassViewProps}
                style={StyleSheet.absoluteFillObject}
                colorScheme="dark"
              />
            ) : (
              <View pointerEvents="none" style={styles.menuBase}>
                <LinearGradient
                  colors={[
                    'rgba(16,16,16,0.98)',
                    'rgba(16,16,16,0.94)',
                    'rgba(16,16,16,0.92)',
                  ]}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            )}

            <Animated.View style={[styles.menuContent, menuContentAnimatedStyle]}>
              {visibleMenu === 'transactions' && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.78}
                    style={styles.menuItem}
                    onPress={handleTransactionsPress}
                  >
                    <View style={styles.menuIconBubble}>
                      <LottieView
                        source={require('../../assets/carteirabranca.json')}
                        style={styles.menuIcon}
                        autoPlay
                        loop={menuIconLoop}
                        renderMode="HARDWARE"
                      />
                    </View>

                    <View style={styles.menuTextBlock}>
                      <Text style={styles.menuText}>Transações</Text>
                      <Text style={styles.menuDescription}>Entradas, saídas e filtros</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.menuDivider} />

                  <TouchableOpacity
                    activeOpacity={0.78}
                    style={styles.menuItem}
                    onPress={handleInvoicesPress}
                  >
                    <View style={styles.menuIconBubble}>
                      <LottieView
                        source={require('../../assets/cartabranco.json')}
                        style={styles.menuIcon}
                        autoPlay
                        loop={menuIconLoop}
                        renderMode="HARDWARE"
                      />
                    </View>

                    <View style={styles.menuTextBlock}>
                      <Text style={styles.menuText}>Cartão de Crédito</Text>
                      <Text style={styles.menuDescription}>Faturas e lançamentos</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {visibleMenu === 'recurrence' && (
                <>
                  <TouchableOpacity
                    activeOpacity={0.78}
                    style={styles.menuItem}
                    onPress={handleSubscriptionsPress}
                  >
                    <View style={styles.menuIconBubble}>
                      <LottieView
                        source={require('../../assets/assinaturabranco.json')}
                        style={styles.menuIcon}
                        autoPlay
                        loop={menuIconLoop}
                        renderMode="HARDWARE"
                      />
                    </View>

                    <View style={styles.menuTextBlock}>
                      <Text style={styles.menuText}>Assinaturas</Text>
                      <Text style={styles.menuDescription}>Pagamentos recorrentes</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.menuDivider} />

                  <TouchableOpacity
                    activeOpacity={0.78}
                    style={styles.menuItem}
                    onPress={handleRemindersPress}
                  >
                    <View style={styles.menuIconBubble}>
                      <LottieView
                        source={require('../../assets/lembretebranco.json')}
                        style={styles.menuIcon}
                        autoPlay
                        loop={menuIconLoop}
                        renderMode="HARDWARE"
                      />
                    </View>

                    <View style={styles.menuTextBlock}>
                      <Text style={styles.menuText}>Lembretes</Text>
                      <Text style={styles.menuDescription}>Alertas e vencimentos</Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </View>

          <Animated.View style={[styles.menuArrow, menuArrowStyle]} />
        </Animated.View>
      )}

      <GlobalSyncBanner />
      <OfflineBanner />

      <Animated.View
        style={[
          styles.tabBarShadow,
          tabBarAnimatedStyle,
          {
            bottom: 20 + Math.max(insets.bottom, 0),
          },
        ]}
      >
        <Animated.View
          style={[styles.tabBarInner, tabBarInnerAnimatedStyle]}
          onLayout={(event) => setTabBarWidth(event.nativeEvent.layout.width)}
        >
          {isGlassAvailable ? (
            <AnimatedGlassView
              pointerEvents="none"
              animatedProps={glassViewProps}
              style={StyleSheet.absoluteFillObject}
              colorScheme="dark"
            />
          ) : (
            <>
              <View pointerEvents="none" style={styles.tabBaseBlurLayer}>
                {tabBlurIntensity > 0 && (
                  <BlurView intensity={tabBlurIntensity} tint="dark" style={StyleSheet.absoluteFillObject} />
                )}
              </View>

              <View pointerEvents="none" style={styles.tabBaseTint}>
                <LinearGradient
                  colors={[
                    'rgba(16,16,16,0.98)',
                    'rgba(16,16,16,0.94)',
                    'rgba(16,16,16,0.92)',
                  ]}
                  locations={[0, 0.45, 1]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            </>
          )}

          <View pointerEvents="none" style={styles.innerBottomShade} />

          {tabBarWidth > 0 && (
            <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
              <Animated.View style={[styles.indicatorGlow, indicatorInnerStyle]} />

              <Animated.View style={[styles.indicatorLiquid, indicatorInnerStyle]}>
                <View style={styles.indicatorLiquidInner} />
              </Animated.View>
            </Animated.View>
          )}

          <Animated.View style={[styles.tabsSection, tabBarContentCounterStyle]}>
            {TABS.map((tab) => (
              <TabItem
                key={tab.key}
                title={tab.title}
                icon={tab.icon}
                isActive={activeTab === tab.key}
                onPress={() => handlePress(tab.key)}
                onInteractionStart={startNavMorph}
                onInteractionEnd={endNavMorph}
              />
            ))}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return <IosCoreLoader style={styles.loadingContainer} />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(public)/welcome" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" />
      <Tabs.Screen name="open-finance" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="recurrence" />
      <Tabs.Screen name="planning" />
      <Tabs.Screen name="invoices" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },

  backdropLayer: {
    zIndex: 1,
  },

  backdropPressable: {
    backgroundColor: 'rgba(0,0,0,0.58)',
  },

  tabBarShadow: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.34,
    shadowRadius: 28,
  },

  tabBarInner: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#252525',
  },

  tabBaseBlurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    overflow: 'hidden',
  },

  tabBaseTint: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    opacity: 0.92,
    backgroundColor: 'rgba(16, 16, 16, 0.92)',
  },

  innerBottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.10)',
    zIndex: 3,
  },

  tabsSection: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    zIndex: 6,
  },

  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 7,
    position: 'relative',
  },

  tabPressGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  iconContainer: {
    width: ACTIVE_PILL_WIDTH,
    height: ACTIVE_PILL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  tabIcon: {
    width: 22,
    height: 22,
  },

  indicatorWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },

  indicatorGlow: {
    position: 'absolute',
    width: ACTIVE_PILL_WIDTH,
    height: ACTIVE_PILL_HEIGHT,
    borderRadius: ACTIVE_PILL_RADIUS,
    backgroundColor: 'rgba(217,119,87,0.08)',
  },

  indicatorLiquid: {
    width: ACTIVE_PILL_WIDTH,
    height: ACTIVE_PILL_HEIGHT,
    borderRadius: ACTIVE_PILL_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'rgba(217,119,87,0.30)',
  },

  indicatorLiquidInner: {
    width: '100%',
    height: '100%',
    borderRadius: ACTIVE_PILL_RADIUS,
    backgroundColor: 'rgba(217,119,87,0.32)',
  },

  menuContainer: {
    position: 'absolute',
    width: MENU_WIDTH,
    zIndex: 1000,
    alignItems: 'center',
  },

  menuBox: {
    width: MENU_WIDTH,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#101010',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.36,
    shadowRadius: 34,
    elevation: 18,
  },

  menuBase: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: '#101010',
  },

  menuContent: {
    paddingVertical: 7,
    paddingHorizontal: 7,
    zIndex: 2,
    backgroundColor: 'transparent',
  },

  menuItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
  },

  menuIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#252525',
  },

  menuIcon: {
    width: 21,
    height: 21,
  },

  menuTextBlock: {
    flex: 1,
  },

  menuText: {
    color: '#F4F1EF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  menuDescription: {
    marginTop: 2,
    color: 'rgba(244,241,239,0.54)',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.15,
  },

  menuDivider: {
    height: 1,
    marginVertical: 3,
    marginLeft: 55,
    backgroundColor: '#252525',
  },

  menuArrow: {
    width: 18,
    height: 18,
    marginTop: -9,
    backgroundColor: '#101010',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#252525',
    zIndex: 1,
  },
});
