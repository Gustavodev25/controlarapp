import { useNetwork } from '@/contexts/NetworkContext';
import { useOpenFinanceSyncState } from '@/hooks/useOpenFinanceSyncState';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

type Variant = 'offline' | 'error' | 'syncing';

const PHASE_LABEL: Record<string, string> = {
    connecting: 'Conectando ao banco',
    fetching_accounts: 'Buscando contas',
    saving_accounts: 'Salvando contas',
    fetching_transactions: 'Buscando transações',
    saving_transactions: 'Salvando transações',
};

const PHASE_PROGRESS: Record<string, number> = {
    connecting: 0.1,
    fetching_accounts: 0.25,
    saving_accounts: 0.4,
    fetching_transactions: 0.65,
    saving_transactions: 0.9,
};

export function OpenFinanceSyncBanner() {
    const { isOnline } = useNetwork();
    const sync = useOpenFinanceSyncState();

    const variant = useMemo<Variant | null>(() => {
        if (!isOnline) return 'offline';
        if (sync.phase === 'error') return 'error';
        if (sync.active && sync.phase !== 'idle' && sync.phase !== 'done') return 'syncing';
        return null;
    }, [isOnline, sync.active, sync.phase]);

    if (!variant) return null;

    const phaseLabel = PHASE_LABEL[sync.phase] || 'Sincronizando';
    const progress = Math.max(0, Math.min(1, sync.progress > 0 ? sync.progress : (PHASE_PROGRESS[sync.phase] || 0.5)));

    return (
        <Animated.View
            entering={FadeInUp.duration(180)}
            exiting={FadeOutUp.duration(140)}
            style={[
                styles.banner,
                variant === 'offline' && styles.bannerOffline,
                variant === 'error' && styles.bannerError,
                variant === 'syncing' && styles.bannerSyncing,
            ]}
        >
            <View style={styles.bannerRow}>
                {variant === 'offline' && (
                    <>
                        <WifiOff size={14} color="#F5A524" strokeWidth={2.4} />
                        <Text style={[styles.bannerText, { color: '#F5A524' }]} numberOfLines={1}>
                            Sem conexão — exibindo dados em cache
                        </Text>
                    </>
                )}
                {variant === 'error' && (
                    <>
                        <AlertTriangle size={14} color="#FA5C5C" strokeWidth={2.4} />
                        <Text style={[styles.bannerText, { color: '#FA5C5C' }]} numberOfLines={1}>
                            {sync.bankName ? `Falha ao sincronizar ${sync.bankName}` : 'Falha na sincronização bancária'}
                        </Text>
                    </>
                )}
                {variant === 'syncing' && (
                    <>
                        <RefreshCw size={14} color="#32D74B" strokeWidth={2.4} />
                        <Text style={[styles.bannerText, { color: '#A8E8B5' }]} numberOfLines={1}>
                            {sync.bankName ? `${sync.bankName} • ${phaseLabel}` : phaseLabel}
                        </Text>
                    </>
                )}
            </View>

            {variant === 'syncing' && (
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        marginHorizontal: 22,
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 12,
        borderWidth: 1,
        gap: 7,
    },
    bannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    bannerText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
    },
    bannerOffline: {
        backgroundColor: 'rgba(245, 165, 36, 0.08)',
        borderColor: 'rgba(245, 165, 36, 0.25)',
    },
    bannerError: {
        backgroundColor: 'rgba(250, 92, 92, 0.08)',
        borderColor: 'rgba(250, 92, 92, 0.25)',
    },
    bannerSyncing: {
        backgroundColor: 'rgba(50, 215, 75, 0.06)',
        borderColor: 'rgba(50, 215, 75, 0.20)',
    },
    progressTrack: {
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: '#32D74B',
    },
});
