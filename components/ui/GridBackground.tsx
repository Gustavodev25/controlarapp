import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const GRID_SIZE = 40;

// OPTIMIZED: Using native Animated API instead of Reanimated for simple fades
const FadingSquare = React.memo(({ x, y, delay }: { x: number; y: number; delay: number }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.15,
                    duration: 2000,
                    delay,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 2000,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={[
                styles.fadingSquare,
                {
                    left: x,
                    top: y,
                    opacity,
                }
            ]}
        />
    );
});

// Static SVG background (Base + Grid)
const StaticSvgBackground = React.memo(({ position }: { position: 'center' | 'top' }) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%">
            <Defs>
                <RadialGradient
                    id="grad"
                    cx="50%"
                    cy={position === 'top' ? '0%' : '50%'}
                    rx="40%"
                    ry={position === 'top' ? '60%' : '25%'}
                    fx="50%"
                    fy={position === 'top' ? '0%' : '50%'}
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop offset="0" stopColor="#37190F" stopOpacity="1" />
                    <Stop offset="1" stopColor="#1D100B" stopOpacity="1" />
                </RadialGradient>
                <Pattern
                    id="grid"
                    x="0"
                    y="0"
                    width={GRID_SIZE}
                    height={GRID_SIZE}
                    patternUnits="userSpaceOnUse"
                >
                    <Rect
                        x="0"
                        y="0"
                        width={GRID_SIZE}
                        height={GRID_SIZE}
                        fill="none"
                        stroke="rgba(255,255,255,0.06)"
                        strokeWidth="1"
                    />
                </Pattern>
            </Defs>

            {/* Background Fill */}
            <Rect x="0" y="0" width="100%" height="100%" fill="#1D100B" />

            {/* Radial Glow */}
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />

            {/* Grid Pattern */}
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grid)" />
        </Svg>
    </View>
));

// Vignette Overlay - Darkens edges
const VignetteOverlay = React.memo(({ position }: { position: 'center' | 'top' }) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%">
            <Defs>
                <RadialGradient
                    id="vignette"
                    cx="50%"
                    cy="50%"
                    rx="55%"
                    ry="35%"
                    fx="50%"
                    fy="50%"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop offset="0.2" stopColor="#1D100B" stopOpacity="0" />
                    <Stop offset="1" stopColor="#1D100B" stopOpacity="1" />
                </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
        </Svg>
    </View>
));

// Animated squares layer - separate from SVG for better performance
const AnimatedSquaresLayer = React.memo(() => {
    // OPTIMIZED: Only 20 random squares
    const squares = useMemo(() => {
        const numSquares = 20;
        return Array.from({ length: numSquares }).map((_, i) => ({
            id: i,
            x: Math.floor(Math.random() * (width / GRID_SIZE)) * GRID_SIZE,
            y: Math.floor(Math.random() * (height / GRID_SIZE)) * GRID_SIZE,
            delay: Math.random() * 4000,
        }));
    }, []);

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {squares.map((sq) => (
                <FadingSquare key={sq.id} x={sq.x} y={sq.y} delay={sq.delay} />
            ))}
        </View>
    );
});



export const GridBackground = React.memo(({ children, style, position = 'center', topHeight, bottomColor }: { children: React.ReactNode; style?: ViewStyle; position?: 'center' | 'top'; topHeight?: number; bottomColor?: string }) => {
    const backgroundContainerStyle = useMemo(() => {
        if (topHeight) {
            return {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                right: 0,
                height: topHeight,
                overflow: 'hidden' as const // Ensure content doesn't spill if it somehow does
            };
        }
        return StyleSheet.absoluteFillObject;
    }, [topHeight]);

    return (
        <View style={[styles.container, style]}>
            <View style={backgroundContainerStyle} pointerEvents="none">
                <StaticSvgBackground position={position} />
                <AnimatedSquaresLayer />
                <VignetteOverlay position={position} />
                {topHeight && bottomColor && (
                    <LinearGradient
                        colors={[
                            'transparent',
                            `${bottomColor}10`,
                            `${bottomColor}30`,
                            `${bottomColor}60`,
                            `${bottomColor}90`,
                            `${bottomColor}CC`,
                            bottomColor
                        ]}
                        locations={[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1]}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: topHeight * 0.6, // 60% da altura para uma transição bem gradual
                        }}
                    />
                )}
            </View>
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1D100B',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    fadingSquare: {
        position: 'absolute',
        width: GRID_SIZE - 1,
        height: GRID_SIZE - 1,
        backgroundColor: '#d97757',
    },
});
