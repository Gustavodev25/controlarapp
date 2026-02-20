import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { useNetwork } from '@/contexts/NetworkContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

/**
 * Card de aviso de modo offline — mesmo estilo visual do DeleteConfirmCard.
 * Mostra quando o app está sem conexão. Use em qualquer tela.
 */
export function OfflineWarningCard({ style }: { style?: any }) {
    const { isOnline, pendingOps, isSyncing, refresh } = useNetwork();

    if (isOnline && !isSyncing && pendingOps === 0) return null;

    // Syncing state
    if (isOnline && (isSyncing || pendingOps > 0)) {
        return (
            <Animated.View
                entering={FadeIn.duration(300)}
                exiting={FadeOut.duration(200)}
                layout={Layout.springify()}
                style={[styles.card, styles.syncingCard, style]}
            >
                <View style={styles.content}>
                    <Ionicons name="sync" size={18} color="#FFA726" />
                    <Text style={styles.syncingText}>
                        Sincronizando {pendingOps} {pendingOps === 1 ? 'alteração' : 'alterações'}...
                    </Text>
                </View>
            </Animated.View>
        );
    }

    // Offline state
    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            layout={Layout.springify()}
            style={[styles.card, styles.offlineCard, style]}
        >
            <View style={styles.content}>
                <DelayedLoopLottie
                    source={require('@/assets/perigo.json')}
                    style={{ width: 22, height: 22 }}
                    delay={4000}
                    initialDelay={100}
                    jitterRatio={0.2}
                />
                <Text style={styles.offlineText}>
                    Você está sem conexão. Os dados exibidos podem estar desatualizados.
                </Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={refresh}
                >
                    <Ionicons name="refresh" size={14} color="#FFF" />
                    <Text style={styles.retryButtonText}>Tentar</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        width: '100%',
    },
    offlineCard: {
        backgroundColor: 'rgba(255, 167, 38, 0.1)',
        borderColor: 'rgba(255, 167, 38, 0.25)',
    },
    syncingCard: {
        backgroundColor: 'rgba(102, 187, 106, 0.1)',
        borderColor: 'rgba(102, 187, 106, 0.25)',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    offlineText: {
        color: '#FFA726',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
        fontFamily: 'AROneSans_500Medium',
    },
    syncingText: {
        color: '#66BB6A',
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
        fontFamily: 'AROneSans_500Medium',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
    },
    retryButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 167, 38, 0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'AROneSans_600SemiBold',
    },
});
