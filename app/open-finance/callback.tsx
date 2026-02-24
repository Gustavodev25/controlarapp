import { openFinanceConnectionState } from '@/services/openFinanceConnectionState';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

const normalizeParam = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) return value[0] ?? null;
    if (typeof value === 'string') return value;
    return null;
};

export default function OpenFinanceCallbackScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        itemId?: string | string[];
        status?: string | string[];
        error?: string | string[];
    }>();

    useEffect(() => {
        let mounted = true;

        const persistAndRedirect = async () => {
            const itemId = normalizeParam(params.itemId);
            const status = normalizeParam(params.status);
            const error = normalizeParam(params.error);

            await openFinanceConnectionState.saveCallbackPayload({
                itemId,
                status,
                error,
                receivedAt: Date.now(),
                rawUrl: null
            });

            if (!mounted) return;
            router.replace('/(tabs)/open-finance');
        };

        persistAndRedirect().catch(() => {
            if (mounted) router.replace('/(tabs)/open-finance');
        });

        return () => {
            mounted = false;
        };
    }, [params.error, params.itemId, params.status, router]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#D97757" />
            <Text style={styles.text}>Finalizando conexão bancária...</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0C0C0C',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 24
    },
    text: {
        color: '#E5E7EB',
        fontSize: 14,
        textAlign: 'center'
    }
});
