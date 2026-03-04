import { useOpenFinanceSync } from '@/contexts/OpenFinanceSyncContext';
import { CheckCircle, RefreshCw, XCircle } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import AnimatedReanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const springConfigInline = { damping: 14, stiffness: 200, mass: 0.6 };

export function GlobalSyncBanner() {
    const { syncState } = useOpenFinanceSync();
    const opacity = useSharedValue(0);

    const isVisible = ['connecting', 'oauth_pending', 'success', 'error'].includes(syncState.step) && syncState.isActive;

    useEffect(() => {
        if (isVisible) {
            opacity.value = withSpring(1, springConfigInline);
        } else {
            opacity.value = withSpring(0, { damping: 16, stiffness: 220, mass: 0.5 });
        }
    }, [isVisible, syncState.step]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { scale: opacity.value },
            { translateY: (1 - opacity.value) * 15 }
        ]
    }));

    if (!isVisible && opacity.value === 0) return null;

    return (
        <View style={styles.dynamicIslandContainer} pointerEvents={isVisible ? 'auto' : 'none'}>
            <AnimatedReanimated.View
                style={[
                    styles.dynamicIsland,
                    syncState.step === 'error' && styles.dynamicIslandError,
                    syncState.step === 'success' && styles.dynamicIslandSuccess,
                    animatedStyle,
                    {
                        overflow: 'hidden',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        minWidth: 100,
                        maxWidth: (Dimensions.get('window').width * 0.75) - 40,
                        minHeight: 48,
                    }
                ]}
            >
                {syncState.step === 'error' ? (
                    <XCircle size={18} color="#ef4444" style={{ marginRight: 8, flexShrink: 0 }} />
                ) : syncState.step === 'success' ? (
                    <CheckCircle size={18} color="#22c55e" style={{ marginRight: 8, flexShrink: 0 }} />
                ) : (
                    <RefreshCw size={18} color="#66BB6A" style={{ marginRight: 8, flexShrink: 0 }} />
                )}
                <Text
                    style={[
                        styles.dynamicIslandText,
                        syncState.step === 'error' && { color: '#ffb3b3' },
                        syncState.step === 'success' && { color: '#b3ffcc' },
                        { flexShrink: 1, textAlign: 'left', flexWrap: 'wrap' }
                    ]}
                    numberOfLines={2}
                >
                    {syncState.step === 'error' ? syncState.error : (syncState.statusText || 'Sincronizando...')}
                </Text>
            </AnimatedReanimated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    dynamicIslandContainer: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
        elevation: 50,
    },
    dynamicIsland: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 24,
        backgroundColor: '#1E1E1E',
        borderWidth: 1,
        borderColor: '#333333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 10,
    },
    dynamicIslandError: {
        backgroundColor: '#2A1111',
        borderColor: '#4A2020',
    },
    dynamicIslandSuccess: {
        backgroundColor: '#112A18',
        borderColor: '#204A2A',
    },
    dynamicIslandText: {
        color: '#E0E0E0',
        fontSize: 14,
        fontWeight: '500',
    },
});
