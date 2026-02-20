import { useAuthContext } from '@/contexts/AuthContext';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { Redirect, router, Tabs } from 'expo-router';
import LottieView from 'lottie-react-native'; // Imported LottieView
import React, { useEffect, useMemo, useRef, useState } from 'react'; // Added useRef, useMemo
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  ZoomOut
} from 'react-native-reanimated';

const TAB_BAR_HEIGHT = 52;

const TABS = [
  { key: 'dashboard', title: 'Visão Geral', icon: require('../../assets/home.json') },
  { key: 'open-finance', title: 'Contas Bancárias', icon: require('../../assets/banco.json') },
  { key: 'transactions', title: 'Transações', icon: require('../../assets/carteirabranca.json') },
  { key: 'recurrence', title: 'Recorrências', icon: require('../../assets/calendario.json') },
  { key: 'planning', title: 'Caixinhas', icon: require('../../assets/caixinhas.json') },
];

interface TabItemProps {
  title: string;
  icon: any;
  isActive: boolean;
  onPress: () => void;
}

const TabItem = ({ title, icon: IconSource, isActive, onPress }: TabItemProps) => {
  const activeProgress = useSharedValue(0);
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, {
      damping: 20,
      stiffness: 250,
      mass: 0.5,
    });

    if (isActive) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.reset();
    }
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(activeProgress.value, [0, 1], [1, 1.2], Extrapolation.CLAMP) }, // Slightly deeper scale for emphasis since text is gone
        // Removed translateY since we want it centered always
      ],
    };
  });

  // Apply color filter to enforce White color for inactive state (fixing visibility on dark bg) and Orange for active
  const colorFilters = useMemo(() => [
    {
      keypath: "**",
      color: isActive ? "#D97757" : "#FFFFFF",
    },
  ], [isActive]);

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
        <LottieView
          ref={lottieRef}
          source={IconSource}
          autoPlay={false}
          loop={false}
          style={{ width: 22, height: 22 }}
          colorFilters={colorFilters}
        />
      </Animated.View>
    </Pressable>
  );
};

