import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { SubscriptionBlocker } from '@/components/SubscriptionBlocker';
import { AuthProvider } from '@/contexts/AuthContext';
import { CategoryProvider } from '@/contexts/CategoryContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { OpenFinanceSyncProvider } from '@/contexts/OpenFinanceSyncContext';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { offlineSync } from '@/services/offlineSync';



import {
  AROneSans_400Regular,
  AROneSans_500Medium,
  AROneSans_600SemiBold,
  AROneSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ar-one-sans';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const APP_NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#D97757',
    background: '#0C0C0C',
    card: '#0C0C0C',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    AROneSans_400Regular,
    AROneSans_500Medium,
    AROneSans_600SemiBold,
    AROneSans_700Bold,
  });

  // Start offline sync service
  useEffect(() => {
    offlineSync.start();
    return () => offlineSync.stop();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <PerformanceProvider>
          <NetworkProvider>
            <AuthProvider>
              <SubscriptionBlocker>
                <CategoryProvider>
                  <OpenFinanceSyncProvider>
                    <ThemeProvider value={APP_NAV_THEME}>
                      <Stack
                        initialRouteName="index"
                        screenOptions={{
                          animation: 'fade',
                          contentStyle: { backgroundColor: '#0C0C0C' },
                        }}
                      >
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(public)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen
                          name="settings"
                          options={{
                            headerShown: false,
                            contentStyle: { backgroundColor: '#0C0C0C' },
                          }}
                        />
                        <Stack.Screen name="open-finance/callback" options={{ headerShown: false }} />
                      </Stack>
                      <StatusBar style="light" translucent backgroundColor="transparent" />
                    </ThemeProvider>
                  </OpenFinanceSyncProvider>
                </CategoryProvider>
              </SubscriptionBlocker>
            </AuthProvider>
          </NetworkProvider>
        </PerformanceProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}


// Force rebuild 7

