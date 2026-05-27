import { DelayedLoopLottie } from '@/components/ui/DelayedLoopLottie';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Layout, SlideInRight, SlideOutRight } from 'react-native-reanimated';

const IntervalLottie = ({ source, size, interval = 5000 }: { source: any; size: number; interval?: number }) => (
    <DelayedLoopLottie
        source={source}
        style={{ width: size, height: size }}
        delay={interval}
        initialDelay={100}
        jitterRatio={0.2}
    />
);

interface DeleteConfirmCardProps {
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    style?: any;
}

export function DeleteConfirmCard({
    title,
    onCancel,
    onConfirm,
    confirmText = "Sim, excluir",
    cancelText = "Cancelar",
    style
}: DeleteConfirmCardProps) {
    return (
        <Animated.View
            entering={SlideInRight.duration(300).springify()}
            exiting={SlideOutRight.duration(200)}
            layout={Layout.springify()}
            style={[styles.deleteConfirmCard, style]}
        >
            <View style={styles.deleteConfirmContent}>
                <IntervalLottie
                    source={require('@/assets/perigo.json')}
                    size={22}
                    interval={4000}
                />
                <Text style={styles.deleteConfirmText}>
                    {title}
                </Text>
            </View>
            <View style={styles.deleteConfirmActions}>
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onCancel}
                >
                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.confirmDeleteButton}
                    onPress={onConfirm}
                >
                    <Text style={styles.confirmDeleteButtonText}>{confirmText}</Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    deleteConfirmCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        width: '100%',
    },
    deleteConfirmContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    deleteConfirmText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    deleteConfirmActions: {
        flexDirection: 'row',
        gap: 8,
    },
    cancelButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    cancelButtonText: {
        color: '#CCC',
        fontSize: 12,
        fontWeight: '500',
    },
    confirmDeleteButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
    },
    confirmDeleteButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
});

