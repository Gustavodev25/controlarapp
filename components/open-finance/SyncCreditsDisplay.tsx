import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import { databaseService } from '@/services/firebase';
import { Clock, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    FadeIn
} from 'react-native-reanimated';
import { CreditsModal } from './CreditsModal';

interface SyncCreditsDisplayProps {
    userId: string;
    onCreditsChange?: (credits: number) => void;
    compact?: boolean;
    onConnect?: () => void;
    connectDisabled?: boolean;
}

export interface SyncCreditsData {
    credits: number;
    lastResetDate: string | null;
    lastSyncDate: string | null;
    canSync: boolean;
    syncedItems?: { [itemId: string]: string }; // Map of itemId -> lastSyncDate
    isAdmin?: boolean;
    unlimited?: boolean;
}

// Helper Lottie component that plays at intervals (matching RecurrenceView)


export const SyncCreditsDisplay = ({
    userId,
    onCreditsChange,
    compact = false,
    onConnect,
    connectDisabled = false
}: SyncCreditsDisplayProps) => {
    const [creditsData, setCreditsData] = useState<SyncCreditsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeUntilReset, setTimeUntilReset] = useState<string>('');
    const [infoModalVisible, setInfoModalVisible] = useState(false);

    // Removed pulse animation logic

    const fetchCredits = async () => {
        if (!userId) return;

        try {
            const result = await databaseService.getSyncCredits(userId);
            if (result.success && result.data) {
                setCreditsData(result.data);
                onCreditsChange?.(result.data.credits);
            }
        } catch (error) {
            console.error('Error fetching sync credits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCredits();

        // Update time until reset every minute
        const updateTimer = () => {
            const reset = databaseService.getTimeUntilReset();
            setTimeUntilReset(reset.formatted);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [userId]);

    if (loading || !creditsData) {
        return null;
    }

    const getCreditsColor = () => {
        // Cor amarela fixa para o número de créditos
        return '#F5A623';
    };

    const renderCreditDots = () => {
        const dots = [];
        for (let i = 0; i < 3; i++) {
            const isActive = i < creditsData.credits;
            dots.push(
                <View
                    key={i}
                    style={[
                        styles.creditDot,
                        isActive
                            ? { backgroundColor: getCreditsColor() }
                            : { backgroundColor: '#333', borderWidth: 1, borderColor: '#444' }
                    ]}
                />
            );
        }
        return dots;
    };

    if (compact) {
        // If no credits, show countdown text instead of connect button
        if (!creditsData.unlimited && creditsData.credits === 0) {
            return (
                <View style={[styles.unifiedButton, styles.unifiedButtonDisabled, { opacity: 0.8 }]}>
                    <Clock size={16} color="#AAA" />
                    <Text style={[styles.unifiedButtonText, { color: '#AAA' }]}>
                        Faltam {timeUntilReset}
                    </Text>
                </View>
            );
        }

        return (
            <>
                {onConnect && (
                    <TouchableOpacity
                        onPress={onConnect}
                        activeOpacity={0.7}
                        disabled={connectDisabled}
                        style={[
                            styles.unifiedButton,
                            connectDisabled && styles.unifiedButtonDisabled
                        ]}
                    >
                        <DelayedLoopLottie
                            source={require('@/assets/adicionar.json')}
                            style={{ width: 18, height: 18 }}
                            delay={3000}
                            initialDelay={500}
                            jitterRatio={0.3}
                            renderMode="HARDWARE"
                        />
                        <Text style={styles.unifiedButtonText}>
                            Conectar <Text style={{ opacity: 0.8 }}>({creditsData.unlimited ? '∞' : creditsData.credits})</Text>
                        </Text>
                    </TouchableOpacity>
                )}

                <CreditsModal
                    visible={infoModalVisible}
                    onClose={() => setInfoModalVisible(false)}
                    credits={creditsData.credits}
                    userId={userId}
                />
            </>
        );
    }

    return (
        <Animated.View entering={FadeIn} style={styles.container}>
            <View style={styles.creditsCard}>
                <View style={styles.headerRow}>
                    <View style={styles.iconContainer}>
                        <Zap size={16} color="#D97757" />
                    </View>
                    <Text style={styles.title}>Créditos de Sincronização</Text>
                </View>

                <View style={styles.creditsRow}>
                    <Animated.View style={[styles.creditsValue]}>
                        <Text style={[styles.creditsNumber, { color: getCreditsColor() }]}>
                            {creditsData.unlimited ? '∞' : creditsData.credits}
                        </Text>
                        {!creditsData.unlimited && <Text style={styles.creditsMax}>/3</Text>}
                    </Animated.View>

                    <View style={styles.dotsContainer}>
                        {renderCreditDots()}
                    </View>
                </View>

                {!creditsData.unlimited && creditsData.credits < 3 && (
                    <View style={styles.resetInfo}>
                        <Clock size={12} color="#666" />
                        <Text style={styles.resetText}>
                            Renova em {timeUntilReset}
                        </Text>
                    </View>
                )}

                <View style={styles.rulesContainer}>
                    <Text style={styles.ruleText}>• 1 crédito = conectar nova conta</Text>
                    <Text style={styles.ruleText}>• 1 crédito = sincronizar dados</Text>
                    <Text style={styles.ruleText}>• Sincronização: 1x por dia</Text>
                </View>
            </View>
        </Animated.View>
    );
};

// Hook para usar os créditos em outros componentes
export const useSyncCredits = (userId: string | undefined) => {
    const [credits, setCredits] = useState<SyncCreditsData | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const result = await databaseService.getSyncCredits(userId);
            if (result.success && result.data) {
                setCredits(result.data);
            }
        } catch (error) {
            console.error('Error fetching sync credits:', error);
        } finally {
            setLoading(false);
        }
    };

    // Updated to accept optional itemId for per-bank sync tracking
    const consumeCredit = async (action: 'connect' | 'sync', itemId?: string) => {
        if (!userId) return { success: false, error: 'Usuário não encontrado' };

        const result = await databaseService.consumeSyncCredit(userId, action, itemId);
        if (result.success) {
            await refresh(); // Refresh after consuming
        }
        return result;
    };

    // Check if a specific bank can sync today
    const canSyncItem = (itemId: string): boolean => {
        if (credits?.unlimited) return true;
        if (!credits?.syncedItems || !itemId) return true;
        const today = new Date().toISOString().split('T')[0];
        return credits.syncedItems[itemId] !== today;
    };

    useEffect(() => {
        refresh();
    }, [userId]);

    return {
        credits,
        loading,
        refresh,
        consumeCredit,
        hasCredits: Boolean(credits?.unlimited) || (credits?.credits ?? 0) > 0,
        canSync: true, // Now always true - per-bank check via canSyncItem
        syncedItems: credits?.syncedItems || {},
        canSyncItem,
    };
};


const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    creditsCard: {
        backgroundColor: '#111111',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#222',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 119, 87, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    creditsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    creditsValue: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    creditsNumber: {
        fontSize: 32,
        fontWeight: '700',
    },
    creditsMax: {
        fontSize: 18,
        color: '#666',
        fontWeight: '500',
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 6,
    },
    creditDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    resetInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#222',
        marginTop: 8,
    },
    resetText: {
        fontSize: 12,
        color: '#666',
    },
    rulesContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    ruleText: {
        fontSize: 11,
        color: '#888',
        marginBottom: 4,
    },
    // Unified Button Styles
    unifiedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D97757',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    unifiedButtonDisabled: {
        backgroundColor: '#444',
        opacity: 0.6,
    },
    unifiedButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
});


