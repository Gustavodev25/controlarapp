// Offline Banner Component for Controlar+ App
// Styled as a liquid notification expanding from the bottom navbar
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { useNetwork } from '@/contexts/NetworkContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_WIDTH = SCREEN_WIDTH * 0.75;

// Física ajustada para transições mais ágeis e elásticas
const springConfig = { damping: 14, stiffness: 200, mass: 0.6 };

const IntervalLottie = ({ source, size, interval = 5000 }: { source: any; size: number; interval?: number }) => (
    <DelayedLoopLottie
        source={source}
        style={{ width: size, height: size }}
        delay={interval}
        initialDelay={100}
        jitterRatio={0.2}
    />
);

type IslandState = 'HIDDEN' | 'SYNCING' | 'OFFLINE';

export function OfflineBanner() {
    const { isOnline, pendingOps, isSyncing, refresh } = useNetwork();
    const [islandState, setIslandState] = useState<IslandState>('HIDDEN');

    // Largura inicial estreita, escondido atrás do centro do navbar
    const islandWidth = useSharedValue(TAB_BAR_WIDTH * 0.3);
    const islandHeight = useSharedValue(0);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;

        if (!isOnline) {
            // Sem timeout - instantâneo
            setIslandState('OFFLINE');
            islandWidth.value = withSpring(TAB_BAR_WIDTH - 24, springConfig);
            // Cresce unida à navbar
            islandHeight.value = withSpring(48, springConfig);
        } else if (isSyncing || pendingOps > 0) {
            setIslandState('SYNCING');
            islandWidth.value = withSpring(180, springConfig);
            islandHeight.value = withSpring(38, springConfig);
        } else {
            // Volta a encolher e deslizar para trás do navbar
            islandWidth.value = withSpring(TAB_BAR_WIDTH * 0.3, { damping: 16, stiffness: 220, mass: 0.5 });
            islandHeight.value = withSpring(0, { damping: 16, stiffness: 220, mass: 0.5 });

            timeout = setTimeout(() => setIslandState('HIDDEN'), 350);
        }

        return () => clearTimeout(timeout);
    }, [isOnline, isSyncing, pendingOps]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: islandWidth.value,
        height: islandHeight.value,
    }));

    if (islandState === 'HIDDEN') return null;

    return (
        <Animated.View style={[styles.dynamicIsland, animatedStyle]}>

            {/* ESTADO: SINCRONIZANDO (Verde) */}
            {islandState === 'SYNCING' && (
                <Animated.View
                    entering={FadeIn.duration(150)}
                    exiting={FadeOut.duration(100)}
                    style={[styles.islandContent, styles.syncingContent]}
                >
                    <Ionicons name="sync" size={16} color="#66BB6A" />
                    <Text style={styles.syncingText}>
                        Sincronizando {pendingOps}...
                    </Text>
                </Animated.View>
            )}

            {/* ESTADO: OFFLINE (Laranja) */}
            {islandState === 'OFFLINE' && (
                <Animated.View
                    entering={FadeIn.duration(150)}
                    exiting={FadeOut.duration(100)}
                    style={[styles.islandContent, styles.offlineContent]}
                >
                    <View style={styles.offlineLeft}>
                        <IntervalLottie
                            source={require('@/assets/perigo.json')}
                            size={18}
                            interval={4000}
                        />
                        <Text style={styles.offlineText} numberOfLines={1}>
                            Sem conexão
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.retryButton} onPress={refresh}>
                        <Text style={styles.retryButtonText}>Tentar</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

        </Animated.View>
    );
}

const styles = StyleSheet.create({
    dynamicIsland: {
        position: 'absolute',
        bottom: 70, // Alinhado ao topo do navbar
        alignSelf: 'center',
        backgroundColor: '#141414',
        overflow: 'hidden',
        zIndex: 5, // Fica entre o background principal (0) e a navbar (10)
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    islandContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },

    /* ---- Sincronizando ---- */
    syncingContent: {
        justifyContent: 'center',
        backgroundColor: 'rgba(102, 187, 106, 0.08)',
        gap: 8,
    },
    syncingText: {
        color: '#66BB6A',
        fontSize: 13,
        fontWeight: '500',
    },

    /* ---- Offline ---- */
    offlineContent: {
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#141414',
    },
    offlineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    offlineText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '500',
        fontFamily: 'AROneSans_500Medium',
        flexShrink: 1,
    },
    retryButton: {
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginLeft: 8,
    },
    retryButtonText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'AROneSans_500Medium',
    },
});