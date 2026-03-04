import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { useBiometricAuth } from '@/hooks/use-biometric-auth';

import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, LogBox, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Ignore specific warnings related to Expo Go limitations
LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications',
    'expo-notifications functionality is not fully supported in Expo Go'
]);

export default function Index() {
    const router = useRouter();
    const { isAuthenticated: isFirebaseAuth, isLoading: isAuthLoading, signOut, user } = useAuthContext();

    // Passa o userId para vincular biometria à conta específica
    const {
        isLoading: isBiometricLoading,
        isAuthenticated: isBiometricAuth,
        isBiometricAvailable,
        authenticate,
        biometricType,
        isBiometricEnabled,
        error,
    } = useBiometricAuth(user?.uid);

    const [isAnimComplete, setIsAnimComplete] = useState(false);

    useEffect(() => {
        // Wait until auth state is determined
        if (isAuthLoading || isBiometricLoading) return;

        // User is not logged in, go to welcome screen
        if (!isFirebaseAuth) {
            router.replace('/(public)/welcome');
            return;
        }

        // Se biometria está disponível E HABILITADA
        if (isBiometricAvailable && isBiometricEnabled) {
            // Se ainda não autenticou, espera
            if (!isBiometricAuth) return;
            // Se autenticou mas a animação não acabou, espera
            if (!isAnimComplete) return;
        }

        // Tudo ok, vai pro dashboard
        router.replace('/(tabs)/dashboard');
    }, [
        isAuthLoading,
        isBiometricLoading,
        isFirebaseAuth,
        isBiometricAvailable,
        isBiometricAuth,
        isBiometricEnabled,
        isAnimComplete,
    ]);

    const fadeAnim = useRef(new Animated.Value(0)).current; // 0 = loading, 1 = success

    // ActivityIndicator large (~36px) com scale 1.5 = ~54px visual
    // Lottie canvas é 240x240 mas o check ocupa ~71%, então 80px * 0.71 = ~57px visual
    const LOADER_SIZE = 54; // tamanho visual do loader
    const LOTTIE_VIEW_SIZE = 80; // tamanho do componente Lottie (compensa padding interno)

    // Loader: some com escala reduzindo + rotação
    const loaderOpacity = fadeAnim.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0], extrapolate: 'clamp' });
    const loaderScale = fadeAnim.interpolate({ inputRange: [0, 0.6], outputRange: [1, 0.3], extrapolate: 'clamp' });
    const loaderRotate = fadeAnim.interpolate({ inputRange: [0, 0.6], outputRange: ['0deg', '90deg'], extrapolate: 'clamp' });

    // Lottie: aparece com escala crescendo (começa um pouco depois do loader começar a sumir)
    const successOpacity = fadeAnim.interpolate({ inputRange: [0.3, 0.8], outputRange: [0, 1], extrapolate: 'clamp' });
    const successScale = fadeAnim.interpolate({ inputRange: [0.3, 0.8], outputRange: [0.5, 1], extrapolate: 'clamp' });

    const lottieRef = useRef<LottieView>(null);
    const readyToFinish = useRef(false);

    // Duração real do Lottie: 60 frames a 60fps = 1000ms
    const LOTTIE_DURATION_MS = 1200; // margem extra para garantir
    const CROSSFADE_DURATION_MS = 400;

    useEffect(() => {
        if (isBiometricAuth) {
            readyToFinish.current = false;

            // 1. Inicia cross-fade (loader → lottie) com easing suave
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: CROSSFADE_DURATION_MS,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();

            // 2. Inicia o Lottie imediatamente (ele aparece conforme o fade avança)
            const playTimer = setTimeout(() => {
                try {
                    lottieRef.current?.reset();
                    lottieRef.current?.play();
                } catch (e) {
                    console.error("Lottie play error:", e);
                    setIsAnimComplete(true);
                }
            }, 50);

            // 3. Timer manual: espera o cross-fade + a animação completa do Lottie
            const finishTimer = setTimeout(() => {
                readyToFinish.current = true;
                setIsAnimComplete(true);
            }, CROSSFADE_DURATION_MS + LOTTIE_DURATION_MS + 300); // +300ms para o "respiro" visual

            // 4. Safety fallback
            const safetyTimeout = setTimeout(() => {
                if (!readyToFinish.current) {
                    setIsAnimComplete(true);
                }
            }, 6000);

            return () => {
                clearTimeout(playTimer);
                clearTimeout(finishTimer);
                clearTimeout(safetyTimeout);
            };
        }
    }, [isBiometricAuth]);

    if (isAuthLoading || isBiometricLoading) {
        return <View style={{ flex: 1, backgroundColor: '#000000' }} />;
    }

    // Mantém a tela de biometria visível enquanto biometria está habilitada
    // (inclui: aguardando auth, mostrando animação, E aguardando navegação)
    if (isFirebaseAuth && isBiometricAvailable && isBiometricEnabled) {
        return (
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                showParticles={true}
                particleCount={15}
            >
                <View style={styles.centeredContainer}>
                    <View style={styles.unlockContainer}>
                        <View style={[styles.iconContainer, { width: LOTTIE_VIEW_SIZE, height: LOTTIE_VIEW_SIZE }]}>
                            {/* Loader - some com rotação e escala */}
                            <Animated.View style={{
                                position: 'absolute',
                                opacity: error ? 0 : loaderOpacity,
                                transform: [
                                    { scale: loaderScale },
                                    { rotate: loaderRotate },
                                ],
                            }}>
                                <ActivityIndicator size="large" color="#d97757" style={{ transform: [{ scale: 1.5 }] }} />
                            </Animated.View>

                            {/* Success Lottie - mesmo tamanho, aparece com escala */}
                            <Animated.View style={{
                                position: 'absolute',
                                opacity: successOpacity,
                                transform: [{ scale: successScale }],
                            }}>
                                <LottieView
                                    ref={lottieRef}
                                    source={require('@/assets/certo.json')}
                                    autoPlay={false}
                                    loop={false}
                                    style={{ width: LOTTIE_VIEW_SIZE, height: LOTTIE_VIEW_SIZE }}
                                    resizeMode="contain"
                                />
                            </Animated.View>
                        </View>

                        {(!isBiometricAuth && !isAnimComplete) && (
                            <View style={{ alignItems: 'center', marginTop: 16, width: '100%' }}>
                                {error && (
                                    <Text style={{ color: '#FF4C4C', marginBottom: 16, fontFamily: 'AROneSans_500Medium', textAlign: 'center' }}>
                                        {error}
                                    </Text>
                                )}
                                <TouchableOpacity
                                    onPress={() => authenticate()}
                                    style={{
                                        paddingVertical: 12,
                                        paddingHorizontal: 24,
                                        backgroundColor: 'rgba(217, 119, 87, 0.15)',
                                        borderRadius: 30,
                                        borderWidth: 1,
                                        borderColor: 'rgba(217, 119, 87, 0.3)',
                                        width: '100%',
                                        maxWidth: 200,
                                        alignItems: 'center'
                                    }}
                                >
                                    <Text style={{ color: '#d97757', fontWeight: '600', fontSize: 16 }}>
                                        {error ? 'Tentar novamente' : 'Desbloquear'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </UniversalBackground>
        );
    }

    return (
        <UniversalBackground
            backgroundColor="#0C0C0C"
            glowSize={350}
            showParticles={true}
            particleCount={15}
        >
            <View style={styles.centeredContainer}>
                <ActivityIndicator size="large" color="#d97757" style={{ transform: [{ scale: 1.5 }] }} />
            </View>
        </UniversalBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a18',
        justifyContent: 'center',
        alignItems: 'center',
    },
    centeredContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    unlockContainer: {
        alignItems: 'center',
        padding: 24,
        width: '100%',
    },
    iconContainer: {
        marginBottom: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#E1E1E0',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#A0A090',
        marginBottom: 32,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#d97757',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        maxWidth: 280,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 32,
        width: '100%',
        maxWidth: 280,
        alignItems: 'center',
    },
    secondaryButtonText: {
        color: '#A0A090',
        fontSize: 14,
        fontWeight: '600',
    },
});