function CustomTabBar({ state, navigation }: { state: any, navigation: any }) {
  const { budget, lod } = usePerformanceBudget();
  const currentRouteName = state.routes[state.index].name;
  const [activeTab, setActiveTab] = useState(currentRouteName);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [transactionsMenuVisible, setTransactionsMenuVisible] = useState(false);
  const [recurrenceMenuVisible, setRecurrenceMenuVisible] = useState(false);

  const indicatorPosition = useSharedValue(0);
  const pulse = useSharedValue(1);
  // Subtract 2px for the borders (left and right) so the indicator width matches the flex items exactly
  const tabWidth = (tabBarWidth - 2) / TABS.length;

  useEffect(() => {
    // If we're on transactions route, make sure state reflects it
    if (state.routes[state.index].name === 'transactions') {
      // logic if needed
    }
    setActiveTab(state.routes[state.index].name);
  }, [state]);

  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === activeTab);
    if (index !== -1 && tabWidth > 0) {
      indicatorPosition.value = withSpring(index * tabWidth, {
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      });
    }
  }, [activeTab, tabWidth, indicatorPosition]);

  useEffect(() => {
    pulse.value = 1;
    if (lod >= 2) {
      return;
    }

    pulse.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, [lod, pulse]);

  const handlePress = (tabKey: string) => {
    if (tabKey === 'transactions') {
      setTransactionsMenuVisible(prev => !prev);
      setRecurrenceMenuVisible(false);
      return;
    }

    if (tabKey === 'recurrence') {
      setRecurrenceMenuVisible(prev => !prev);
      setTransactionsMenuVisible(false);
      return;
    }

    setTransactionsMenuVisible(false);
    setRecurrenceMenuVisible(false);
    setActiveTab(tabKey);
    navigation.navigate(tabKey);
  };

  const handleTransactionSelect = (filter: 'account' | 'credit') => {
    setTransactionsMenuVisible(false);
    if (filter === 'credit') {
      // Navigate to the new invoices screen for credit cards
      setActiveTab('transactions'); // Keep tab visually active
      router.push('/invoices');
    } else {
      setActiveTab('transactions');
      router.push(`/transactions?filter=${filter}`);
    }
  };

  const handleRecurrenceSelect = (tab: 'subscriptions' | 'reminders') => {
    setRecurrenceMenuVisible(false);
    setActiveTab('recurrence');
    router.push({ pathname: '/recurrence', params: { tab } });
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorPosition.value },
    ],
    width: tabWidth,
    opacity: pulse.value,
  }));
  const tabBlurIntensity = Math.round(Math.max(18, budget.blurIntensity * 0.45));
  const menuIconLoop = lod <= 1;

  // Calculate position for the menu (centered above the middle tab)
  // Transactions is the 3rd tab (index 2)

  const menuLeftPosition = (tabBarWidth / 2) - 100; // Center 200px menu
  const recurrenceMenuLeftPosition = (tabBarWidth * 0.7) - 100; // Center over 4th tab

  return (
    <View style={styles.fullScreenContainer} pointerEvents="box-none">

      {/* Background Blur Overlay when menu is open */}
      {(transactionsMenuVisible || recurrenceMenuVisible) && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        >
          <BlurView
            intensity={tabBlurIntensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          >
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
              onPress={() => {
                setTransactionsMenuVisible(false);
                setRecurrenceMenuVisible(false);
              }}
            />
          </BlurView>
        </Animated.View>
      )}

      <View
        style={[
          styles.tabBarContainer,
          Platform.OS === 'ios' && { backgroundColor: 'transparent' }
        ]}
        onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
      >
        {Platform.OS === 'ios' ? (
          <GlassContainer
            style={StyleSheet.absoluteFillObject}
            spacing={8}
          >
            <GlassView
              style={[StyleSheet.absoluteFillObject, { borderRadius: 30 }]}
              glassEffectStyle="regular"
            />
            {tabBarWidth > 0 && (
              <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
                <GlassView
                  style={[styles.indicatorInner, { backgroundColor: 'rgba(217, 119, 87, 0.3)' }]}
                  glassEffectStyle="regular"
                />
              </Animated.View>
            )}
          </GlassContainer>
        ) : (
          <>
            <BlurView
              intensity={tabBlurIntensity}
              tint="dark"
              style={[StyleSheet.absoluteFillObject, { borderRadius: 30 }]}
            />
            {tabBarWidth > 0 && (
              <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
                <View style={[styles.indicatorInner, { backgroundColor: 'rgba(217, 119, 87, 0.3)' }]} />
              </Animated.View>
            )}
          </>
        )}

        {/* Transactions Pop-up Menu */}
        {transactionsMenuVisible && (
          <Animated.View
            entering={ZoomIn.springify().damping(12).mass(0.6).stiffness(150)}
            exiting={ZoomOut.duration(150)}
            style={[styles.menuContainer, { left: menuLeftPosition, transformOrigin: 'center bottom' }]}
          >
            <View style={styles.menuBox}>
              <View style={styles.menuContent}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleTransactionSelect('account')}
                >
                  <LottieView
                    source={require('../../assets/carteirabranca.json')}
                    style={{ width: 20, height: 20, marginRight: 12 }}
                    autoPlay
                    loop={menuIconLoop}
                  />
                  <Text style={styles.menuText}>Transações</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleTransactionSelect('credit')}
                >
                  <LottieView
                    source={require('../../assets/cartabranco.json')}
                    style={{ width: 20, height: 20, marginRight: 12 }}
                    autoPlay
                    loop={menuIconLoop}
                  />
                  <Text style={styles.menuText}>Cartão de Crédito</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.menuArrow} />
          </Animated.View>
        )}

        {/* Recurrence Pop-up Menu */}
        {recurrenceMenuVisible && (
          <Animated.View
            entering={ZoomIn.springify().damping(12).mass(0.6).stiffness(150)}
            exiting={ZoomOut.duration(150)}
            style={[styles.menuContainer, { left: recurrenceMenuLeftPosition, transformOrigin: 'center bottom' }]}
          >
            <View style={styles.menuBox}>
              <View style={styles.menuContent}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleRecurrenceSelect('subscriptions')}
                >
                  <LottieView
                    source={require('../../assets/assinaturabranco.json')}
                    style={{ width: 20, height: 20, marginRight: 12 }}
                    autoPlay
                    loop={menuIconLoop}
                  />
                  <Text style={styles.menuText}>Assinaturas</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleRecurrenceSelect('reminders')}
                >
                  <LottieView
                    source={require('../../assets/lembretebranco.json')}
                    style={{ width: 20, height: 20, marginRight: 12 }}
                    autoPlay
                    loop={menuIconLoop}
                  />
                  <Text style={styles.menuText}>Lembretes</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.menuArrow} />
          </Animated.View>
        )}

        {/* Sliding Indicator */}


        {/* Tabs */}
        {TABS.map((tab) => (
          <TabItem
            key={tab.key}
            title={tab.title}
            icon={tab.icon}
            isActive={activeTab === tab.key}
            onPress={() => handlePress(tab.key)}
          />
        ))}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d97757" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(public)/welcome" />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Visão Geral',
        }}
      />
      <Tabs.Screen
        name="open-finance"
        options={{
          title: 'Open Finance',
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transações',
        }}
      />
      <Tabs.Screen
        name="recurrence"
        options={{
          title: 'Recorrências',
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: 'Caixinhas',
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Faturas',
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#1a1a18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100, // Top level
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 20,
    width: '75%',
    alignSelf: 'center',
    height: TAB_BAR_HEIGHT,
    borderRadius: 30,
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 2, // Above blur overlay
    flexDirection: 'row',
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  indicatorWrapper: {
    position: 'absolute',
    left: 0,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0, // Behind the text/icons
  },
  indicatorInner: {
    width: 44,
    height: 38,
    borderRadius: 12, // Soft rounded rectangle
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },

  // Menu Styles
  menuContainer: {
    position: 'absolute',
    bottom: 65, // Closer to touch the top of tab bar (Arrow connects to icon)
    width: 200,
    zIndex: 1000,
  },
  menuBox: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#30302E',
    backgroundColor: '#141414',
  },
  menuContent: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    // active state bg could be added
  },
  menuText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    width: '100%',
    backgroundColor: '#30302E',
  },
  menuArrow: {
    width: 16,
    height: 16,
    backgroundColor: '#141414',
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#30302E',
    zIndex: 1,
  },
});
