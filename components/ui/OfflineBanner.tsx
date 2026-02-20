// Offline Banner Component for Controlar+ App
// Same visual style as DeleteConfirmCard
import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { useNetwork } from '@/contexts/NetworkContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Layout,
    SlideInRight,
    SlideOutRight
} from 'react-native-reanimated';

const IntervalLottie = ({ source, size, interval = 5000 }: { source: any; size: number; interval?: number }) => (
    <DelayedLoopLottie
        source={source}
        style={{ width: size, height: size }}
        delay={interval}
        initialDelay={100}
        jitterRatio={0.2}
    />
);

export function OfflineBanner() {
    const { isOnline, pendingOps, isSyncing, refresh } = useNetwork();
    const [showBanner, setShowBanner] = useState(false);

    // Delay showing the banner to avoid flashing for brief disconnections
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;

        if (!isOnline) {
            timeout = setTimeout(() => setShowBanner(true), 1500);
        } else if (isSyncing || pendingOps > 0) {
            setShowBanner(true);
        } else {
            setShowBanner(false);
        }

        return () => clearTimeout(timeout);
    }, [isOnline, isSyncing, pendingOps]);

    // Syncing state — same card style, green theme
    if (isOnline && (isSyncing || pendingOps > 0)) {
        return (
            <Animated.View
                entering={SlideInRight.duration(300).springify()}
                exiting={SlideOutRight.duration(200)}
                layout={Layout.springify()}
                style={[styles.card, styles.syncingCard]}
            >
                <View style={styles.cardContent}>
                    <Ionicons name="sync" size={20} color="#66BB6A" />
                    <Text style={styles.syncingText}>
                        Sincronizando {pendingOps} {pendingOps === 1 ? 'alteração' : 'alterações'}...
                    </Text>
                </View>
            </Animated.View>
        );
    }

    if (!showBanner) return null;

    // Offline state — same card style as DeleteConfirmCard, orange/warning theme
    return (
        <Animated.View
            entering={SlideInRight.duration(300).springify()}
            exiting={SlideOutRight.duration(200)}
            layout={Layout.springify()}
            style={[styles.card, styles.offlineCard]}
        >
            <View style={styles.cardContent}>
                <IntervalLottie
                    source={require('@/assets/perigo.json')}
                    size={22}
                    interval={4000}
                />
                <Text style={styles.offlineText}>
                    Você está sem conexão
                </Text>
            </View>
            <View style={styles.cardActions}>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={refresh}
                >
                    <Text style={styles.retryButtonText}>Reconectar</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'absolute',
        top: 54,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    offlineCard: {
        backgroundColor: 'rgba(255, 167, 38, 0.1)',
        borderColor: 'rgba(255, 167, 38, 0.2)',
    },
    syncingCard: {
        backgroundColor: 'rgba(102, 187, 106, 0.1)',
        borderColor: 'rgba(102, 187, 106, 0.2)',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    offlineText: {
        color: '#FFA726',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    syncingText: {
        color: '#66BB6A',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    retryButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: '#FFA726',
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
});
