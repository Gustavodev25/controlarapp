import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const PARTICLE_CAP_BY_LOD: Record<0 | 1 | 2 | 3, number> = {
    0: 14,
    1: 10,
    2: 6,
    3: 0,
};

// OPTIMIZED: Particle with React.memo and simplified animation
const Particle = React.memo(function Particle({ x, startY, duration, delay, scale, opacity, driftX }: {
    x: number; 
    startY: number; 
    duration: number; 
    delay: number; 
    scale: number; 
    opacity: number;
    driftX: number;
}) {
    const translateY = useRef(new Animated.Value(startY)).current;
    const initialAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
    const loopAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(() => {
        const initialDistance = Math.max(1, height + 10 - startY);
        const initialDuration = Math.max(1200, Math.round((initialDistance / (height + 20)) * duration));

        translateY.setValue(startY);
        initialAnimationRef.current = Animated.sequence([
            Animated.delay(Math.max(0, delay)),
            Animated.timing(translateY, {
                toValue: height + 10,
                duration: initialDuration,
                easing: Easing.linear,
                useNativeDriver: true,
                isInteraction: false,
            }),
        ]);

        loopAnimationRef.current = Animated.loop(
            Animated.sequence([
                Animated.timing(translateY, {
                    toValue: -10,
                    duration: 0,
                    useNativeDriver: true,
                    isInteraction: false,
                }),
                Animated.timing(translateY, {
                    toValue: height + 10,
                    duration,
                    easing: Easing.linear,
                    useNativeDriver: true,
                    isInteraction: false,
                }),
            ]),
            { resetBeforeIteration: false }
        );

        initialAnimationRef.current.start(({ finished }) => {
            if (!finished) return;
            loopAnimationRef.current?.start();
        });

        return () => {
            initialAnimationRef.current?.stop();
            loopAnimationRef.current?.stop();
        };
    }, [duration, delay, startY, translateY]);

    const translateX = useMemo(
        () =>
            translateY.interpolate({
                inputRange: [-10, (height + 10) / 2, height + 10],
                outputRange: [0, driftX, 0],
            }),
        [driftX, translateY]
    );

    return (
        <Animated.View
            style={[
                styles.particle,
                {
                    left: x,
                    transform: [{ translateY }, { translateX }, { scale }],
                    opacity,
                }
            ]}
            pointerEvents="none"
        />
    );
});

// OPTIMIZED: Dust layer with performance-based particle count
const DustLayer = React.memo(function DustLayer() {
    const { lod, budget } = usePerformanceBudget();

    const particles = useMemo(() => {
        const lodCap = PARTICLE_CAP_BY_LOD[lod];
        const totalCount = Math.max(0, Math.min(budget.particleCount, lodCap));
        if (totalCount <= 0) return [];

        const fgCount = Math.max(2, Math.round(totalCount * 0.35));
        const bgCount = Math.max(0, totalCount - fgCount);
        
        // Foreground particles
        const foreground = Array.from({ length: fgCount }).map((_, i) => ({
            id: `fg-${i}`,
            x: ((i * 37 + 13) % 100) / 100 * width,
            startY: ((i * 23 + 7) % 100) / 100 * height,
            duration: 12000 + (i * 400) + ((i * 7) % 5) * 1000,
            delay: (i * 300) % 5000,
            scale: 0.8 + ((i % 3) * 0.2),
            opacity: 0.68,
            driftX: ((i % 5) - 2) * 1.8,
        }));

        // Background particles
        const background = Array.from({ length: bgCount }).map((_, i) => ({
            id: `bg-${i}`,
            x: ((i * 41 + 19) % 100) / 100 * width,
            startY: ((i * 29 + 11) % 100) / 100 * height,
            duration: 18000 + (i * 600) + ((i * 11) % 7) * 1500,
            delay: (i * 200) % 5000,
            scale: 0.3 + ((i % 4) * 0.15),
            opacity: 0.22,
            driftX: ((i % 7) - 3) * 1.2,
        }));

        return [...background, ...foreground];
    }, [lod, budget.particleCount]);

    // Skip rendering if budget doesn't allow particles
    if (particles.length === 0) return null;

    return (
        <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            renderToHardwareTextureAndroid
            shouldRasterizeIOS
        >
            {particles.map((p) => (
                <Particle
                    key={p.id}
                    x={p.x}
                    startY={p.startY}
                    duration={p.duration}
                    delay={p.delay}
                    scale={p.scale}
                    opacity={p.opacity}
                    driftX={p.driftX}
                />
            ))}
        </View>
    );
});

const TopGlow = React.memo(function TopGlow() {
    return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg height="100%" width="100%">
            <Defs>
                <RadialGradient
                    id="topGrad"
                    cx="50%"
                    cy="0%"
                    rx="60%"
                    ry="40%"
                    fx="50%"
                    fy="0%"
                    gradientUnits="userSpaceOnUse"
                >
                    <Stop offset="0" stopColor="#37190F" stopOpacity="1" />
                    <Stop offset="1" stopColor="#1D100B" stopOpacity="0" />
                </RadialGradient>
            </Defs>

            <Rect x="0" y="0" width="100%" height="100%" fill="#1D100B" />
            <Rect x="0" y="0" width="100%" height="60%" fill="url(#topGrad)" />
        </Svg>
    </View>
    );
});

export const TopBlurBackground = React.memo(function TopBlurBackground({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return (
        <View style={[styles.container, style]}>
            <TopGlow />
            <DustLayer />
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
}, (prev, next) => prev.children === next.children && prev.style === next.style);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1D100B',
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
    particle: {
        position: 'absolute',
        width: 3,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 1.5,
    },
});
