import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UniversalBackgroundProps {
    backgroundColor?: string;
    circleColor?: string;
    glowSize?: number;
    showGlow?: boolean;
    showParticles?: boolean;
    particleCount?: number;
    animateGlowOnMount?: boolean;
    glowIntroDurationMs?: number;
    height?: number;
    children?: React.ReactNode;
}

export const UniversalBackground = React.memo(function UniversalBackground({
    backgroundColor = '#0C0C0C',
    circleColor = '#D97757',
    glowSize = 500,
    showGlow = true,
    animateGlowOnMount = false,
    glowIntroDurationMs = 850,
    height,
    children,
}: UniversalBackgroundProps) {

    const glowProgress = useRef(
        new Animated.Value(animateGlowOnMount ? 0 : 1)
    ).current;

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

    return (
        <View style={containerStyle}>
            {showGlow && glowSize > 0 && (
                <Animated.View
                    style={[styles.glowContainer, glowContainerStyle, glowAnimatedStyle]}
                    pointerEvents="none"
                    renderToHardwareTextureAndroid
                    shouldRasterizeIOS
                >
                    <Svg width={svgSize} height={svgSize}>
                        <Defs>
                            <RadialGradient
                                id="universal-glow"
                                cx="50%"
                                cy="50%"
                                rx="50%"
                                ry="50%"
                            >
                                <Stop offset="0%" stopColor={circleColor} stopOpacity="0.9" />
                                <Stop offset="25%" stopColor={circleColor} stopOpacity="0.6" />
                                <Stop offset="50%" stopColor={circleColor} stopOpacity="0.35" />
                                <Stop offset="75%" stopColor={circleColor} stopOpacity="0.1" />
                                <Stop offset="100%" stopColor={circleColor} stopOpacity="0" />
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
    contentContainer: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default UniversalBackground;
