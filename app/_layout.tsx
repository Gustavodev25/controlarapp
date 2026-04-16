import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { StripeProvider } from '@stripe/stripe-react-native';

// Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51TCgcd3Gkobo4H4NKXtSEDYSugr6fTt36tcBxsmYr2B2ro5D08edYG7AIPsbpJ6CJbvcfyL36R6BAjl594UEdZmP00Jitna5DX';

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.gustavodev25.controlarapp"
        urlScheme="controlarapp"
      >
        <ToastProvider>
          <PerformanceProvider>
            <NetworkProvider>
              <AuthProvider>
                <SubscriptionBlocker>
                  <CategoryProvider>
                    <OpenFinanceSyncProvider>
                      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                        <Stack initialRouteName="index" screenOptions={{ animation: 'fade' }}>
                          <Stack.Screen name="index" options={{ headerShown: false }} />
                          <Stack.Screen name="(public)" options={{ headerShown: false }} />
                          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                          <Stack.Screen name="settings" options={{ headerShown: false }} />
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
      </StripeProvider>
    </GestureHandlerRootView>
  );
}


// Force rebuild 7

