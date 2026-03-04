import { GlobalSyncBanner } from '@/components/ui/GlobalSyncBanner';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { useAuthContext } from '@/contexts/AuthContext';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import { Redirect, router, Tabs } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 52;
const TAB_BAR_WIDTH = SCREEN_WIDTH * 0.75;
const springConfig = { damping: 16, stiffness: 120, mass: 0.8 };

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
      damping: 20, stiffness: 250, mass: 0.5,
    });
    if (isActive) lottieRef.current?.play();
    else lottieRef.current?.reset();
  }, [isActive]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(activeProgress.value, [0, 1], [1, 1.2], Extrapolation.CLAMP) }],
  }));

  const colorFilters = useMemo(() => [
    { keypath: "**", color: isActive ? "#D97757" : "#FFFFFF" },
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
  const insets = useSafeAreaInsets();
  const { budget, lod } = usePerformanceBudget();

  const currentRouteName = state.routes[state.index].name;
  const [activeTab, setActiveTab] = useState(currentRouteName);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [transactionsMenuVisible, setTransactionsMenuVisible] = useState(false);
  const [recurrenceMenuVisible, setRecurrenceMenuVisible] = useState(false);

  const indicatorPosition = useSharedValue(0);
  const pulse = useSharedValue(1);
  const tabWidth = (tabBarWidth - 2) / TABS.length;

  useEffect(() => {
    setActiveTab(state.routes[state.index].name);
  }, [state]);

  useEffect(() => {
    const index = TABS.findIndex((t) => t.key === activeTab);
    if (index !== -1 && tabWidth > 0) {
      indicatorPosition.value = withSpring(index * tabWidth, { damping: 18, stiffness: 180, mass: 0.8 });
    }
  }, [activeTab, tabWidth, indicatorPosition]);

  useEffect(() => {
    pulse.value = 1;
    if (lod >= 2) return;
    pulse.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 1500 }), withTiming(1, { duration: 1500 })),
      -1, true
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

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: tabWidth,
    opacity: pulse.value,
  }));

  // Animação da altura da barra
  const tabBarStyle = useAnimatedStyle(() => ({
    height: withSpring(TAB_BAR_HEIGHT, springConfig),
  }));

  // Menus sobem suavemente - Ajustado para considerar Safe Area
  const menuContainerStyle = useAnimatedStyle(() => ({
    bottom: withSpring(85 + (insets.bottom > 0 ? insets.bottom - 10 : 0), springConfig),
  }));

  const tabBlurIntensity = Math.round(Math.max(18, budget.blurIntensity * 0.45));
  const menuIconLoop = lod <= 1;

  const tabWidthScreen = TAB_BAR_WIDTH / TABS.length;
  const tabBarLeft = (SCREEN_WIDTH - TAB_BAR_WIDTH) / 2;
  const menuLeftPosition = tabBarLeft + (2 * tabWidthScreen) + (tabWidthScreen / 2) - 100;
  const recurrenceMenuLeftPosition = tabBarLeft + (3 * tabWidthScreen) + (tabWidthScreen / 2) - 100;

  return (
    <View style={styles.fullScreenContainer} pointerEvents="box-none">

      {/* Fundo escuro atrás dos menus */}
      {(transactionsMenuVisible || recurrenceMenuVisible) && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
          <BlurView intensity={tabBlurIntensity} tint="dark" style={StyleSheet.absoluteFill}>
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.7)' }]} onPress={() => { setTransactionsMenuVisible(false); setRecurrenceMenuVisible(false); }} />
          </BlurView>
        </Animated.View>
      )}

      {/* MENUS FLUTUANTES */}
      {transactionsMenuVisible && (
        <Animated.View entering={ZoomIn.springify().damping(12).mass(0.6).stiffness(150)} exiting={ZoomOut.duration(150)} style={[styles.menuContainer, { left: menuLeftPosition }, menuContainerStyle]}>
          <View style={styles.menuBox}>
            <View style={styles.menuContent}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setTransactionsMenuVisible(false); router.push(`/transactions?filter=account`); setActiveTab('transactions'); }}>
                <LottieView source={require('../../assets/carteirabranca.json')} style={{ width: 20, height: 20, marginRight: 12 }} autoPlay loop={menuIconLoop} />
                <Text style={styles.menuText}>Transações</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setTransactionsMenuVisible(false); router.push('/invoices'); setActiveTab('transactions'); }}>
                <LottieView source={require('../../assets/cartabranco.json')} style={{ width: 20, height: 20, marginRight: 12 }} autoPlay loop={menuIconLoop} />
                <Text style={styles.menuText}>Cartão de Crédito</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.menuArrow} />
        </Animated.View>
      )}

      {recurrenceMenuVisible && (
        <Animated.View entering={ZoomIn.springify().damping(12).mass(0.6).stiffness(150)} exiting={ZoomOut.duration(150)} style={[styles.menuContainer, { left: recurrenceMenuLeftPosition }, menuContainerStyle]}>
          <View style={styles.menuBox}>
            <View style={styles.menuContent}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setRecurrenceMenuVisible(false); router.push({ pathname: '/recurrence', params: { tab: 'subscriptions' } }); setActiveTab('recurrence'); }}>
                <LottieView source={require('../../assets/assinaturabranco.json')} style={{ width: 20, height: 20, marginRight: 12 }} autoPlay loop={menuIconLoop} />
                <Text style={styles.menuText}>Assinaturas</Text>
              </TouchableOpacity>
              <View style={styles.menuDivider} />
              <TouchableOpacity style={styles.menuItem} onPress={() => { setRecurrenceMenuVisible(false); router.push({ pathname: '/recurrence', params: { tab: 'reminders' } }); setActiveTab('recurrence'); }}>
                <LottieView source={require('../../assets/lembretebranco.json')} style={{ width: 20, height: 20, marginRight: 12 }} autoPlay loop={menuIconLoop} />
                <Text style={styles.menuText}>Lembretes</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.menuArrow} />
        </Animated.View>
      )}

      {/* OFFLINE BANNER E SYNC BANNER */}
      <GlobalSyncBanner />
      <OfflineBanner />

      {/* NAVBAR UNIFICADA */}
      <Animated.View style={[
        styles.tabBarShadow,
        tabBarStyle,
        { bottom: 20 + Math.max(insets.bottom, 0) }
      ]}>

        <View style={styles.tabBarInner} onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}>

          {/* Fundo de Vidro */}
          {Platform.OS === 'ios' ? (
            <GlassContainer style={StyleSheet.absoluteFillObject} spacing={8}>
              <GlassView style={StyleSheet.absoluteFillObject} glassEffectStyle="regular" />
              {tabBarWidth > 0 && (
                <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
                  <GlassView style={[styles.indicatorInner, { backgroundColor: 'rgba(217, 119, 87, 0.3)' }]} glassEffectStyle="regular" />
                </Animated.View>
              )}
            </GlassContainer>
          ) : (
            <View style={StyleSheet.absoluteFillObject}>
              <BlurView intensity={tabBlurIntensity} tint="dark" style={StyleSheet.absoluteFillObject} />
              {tabBarWidth > 0 && (
                <Animated.View style={[styles.indicatorWrapper, indicatorStyle]}>
                  <View style={[styles.indicatorInner, { backgroundColor: 'rgba(217, 119, 87, 0.3)' }]} />
                </Animated.View>
              )}
            </View>
          )}

          {/* As Tabs */}
          <View style={styles.tabsSection}>
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
      </Animated.View>

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

  if (!isAuthenticated) return <Redirect href="/(public)/welcome" />;

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
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
  loadingContainer: { flex: 1, backgroundColor: '#1a1a18', justifyContent: 'center', alignItems: 'center' },
  fullScreenContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },

  // -- ESTRUTURA FÍSICA E SOMBRA --
  tabBarShadow: {
    position: 'absolute',
    bottom: 20,
    width: '75%',
    alignSelf: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  // -- BORDAS E MÁSCARA --
  tabBarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  // -- DISPOSIÇÃO INTERNA (TABS) --
  tabsSection: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    zIndex: 2,
  },

  // -- INDICADOR MÓVEL --
  indicatorWrapper: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    height: TAB_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  indicatorInner: { width: 44, height: 38, borderRadius: 12 },
  tabItem: { flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  iconContainer: { justifyContent: 'center', alignItems: 'center', zIndex: 2 },

  // -- MENUS FLUTUANTES --
  menuContainer: { position: 'absolute', width: 200, zIndex: 1000, transformOrigin: 'center bottom' },
  menuBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#30302E', backgroundColor: '#141414' },
  menuContent: { paddingVertical: 4, paddingHorizontal: 0 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  menuText: { color: '#E0E0E0', fontSize: 13, fontWeight: '500' },
  menuDivider: { height: 1, width: '100%', backgroundColor: '#30302E' },
  menuArrow: { width: 16, height: 16, backgroundColor: '#141414', transform: [{ rotate: '45deg' }], position: 'absolute', bottom: -8, alignSelf: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#30302E', zIndex: 1 },
});