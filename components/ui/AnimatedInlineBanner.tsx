import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import {
    AccessibilityInfo,
    Dimensions,
    StyleSheet,
    Text,
    type TextLayoutEvent,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    Easing,
    Extrapolation,
    interpolate,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ────────────────────────────────────────────────────────────────────────────
 * Types & API
 * ──────────────────────────────────────────────────────────────────────────── */

type InlineBannerStep = 'connecting' | 'oauth_pending' | 'success' | 'error' | string;

export interface AnimatedInlineBannerProps {
    show: boolean;
    step?: InlineBannerStep;
    error?: string | null;
    statusText?: string;
    title?: string;
    onCancel?: () => void;
    onConfirm?: () => void;
    cancelText?: string;
    confirmText?: string;
    centerActions?: boolean;
    actions?: {
        cancelLabel?: string;
        confirmLabel?: string;
        onCancel: () => void;
        onConfirm: () => void;
        disabled?: boolean;
    };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Layout constants
 * ──────────────────────────────────────────────────────────────────────────── */

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FLOATING_TAB_BAR_BOTTOM = 20;
const FLOATING_TAB_BAR_HEIGHT = 58;
const BANNER_BOTTOM_OFFSET = FLOATING_TAB_BAR_BOTTOM + FLOATING_TAB_BAR_HEIGHT - 1;

const TOP_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.78, 340);
const BANNER_MAX_WIDTH = Math.round(TOP_BAR_WIDTH * 0.8);
const BANNER_HORIZONTAL_PADDING = 10;
const TEXT_ONLY_WIDTH_BUFFER = BANNER_HORIZONTAL_PADDING * 2 + 2;
const ESTIMATED_TEXT_CHAR_WIDTH = 8.5;

// Discrete morph targets — each "shape" the banner can take
const SHAPE = {
    compactActions: { width: 138, height: 50, radius: 26 }, // Sim/Não centralizado
    textOnly: { width: 0, height: 50, radius: 24 }, // mensagem curta
    textLong: { width: BANNER_MAX_WIDTH, height: 60, radius: 28 }, // 2 linhas
    withActions: { width: BANNER_MAX_WIDTH, height: 50, radius: 24 }, // texto + ações
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Spring physics — Dynamic Island feel
 *
 * Key insight: Apple's DI uses ~190 stiffness with damping ~15 for the morph.
 * Entry has a touch more bounce; settles use higher damping to kill oscillation
 * before the user's eye can catch a "jiggle". Mass stays near 1.0 — heavier
 * feels sluggish, lighter feels twitchy.
 * ──────────────────────────────────────────────────────────────────────────── */

const SPRING_ENTRY = {
    damping: 16,
    stiffness: 195,
    mass: 1.05,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_MORPH = {
    damping: 24,
    stiffness: 160,
    mass: 1.0,
    overshootClamping: true,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_STRETCH = {
    damping: 12,
    stiffness: 165,
    mass: 1.1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_RECOIL = {
    damping: 16,
    stiffness: 150,
    mass: 1.05,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_SETTLE = {
    damping: 22,
    stiffness: 160,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

/* ────────────────────────────────────────────────────────────────────────────
 * Theme — colors per step
 * ──────────────────────────────────────────────────────────────────────────── */

function getBannerColors(step: InlineBannerStep) {
    if (step === 'error') {
        return {
            text: '#FFB3B3',
            rightBlur: 'rgba(239,68,68,0.18)',
            rightBlurSoft: 'rgba(239,68,68,0.06)',
            edgeLight: 'rgba(255,255,255,0.025)',
        };
    }
    if (step === 'success') {
        return {
            text: '#B3FFCC',
            rightBlur: 'rgba(34,197,94,0.17)',
            rightBlurSoft: 'rgba(34,197,94,0.06)',
            edgeLight: 'rgba(255,255,255,0.025)',
        };
    }
    return {
        text: '#66BB6A',
        rightBlur: 'rgba(102,187,106,0.18)',
        rightBlurSoft: 'rgba(102,187,106,0.06)',
        edgeLight: 'rgba(255,255,255,0.025)',
    };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Shape resolver — picks the right morph target for current props
 * ──────────────────────────────────────────────────────────────────────────── */

function resolveShape(opts: {
    hasActions: boolean;
    centerActions: boolean;
    labelLength: number;
    measuredTextWidth?: number | null;
    isSyncing: boolean;
}): { width: number; height: number; radius: number } {
    if (opts.centerActions) return SHAPE.compactActions;
    if (opts.hasActions) return SHAPE.withActions;
    
    if (opts.isSyncing) {
        return {
            width: BANNER_MAX_WIDTH,
            height: 60,
            radius: 28,
        };
    }

    if (opts.labelLength > 28) return SHAPE.textLong;

    const textWidth = opts.measuredTextWidth ?? opts.labelLength * ESTIMATED_TEXT_CHAR_WIDTH;
    return {
        ...SHAPE.textOnly,
        width: Math.min(
            BANNER_MAX_WIDTH,
            Math.max(1, Math.ceil(textWidth + TEXT_ONLY_WIDTH_BUFFER))
        ),
    };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

export function AnimatedInlineBanner({
    show,
    step,
    error,
    statusText,
    title,
    onCancel,
    onConfirm,
    cancelText,
    confirmText,
    centerActions,
    actions,
}: AnimatedInlineBannerProps) {
    const insets = useSafeAreaInsets();
    const measuredLabelRef = useRef<string | null>(null);
    const [measuredTextWidth, setMeasuredTextWidth] = React.useState<number | null>(null);

    // ── Reduced-motion accessibility ────────────────────────────────────────
    const reducedMotionRef = useRef(false);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) reducedMotionRef.current = enabled;
        });
        const sub = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            (enabled) => {
                reducedMotionRef.current = enabled;
            }
        );
        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    // ── Resolve effective state from props ──────────────────────────────────
    const effectiveStep = step || (title ? 'error' : 'connecting');
    const effectiveActions =
        actions ||
        (onCancel && onConfirm
            ? { cancelLabel: cancelText, confirmLabel: confirmText, onCancel, onConfirm }
            : undefined);

    const colors = getBannerColors(effectiveStep);
    const label =
        effectiveStep === 'error'
            ? error || 'Erro na sincronização'
            : statusText || title || 'Sincronizando...';
    const shouldCenterActions = Boolean(centerActions && effectiveActions);
    const hasActions = Boolean(effectiveActions);

    useEffect(() => {
        measuredLabelRef.current = null;
        setMeasuredTextWidth(null);
    }, [label]);
    const measuredWidthForLabel =
        measuredLabelRef.current === label ? measuredTextWidth : null;

    const isSyncing = effectiveStep !== 'success' && effectiveStep !== 'error';

    const shape = resolveShape({
        hasActions,
        centerActions: shouldCenterActions,
        labelLength: label.length,
        measuredTextWidth: measuredWidthForLabel,
        isSyncing,
    });

    const handleTextLayout = (event: TextLayoutEvent) => {
        if (hasActions || shouldCenterActions || label.length > 28) return;

        const isWrapped = event.nativeEvent.lines.length > 1;

        if (isWrapped) {
            // Se o texto quebrou em mais de uma linha, significa que a estimativa ou largura atual é muito pequena.
            // Expandimos para o tamanho máximo para dar espaço, evitando o loop de encolhimento.
            if (measuredTextWidth !== BANNER_MAX_WIDTH) {
                measuredLabelRef.current = label;
                setMeasuredTextWidth(BANNER_MAX_WIDTH);
            }
            return;
        }

        const widestLine = event.nativeEvent.lines[0].width || 0;
        const nextWidth = Math.ceil(widestLine);
        if (nextWidth <= 0) return;

        if (
            measuredLabelRef.current !== label ||
            measuredTextWidth === null ||
            Math.abs(nextWidth - measuredTextWidth) > 1
        ) {
            measuredLabelRef.current = label;
            setMeasuredTextWidth(nextWidth);
        }
    };

    // ── Shared values ───────────────────────────────────────────────────────
    const visibility = useSharedValue(0);          // 0..1 — overall enter/exit
    const squash = useSharedValue(1);              // multiplier for stretch&recoil
    const contentReveal = useSharedValue(0);       // 0..1 — content cross-fade
    const pulse = useSharedValue(0);               // ambient breathing
    const targetWidth = useSharedValue(shape.width);
    const targetHeight = useSharedValue(shape.height);
    const targetRadius = useSharedValue(shape.radius);

    // ── Derived: animate dimensions toward target with spring ──────────────
    // Using useDerivedValue makes the spring "follow" target changes
    // automatically, which is the core of Dynamic Island morphing.
    const animatedWidth = useDerivedValue(() =>
        withSpring(targetWidth.value, SPRING_MORPH)
    );
    const animatedHeight = useDerivedValue(() =>
        withSpring(targetHeight.value, SPRING_MORPH)
    );
    const animatedRadius = useDerivedValue(() =>
        withSpring(targetRadius.value, SPRING_MORPH)
    );

    // ── Track shape changes & fire content cross-fade + morph pulse ─────────
    const prevShapeKey = useRef<string>(`${shape.width}-${shape.height}`);
    const prevStepRef = useRef<string>(effectiveStep);

    useEffect(() => {
        targetWidth.value = shape.width;
        targetHeight.value = shape.height;
        targetRadius.value = shape.radius;

        const shapeKey = `${shape.width}-${shape.height}`;
        const shapeChanged = prevShapeKey.current !== shapeKey;
        const stepChanged = prevStepRef.current !== effectiveStep;

        // Cross-fade content on any meaningful change (not on first paint)
        if (show && (shapeChanged || stepChanged)) {
            contentReveal.value = withSequence(
                withTiming(0, { duration: 110, easing: Easing.out(Easing.quad) }),
                withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) })
            );

            // Subtle morph pulse — squashes laterally then settles only if the shape dimensions changed
            if (shapeChanged) {
                squash.value = withSequence(
                    withSpring(1.045, SPRING_STRETCH),
                    withSpring(0.982, SPRING_RECOIL),
                    withSpring(1, SPRING_SETTLE)
                );
            }
        }

        prevShapeKey.current = shapeKey;
        prevStepRef.current = effectiveStep;
    }, [
        shape.width,
        shape.height,
        shape.radius,
        effectiveStep,
        show,
        contentReveal,
        squash,
        targetWidth,
        targetHeight,
        targetRadius,
    ]);

    // ── Enter / exit ────────────────────────────────────────────────────────
    useEffect(() => {
        const reduced = reducedMotionRef.current;

        if (show) {
            // Squash & stretch entry: starts compressed, expands with overshoot,
            // recoils, then settles. This is the signature DI feel.
            squash.value = 0.84;

            visibility.value = reduced
                ? withTiming(1, { duration: 120 })
                : withSpring(1, SPRING_ENTRY);

            if (!reduced) {
                squash.value = withSequence(
                    withSpring(1.085, SPRING_STRETCH),
                    withSpring(0.976, SPRING_RECOIL),
                    withSpring(1, SPRING_SETTLE)
                );
            } else {
                squash.value = withTiming(1, { duration: 120 });
            }

            contentReveal.value = withDelay(
                reduced ? 0 : 120,
                withTiming(1, {
                    duration: reduced ? 80 : 240,
                    easing: Easing.out(Easing.cubic),
                })
            );
        } else {
            contentReveal.value = withTiming(0, {
                duration: 90,
                easing: Easing.out(Easing.quad),
            });
            squash.value = withTiming(0.84, {
                duration: 180,
                easing: Easing.inOut(Easing.cubic),
            });
            visibility.value = withTiming(0, {
                duration: 190,
                easing: Easing.inOut(Easing.cubic),
            });
        }
    }, [show, visibility, squash, contentReveal]);

    // ── Ambient breathing pulse (right glow only) ───────────────────────────
    useEffect(() => {
        if (!show || reducedMotionRef.current) {
            pulse.value = 0;
            return;
        }
        pulse.value = withRepeat(
            withSequence(
                withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            false
        );
    }, [show, pulse]);

    /* ─────────────────────────────────────────────────────────────────────
     * Animated styles
     * ───────────────────────────────────────────────────────────────────── */

    // Container: position + entry translate + opacity
    const containerStyle = useAnimatedStyle(() => {
        const translateY = interpolate(
            visibility.value,
            [0, 0.5, 0.82, 1],
            [22, -4, 1.2, 0],
            Extrapolation.CLAMP
        );
        return {
            opacity: interpolate(
                visibility.value,
                [0, 0.22, 1],
                [0, 0.86, 1],
                Extrapolation.CLAMP
            ),
            transform: [{ translateY }],
            bottom: BANNER_BOTTOM_OFFSET + Math.max(insets.bottom, 0),
        };
    });

    // Banner shell: REAL width/height/borderRadius morph + squash & stretch overlay
    const bannerStyle = useAnimatedStyle(() => {
        // Squash & stretch: when squash > 1, banner stretches horizontally
        // and compresses vertically (like a soft body absorbing energy).
        const stretchX = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [0.92, 0.99, 1, 1.04],
            Extrapolation.CLAMP
        );
        const stretchY = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [1.08, 1.018, 1, 0.976],
            Extrapolation.CLAMP
        );

        const baseScaleX = interpolate(
            visibility.value,
            [0, 0.34, 0.68, 1],
            [0.18, 1.028, 0.992, 1],
            Extrapolation.CLAMP
        );
        const baseScaleY = interpolate(
            visibility.value,
            [0, 0.42, 0.78, 1],
            [0.18, 0.94, 1.012, 1],
            Extrapolation.CLAMP
        );

        return {
            width: animatedWidth.value,
            height: animatedHeight.value,
            borderTopLeftRadius: animatedRadius.value,
            borderTopRightRadius: animatedRadius.value,
            transform: [
                { scaleX: baseScaleX * stretchX },
                { scaleY: baseScaleY * stretchY },
            ],
        };
    });

    // Content: cross-fade + counter-stretch (so text doesn't squash with the shell)
    const contentStyle = useAnimatedStyle(() => {
        const counterX = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [1.09, 1.012, 1, 0.962],
            Extrapolation.CLAMP
        );
        const counterY = interpolate(
            squash.value,
            [0.84, 0.976, 1, 1.085],
            [0.93, 0.984, 1, 1.024],
            Extrapolation.CLAMP
        );
        return {
            opacity: contentReveal.value,
            transform: [
                {
                    translateY: interpolate(
                        contentReveal.value,
                        [0, 1],
                        [4, 0],
                        Extrapolation.CLAMP
                    ),
                },
                { scaleX: counterX },
                { scaleY: counterY },
            ],
        };
    });

    const rightGlowStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulse.value, [0, 1], [0.22, 0.48], Extrapolation.CLAMP),
        transform: [
            {
                translateX: interpolate(
                    pulse.value,
                    [0, 1],
                    [0, -7],
                    Extrapolation.CLAMP
                ),
            },
            {
                scale: interpolate(
                    pulse.value,
                    [0, 1],
                    [0.96, 1.09],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    const baseBlurStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulse.value, [0, 1], [0.92, 1], Extrapolation.CLAMP),
    }));

    /* ─────────────────────────────────────────────────────────────────────
     * Render
     * ───────────────────────────────────────────────────────────────────── */

    return (
        <Animated.View
            pointerEvents={show ? 'auto' : 'none'}
            style={[styles.container, containerStyle]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
        >
            <Animated.View style={[styles.banner, bannerStyle]}>
                {/* Layer 1 — base blur */}
                <Animated.View pointerEvents="none" style={[styles.baseBlurLayer, baseBlurStyle]}>
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                </Animated.View>

                {/* Layer 2 — base tint gradient */}
                <View pointerEvents="none" style={styles.baseTint}>
                    <LinearGradient
                        colors={[
                            'rgba(255,255,255,0.018)',
                            'rgba(20,20,20,0.06)',
                            'rgba(0,0,0,0.10)',
                        ]}
                        locations={[0, 0.45, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                </View>

                {/* Layer 3 — right-side colored glow (pulses) */}
                <Animated.View pointerEvents="none" style={[styles.rightBlurMask, rightGlowStyle]}>
                    <BlurView
                        intensity={34}
                        tint="dark"
                        style={[StyleSheet.absoluteFillObject, styles.rightBlurView]}
                    />
                    <LinearGradient
                        colors={[
                            'rgba(20,20,20,0)',
                            colors.rightBlurSoft,
                            colors.rightBlur,
                            colors.rightBlurSoft,
                            'rgba(20,20,20,0)',
                        ]}
                        locations={[0, 0.24, 0.55, 0.8, 1]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                </Animated.View>

                {/* Layer 4 — top edge highlight */}
                <View pointerEvents="none" style={styles.edgeLight}>
                    <LinearGradient
                        colors={[
                            colors.edgeLight,
                            'rgba(255,255,255,0)',
                            'rgba(0,0,0,0.08)',
                        ]}
                        locations={[0, 0.42, 1]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                    />
                </View>

                {/* Layer 5 — content (cross-fades on step change) */}
                <Animated.View
                    style={[
                        styles.content,
                        hasActions && !shouldCenterActions && styles.contentWithActions,
                        shouldCenterActions && styles.centeredActionsContent,
                        contentStyle,
                    ]}
                >
                    {!shouldCenterActions && (
                        <View
                            style={[
                                styles.textBlock,
                                hasActions && styles.textBlockWithActions,
                            ]}
                        >
                            <Text
                                style={[styles.text, { color: colors.text }]}
                                numberOfLines={2}
                                onTextLayout={handleTextLayout}
                            >
                                {label}
                            </Text>
                        </View>
                    )}

                    {effectiveActions && (
                        <View
                            style={[
                                styles.actionsRow,
                                shouldCenterActions && styles.centeredActionsRow,
                            ]}
                        >
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={effectiveActions.onCancel}
                                disabled={effectiveActions.disabled}
                                activeOpacity={0.75}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={effectiveActions.cancelLabel || 'Não'}
                            >
                                <Text style={styles.cancelButtonText}>
                                    {effectiveActions.cancelLabel || 'Não'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.confirmButton,
                                    effectiveActions.disabled && styles.actionButtonDisabled,
                                ]}
                                onPress={effectiveActions.onConfirm}
                                disabled={effectiveActions.disabled}
                                activeOpacity={0.8}
                                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                accessibilityRole="button"
                                accessibilityLabel={effectiveActions.confirmLabel || 'Sim'}
                            >
                                <Text style={styles.confirmButtonText}>
                                    {effectiveActions.confirmLabel || 'Sim'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Styles
 *
 * Note: width/height/borderTopRadius are now driven by Reanimated and applied
 * via animated style — the static styles only set defaults and visuals that
 * don't morph (background, border bottom, shadow).
 * ──────────────────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        alignSelf: 'center',
        zIndex: 1000,
        elevation: 40,
    },

    banner: {
        alignSelf: 'center',
        overflow: 'hidden',
        backgroundColor: 'rgba(20,20,20,0.08)',

        // bottom is flat — banner sits on top of the floating tab bar
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,

        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: '#2B2B2B',

        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 40,
    },

    baseBlurLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 0,
        overflow: 'hidden',
    },

    baseTint: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
        opacity: 0.9,
    },

    rightBlurMask: {
        position: 'absolute',
        top: -28,
        right: -44,
        width: 150,
        height: 108,
        overflow: 'hidden',
        borderRadius: 999,
        zIndex: 3,
    },

    rightBlurView: {
        borderRadius: 999,
        opacity: 0.48,
        overflow: 'hidden',
    },

    edgeLight: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 4,
        opacity: 0.78,
    },

    content: {
        ...StyleSheet.absoluteFillObject,
        paddingHorizontal: BANNER_HORIZONTAL_PADDING,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        backgroundColor: 'transparent',
        zIndex: 5,
    },

    contentWithActions: {
        justifyContent: 'space-between',
        gap: 8,
    },

    centeredActionsContent: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 0,
    },

    textBlock: {
        flexShrink: 1,
        minWidth: 0,
    },

    textBlockWithActions: {
        flex: 1,
    },

    text: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0,
        flexShrink: 1,
    },

    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },

    centeredActionsRow: {
        alignSelf: 'center',
        justifyContent: 'center',
    },

    cancelButton: {
        paddingHorizontal: 8,
        height: 34,
        borderRadius: 999,
        justifyContent: 'center',
        alignItems: 'center',
    },

    cancelButtonText: {
        color: '#A0A0A0',
        fontSize: 12,
        fontWeight: '600',
    },

    confirmButton: {
        paddingHorizontal: 10,
        height: 34,
        minWidth: 64,
        borderRadius: 999,
        backgroundColor: '#D97757',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },

    actionButtonDisabled: {
        opacity: 0.55,
    },
});
