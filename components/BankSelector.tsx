import { CreditCardAccount } from '@/services/invoiceBuilder';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    AccessibilityInfo,
    StyleProp,
    StyleSheet,
    Text,
    TouchableOpacity,
    ViewStyle,
} from 'react-native';
import Animated, {
    Extrapolation,
    FadeIn,
    FadeOut,
    interpolate,
    LinearTransition,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

interface BankSelectorProps {
    currentCardId: string | null;
    cards: CreditCardAccount[];
    onSelectCard: (cardId: string | null) => void;
    style?: StyleProp<ViewStyle>;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const SELECTOR_HEIGHT = 34;
const SELECTOR_RADIUS = 24;

const MIN_SELECTOR_WIDTH = 126;
const MAX_SELECTOR_WIDTH = 178;

const NAV_BUTTON_SIZE = 23;

const SPRING_ENTRY = {
    damping: 16,
    stiffness: 195,
    mass: 1.05,
    overshootClamping: false,
    restDisplacementThreshold: 0.001,
    restSpeedThreshold: 0.001,
} as const;

const SPRING_MORPH = {
    damping: 15,
    stiffness: 185,
    mass: 1.08,
    overshootClamping: false,
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

const PRESS_SPRING = {
    damping: 16,
    stiffness: 360,
    mass: 0.5,
    overshootClamping: false,
} as const;

const LABEL_SPRING = {
    damping: 18,
    stiffness: 260,
    mass: 0.7,
    overshootClamping: false,
} as const;

function clamp(value: number, min: number, max: number) {
    'worklet';
    return Math.min(Math.max(value, min), max);
}

function resolveSelectorWidth(label: string) {
    const estimatedTextWidth = label.length * 7.2;
    const buttonsAndPadding = 68;

    return clamp(
        estimatedTextWidth + buttonsAndPadding,
        MIN_SELECTOR_WIDTH,
        MAX_SELECTOR_WIDTH
    );
}

export default function BankSelector({
    currentCardId,
    cards,
    onSelectCard,
    style,
}: BankSelectorProps) {
    const reducedMotionRef = useRef(false);

    const currentIndex = useMemo(() => {
        if (!currentCardId) return -1;
        return cards.findIndex((card) => card.id === currentCardId);
    }, [currentCardId, cards]);

    const displayName = useMemo(() => {
        if (currentIndex === -1 || !currentCardId) return 'Todas as Faturas';

        const card = cards[currentIndex];
        const name = card?.name || 'Cartão';

        if (name.length > 14) {
            return `${name.substring(0, 14)}...`;
        }

        return name;
    }, [currentIndex, currentCardId, cards]);

    const visibility = useSharedValue(0);
    const squash = useSharedValue(1);
    const contentReveal = useSharedValue(1);

    const targetWidth = useSharedValue(resolveSelectorWidth(displayName));
    const targetHeight = useSharedValue(SELECTOR_HEIGHT);
    const targetRadius = useSharedValue(SELECTOR_RADIUS);

    const leftPress = useSharedValue(0);
    const rightPress = useSharedValue(0);

    const animatedWidth = useDerivedValue(() =>
        withSpring(targetWidth.value, SPRING_MORPH)
    );

    const animatedHeight = useDerivedValue(() =>
        withSpring(targetHeight.value, SPRING_MORPH)
    );

    const animatedRadius = useDerivedValue(() =>
        withSpring(targetRadius.value, SPRING_MORPH)
    );

    useEffect(() => {
        let mounted = true;

        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (mounted) reducedMotionRef.current = enabled;
        });

        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
            reducedMotionRef.current = enabled;
        });

        return () => {
            mounted = false;
            sub.remove();
        };
    }, []);

    useEffect(() => {
        const reduced = reducedMotionRef.current;

        squash.value = 0.84;

        visibility.value = reduced
            ? withTiming(1, { duration: 120 })
            : withSpring(1, SPRING_ENTRY);

        squash.value = reduced
            ? withTiming(1, { duration: 120 })
            : withSequence(
                withSpring(1.085, SPRING_STRETCH),
                withSpring(0.976, SPRING_RECOIL),
                withSpring(1, SPRING_SETTLE)
            );
    }, [visibility, squash]);

    useEffect(() => {
        const reduced = reducedMotionRef.current;

        targetWidth.value = resolveSelectorWidth(displayName);
        targetHeight.value = SELECTOR_HEIGHT;
        targetRadius.value = SELECTOR_RADIUS;

        contentReveal.value = 0;

        contentReveal.value = withDelay(
            reduced ? 0 : 80,
            withSpring(1, LABEL_SPRING)
        );

        if (!reduced) {
            squash.value = withSequence(
                withSpring(1.075, SPRING_STRETCH),
                withSpring(0.978, SPRING_RECOIL),
                withSpring(1, SPRING_SETTLE)
            );
        } else {
            squash.value = withTiming(1, { duration: 120 });
        }
    }, [
        displayName,
        targetWidth,
        targetHeight,
        targetRadius,
        contentReveal,
        squash,
    ]);

    const handlePrevious = useCallback(() => {
        if (currentIndex <= -1) {
            if (cards.length > 0) {
                onSelectCard(cards[cards.length - 1].id);
            }
        } else if (currentIndex === 0) {
            onSelectCard(null);
        } else {
            onSelectCard(cards[currentIndex - 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const handleNext = useCallback(() => {
        if (currentIndex === -1) {
            if (cards.length > 0) {
                onSelectCard(cards[0].id);
            }
        } else if (currentIndex === cards.length - 1) {
            onSelectCard(null);
        } else {
            onSelectCard(cards[currentIndex + 1].id);
        }
    }, [currentIndex, cards, onSelectCard]);

    const containerAnimatedStyle = useAnimatedStyle(() => {
        const pressAmount = Math.max(leftPress.value, rightPress.value);

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

        const pressScaleX = interpolate(
            pressAmount,
            [0, 1],
            [1, 0.986],
            Extrapolation.CLAMP
        );

        const pressScaleY = interpolate(
            pressAmount,
            [0, 1],
            [1, 1.035],
            Extrapolation.CLAMP
        );

        const translateY = interpolate(
            visibility.value,
            [0, 0.5, 0.82, 1],
            [14, -3, 1, 0],
            Extrapolation.CLAMP
        );

        return {
            width: animatedWidth.value,
            height: animatedHeight.value,
            borderRadius: animatedRadius.value,
            opacity: interpolate(
                visibility.value,
                [0, 0.22, 1],
                [0, 0.86, 1],
                Extrapolation.CLAMP
            ),
            transform: [
                { translateY },
                { scaleX: baseScaleX * stretchX * pressScaleX },
                { scaleY: baseScaleY * stretchY * pressScaleY },
            ],
        };
    });

    const contentCounterStyle = useAnimatedStyle(() => {
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
            transform: [{ scaleX: counterX }, { scaleY: counterY }],
        };
    });

    const labelAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            contentReveal.value,
            [0, 0.45, 1],
            [0, 0.35, 1],
            Extrapolation.CLAMP
        ),
        transform: [
            {
                translateY: interpolate(
                    contentReveal.value,
                    [0, 1],
                    [4, 0],
                    Extrapolation.CLAMP
                ),
            },
            {
                scale: interpolate(
                    contentReveal.value,
                    [0, 1],
                    [0.965, 1],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    const leftButtonAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(leftPress.value, [0, 1], [0.72, 1], Extrapolation.CLAMP),
        transform: [
            {
                translateX: interpolate(
                    leftPress.value,
                    [0, 1],
                    [0, -1.4],
                    Extrapolation.CLAMP
                ),
            },
            {
                scale: interpolate(
                    leftPress.value,
                    [0, 1],
                    [1, 0.88],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    const rightButtonAnimatedStyle = useAnimatedStyle(() => ({
        opacity: interpolate(rightPress.value, [0, 1], [0.72, 1], Extrapolation.CLAMP),
        transform: [
            {
                translateX: interpolate(
                    rightPress.value,
                    [0, 1],
                    [0, 1.4],
                    Extrapolation.CLAMP
                ),
            },
            {
                scale: interpolate(
                    rightPress.value,
                    [0, 1],
                    [1, 0.88],
                    Extrapolation.CLAMP
                ),
            },
        ],
    }));

    return (
        <Animated.View
            style={[styles.container, style, containerAnimatedStyle]}
            layout={LinearTransition.springify()
            .damping(15)
            .stiffness(185)
            .mass(1.08)}
        >
            <Animated.View style={[styles.content, contentCounterStyle]}>
                <AnimatedTouchableOpacity
                    onPress={handlePrevious}
                    onPressIn={() => {
                        leftPress.value = withSpring(1, PRESS_SPRING);
                    }}
                    onPressOut={() => {
                        leftPress.value = withSpring(0, PRESS_SPRING);
                    }}
                    onTouchCancel={() => {
                        leftPress.value = withSpring(0, PRESS_SPRING);
                    }}
                    style={[styles.navButton, leftButtonAnimatedStyle]}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ChevronLeft size={16} color="#FFFFFF" strokeWidth={2.4} />
                </AnimatedTouchableOpacity>

                <Animated.View
                    key={displayName}
                    entering={FadeIn.duration(140).springify().damping(18).stiffness(240)}
                    exiting={FadeOut.duration(80)}
                    style={[styles.labelWrapper, labelAnimatedStyle]}
                    layout={LinearTransition.springify()
                        .damping(15)
                        .stiffness(185)
                        .mass(1.08)}
                >
                    <Text style={styles.label} numberOfLines={1}>
                        {displayName}
                    </Text>
                </Animated.View>

                <AnimatedTouchableOpacity
                    onPress={handleNext}
                    onPressIn={() => {
                        rightPress.value = withSpring(1, PRESS_SPRING);
                    }}
                    onPressOut={() => {
                        rightPress.value = withSpring(0, PRESS_SPRING);
                    }}
                    onTouchCancel={() => {
                        rightPress.value = withSpring(0, PRESS_SPRING);
                    }}
                    style={[styles.navButton, rightButtonAnimatedStyle]}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.4} />
                </AnimatedTouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',

        alignSelf: 'flex-start',
        overflow: 'hidden',

        backgroundColor: '#101010',
        borderColor: '#252525',
        borderWidth: 1,

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
    },

    content: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        gap: 4,
        zIndex: 5,
    },

    navButton: {
        width: NAV_BUTTON_SIZE,
        height: NAV_BUTTON_SIZE,
        borderRadius: NAV_BUTTON_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 6,
    },

    labelWrapper: {
        flex: 1,
        minWidth: 40,
        marginHorizontal: 2,
        zIndex: 6,
    },

    label: {
        color: '#D97757',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0,
        textAlign: 'center',
    },
});
