import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DeleteConfirmationModalProps {
    visible: boolean;
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
}

const EXPANDED_HEIGHT = 64;
const COMPACT_SIZE = 16;

const HORIZONTAL_MARGIN = 18;
const MAX_EXPANDED_WIDTH = 360;

export function DeleteConfirmationModal({
    visible,
    title,
    onCancel,
    onConfirm,
    confirmText = 'Excluir',
    cancelText = 'Cancelar',
}: DeleteConfirmationModalProps) {
    const insets = useSafeAreaInsets();
    const { width: screenWidth } = useWindowDimensions();

    const [shouldRender, setShouldRender] = useState(visible);

    const morph = useRef(new Animated.Value(visible ? 1 : 0)).current;
    const content = useRef(new Animated.Value(visible ? 1 : 0)).current;
    const pressConfirm = useRef(new Animated.Value(0)).current;
    const pressCancel = useRef(new Animated.Value(0)).current;

    const expandedWidth = Math.min(
        screenWidth - HORIZONTAL_MARGIN * 2,
        MAX_EXPANDED_WIDTH
    );

    const compactScaleX = COMPACT_SIZE / expandedWidth;
    const compactScaleY = COMPACT_SIZE / EXPANDED_HEIGHT;

    const islandTop =
        Platform.OS === 'ios'
            ? Math.max(10, insets.top - 46)
            : Math.max(12, insets.top - 10);

    /**
     * Compensa o scale pelo centro, para parecer que nasce da bolinha
     * no topo e expande para baixo.
     */
    const collapsedTranslateY = -((EXPANDED_HEIGHT - COMPACT_SIZE) / 2);

    useEffect(() => {
        morph.stopAnimation();
        content.stopAnimation();
        pressConfirm.stopAnimation();
        pressCancel.stopAnimation();

        if (visible) {
            setShouldRender(true);

            morph.setValue(0);
            content.setValue(0);

            requestAnimationFrame(() => {
                Animated.parallel([
                    Animated.spring(morph, {
                        toValue: 1,
                        stiffness: 235,
                        damping: 16,
                        mass: 0.72,
                        velocity: 1.2,
                        overshootClamping: false,
                        restDisplacementThreshold: 0.001,
                        restSpeedThreshold: 0.001,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.delay(80),
                        Animated.spring(content, {
                            toValue: 1,
                            stiffness: 240,
                            damping: 20,
                            mass: 0.72,
                            overshootClamping: false,
                            restDisplacementThreshold: 0.001,
                            restSpeedThreshold: 0.001,
                            useNativeDriver: true,
                        }),
                    ]),
                ]).start();
            });

            return;
        }

        Animated.parallel([
            Animated.timing(content, {
                toValue: 0,
                duration: 70,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.spring(morph, {
                toValue: 0,
                stiffness: 280,
                damping: 22,
                mass: 0.76,
                velocity: -1.1,
                overshootClamping: false,
                restDisplacementThreshold: 0.001,
                restSpeedThreshold: 0.001,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) {
                setShouldRender(false);
            }
        });
    }, [visible, morph, content, pressConfirm, pressCancel]);

    const animateBtn = (value: Animated.Value, toValue: number) => {
        Animated.spring(value, {
            toValue,
            stiffness: 420,
            damping: 30,
            mass: 0.56,
            useNativeDriver: true,
        }).start();
    };

    if (!shouldRender) return null;

    const scaleX = morph.interpolate({
        inputRange: [0, 0.48, 0.74, 1],
        outputRange: [compactScaleX, 1.075, 0.988, 1],
    });

    const scaleY = morph.interpolate({
        inputRange: [0, 0.46, 0.72, 1],
        outputRange: [compactScaleY, 1.095, 0.985, 1],
    });

    const translateY = morph.interpolate({
        inputRange: [0, 0.48, 0.74, 1],
        outputRange: [collapsedTranslateY, 4, -1.4, 0],
    });

    const borderRadius = morph.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [999, 28, 24],
    });

    const overlayOpacity = morph.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const contentOpacity = content.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const contentTranslateY = content.interpolate({
        inputRange: [0, 1],
        outputRange: [-3, 0],
    });

    const contentScale = content.interpolate({
        inputRange: [0, 1],
        outputRange: [0.97, 1],
    });

    const dotOpacity = morph.interpolate({
        inputRange: [0, 0.2, 0.42],
        outputRange: [1, 0.9, 0],
        extrapolate: 'clamp',
    });

    const confirmScale = pressConfirm.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.96],
    });

    const cancelScale = pressCancel.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.97],
    });

    return (
        <Animated.View
            style={[styles.overlay, { opacity: overlayOpacity }]}
            pointerEvents="box-none"
        >
            <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

            <View
                style={[
                    styles.wrapper,
                    {
                        top: islandTop,
                        width: expandedWidth,
                        height: EXPANDED_HEIGHT,
                    },
                ]}
                pointerEvents="box-none"
            >
                <Animated.View
                    pointerEvents="auto"
                    style={[
                        styles.morphContainer,
                        {
                            borderRadius,
                            transform: [{ translateY }, { scaleX }, { scaleY }],
                        },
                    ]}
                >
                    <View style={styles.surface}>
                        <Animated.View
                            pointerEvents="none"
                            style={[styles.topDot, { opacity: dotOpacity }]}
                        />

                        <Animated.View
                            style={[
                                styles.content,
                                {
                                    opacity: contentOpacity,
                                    transform: [
                                        { translateY: contentTranslateY },
                                        { scale: contentScale },
                                    ],
                                },
                            ]}
                        >
                            <View style={styles.row}>
                                <Text style={styles.title} numberOfLines={1}>
                                    {title}
                                </Text>

                                <View style={styles.actionsRow}>
                                    <Animated.View
                                        style={{ transform: [{ scale: cancelScale }] }}
                                    >
                                        <TouchableOpacity
                                            style={styles.cancelButton}
                                            activeOpacity={0.9}
                                            onPressIn={() =>
                                                animateBtn(pressCancel, 1)
                                            }
                                            onPressOut={() =>
                                                animateBtn(pressCancel, 0)
                                            }
                                            onPress={onCancel}
                                            hitSlop={{
                                                top: 8,
                                                bottom: 8,
                                                left: 8,
                                                right: 8,
                                            }}
                                        >
                                            <Text style={styles.cancelText}>
                                                {cancelText}
                                            </Text>
                                        </TouchableOpacity>
                                    </Animated.View>

                                    <Animated.View
                                        style={{ transform: [{ scale: confirmScale }] }}
                                    >
                                        <TouchableOpacity
                                            style={styles.confirmButton}
                                            activeOpacity={0.9}
                                            onPressIn={() =>
                                                animateBtn(pressConfirm, 1)
                                            }
                                            onPressOut={() =>
                                                animateBtn(pressConfirm, 0)
                                            }
                                            onPress={onConfirm}
                                            hitSlop={{
                                                top: 8,
                                                bottom: 8,
                                                left: 8,
                                                right: 8,
                                            }}
                                        >
                                            <Text style={styles.confirmText}>
                                                {confirmText}
                                            </Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                </View>
                            </View>
                        </Animated.View>
                    </View>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        alignItems: 'center',
    },

    wrapper: {
        position: 'absolute',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },

    morphContainer: {
        width: '100%',
        height: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 18,
        overflow: 'hidden',
    },

    surface: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#141414',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '#2B2B2B',
        paddingHorizontal: 14,
        justifyContent: 'center',
    },

    topDot: {
        position: 'absolute',
        width: COMPACT_SIZE,
        height: COMPACT_SIZE,
        borderRadius: 999,
        alignSelf: 'center',
        top: (EXPANDED_HEIGHT - COMPACT_SIZE) / 2,
        backgroundColor: '#0A0A0A',
    },

    content: {
        flex: 1,
        justifyContent: 'center',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },

    title: {
        flex: 1,
        minWidth: 0,
        color: '#F5F5F5',
        fontSize: 16,
        lineHeight: 20,
        fontWeight: '700',
        letterSpacing: -0.15,
    },

    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },

    cancelButton: {
        minHeight: 30,
        paddingHorizontal: 10,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.08)',
    },

    cancelText: {
        color: '#A3A3A3',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: -0.05,
    },

    confirmButton: {
        minHeight: 30,
        paddingHorizontal: 12,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 69, 58, 0.14)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 69, 58, 0.28)',
    },

    confirmText: {
        color: '#FF453A',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: -0.05,
    },
});