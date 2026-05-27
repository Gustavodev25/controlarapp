import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORANGE_GLOW_COLOR = '#D97757';
const IS_DEV_RUNTIME = typeof __DEV__ !== 'undefined' && __DEV__;
const SHOULD_PULSE_GLOW_BY_DEFAULT =
    process.env.EXPO_PUBLIC_ENABLE_GLOW_PULSE === '1' ||
    (IS_DEV_RUNTIME && process.env.EXPO_PUBLIC_DEV_GLOW_PULSE === '1');

interface UniversalBackgroundProps {
    backgroundColor?: string;
    glowSize?: number;
    showGlow?: boolean;
    showParticles?: boolean;
    particleCount?: number;
    animateGlowOnMount?: boolean;
    glowIntroDurationMs?: number;
    enableGlowPulse?: boolean;
    glowPulseDelayMs?: number;
    height?: number;
    children?: React.ReactNode;
}

export const UniversalBackground = React.memo(function UniversalBackground({
    backgroundColor = '#0C0C0C',
    glowSize = 500,
    showGlow = true,
    animateGlowOnMount = false,
    glowIntroDurationMs = 850,
    enableGlowPulse = SHOULD_PULSE_GLOW_BY_DEFAULT,
    glowPulseDelayMs = 6200,
    height,
    children,
}: UniversalBackgroundProps) {

    const glowProgress = useRef(
        new Animated.Value(animateGlowOnMount ? 0 : 1)
    ).current;
    const glowPulseProgress = useRef(new Animated.Value(0)).current;

    const isFixedHeight = height !== undefined;
    const svgSize = glowSize * 2;

    const containerStyle = useMemo(
        () => [
            styles.container,
            { backgroundColor },
            isFixedHeight && { height, flex: undefined },
        ],
        [backgroundColor, isFixedHeight, height]
    );

    const glowContainerStyle = useMemo(
        () => ({
            top: -svgSize / 2,
            left: (SCREEN_WIDTH - svgSize) / 2,
            width: svgSize,
            height: svgSize,
        }),
        [svgSize]
    );

    useEffect(() => {
        if (!showGlow) return;

        if (!animateGlowOnMount) {
            glowProgress.setValue(1);
            return;
        }

        glowProgress.setValue(0);

        const animation = Animated.timing(glowProgress, {
            toValue: 1,
            duration: Math.max(200, glowIntroDurationMs),
            useNativeDriver: true,
            isInteraction: false,
        });

        animation.start();

        return () => animation.stop();
    }, [showGlow, animateGlowOnMount, glowIntroDurationMs, glowProgress]);

    useEffect(() => {
        if (!showGlow || glowSize <= 0 || !enableGlowPulse) {
            glowPulseProgress.setValue(0);
            return;
        }

        glowPulseProgress.setValue(0);

        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(Math.max(2500, glowPulseDelayMs)),
                Animated.timing(glowPulseProgress, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(glowPulseProgress, {
                    toValue: 0,
                    duration: 1900,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.delay(2400),
            ])
        );

        animation.start();

        return () => animation.stop();
    }, [showGlow, glowSize, enableGlowPulse, glowPulseDelayMs, glowPulseProgress]);

    const glowAnimatedStyle = {
        opacity: glowProgress,
        transform: [
            {
                scale: glowProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                }),
            },
        ],
    };

    const glowPulseAnimatedStyle = {
        transform: [
            {
                scale: glowPulseProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.025],
                }),
            },
        ],
    };

    return (
        <View style={containerStyle}>
            {showGlow && glowSize > 0 && (
                <Animated.View
                    style={[styles.glowContainer, glowContainerStyle, glowAnimatedStyle]}
                    pointerEvents="none"
                    renderToHardwareTextureAndroid
                    shouldRasterizeIOS
                >
                    <Animated.View style={[styles.glowPulseLayer, glowPulseAnimatedStyle]}>
                        <Svg width={svgSize} height={svgSize}>
                            <Defs>
                                <RadialGradient
                                    id="universal-glow"
                                    cx="50%"
                                    cy="50%"
                                    rx="50%"
                                    ry="50%"
                                >
                                    <Stop offset="0%" stopColor={ORANGE_GLOW_COLOR} stopOpacity="0.9" />
                                    <Stop offset="25%" stopColor={ORANGE_GLOW_COLOR} stopOpacity="0.6" />
                                    <Stop offset="50%" stopColor={ORANGE_GLOW_COLOR} stopOpacity="0.35" />
                                    <Stop offset="75%" stopColor={ORANGE_GLOW_COLOR} stopOpacity="0.1" />
                                    <Stop offset="100%" stopColor={ORANGE_GLOW_COLOR} stopOpacity="0" />
                                </RadialGradient>
                            </Defs>

                            <Circle
                                cx={svgSize / 2}
                                cy={svgSize / 2}
                                r={glowSize}
                                fill="url(#universal-glow)"
                            />
                        </Svg>
                    </Animated.View>
                </Animated.View>
            )}

            <View style={styles.contentContainer}>{children}</View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    glowContainer: {
        position: 'absolute',
    },
    glowPulseLayer: {
        flex: 1,
    },
    contentContainer: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default UniversalBackground;
