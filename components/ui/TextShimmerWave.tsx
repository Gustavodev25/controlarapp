import React, { useEffect } from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

interface TextShimmerWaveProps {
    children: string;
    style?: ViewStyle;
    textStyle?: TextStyle;
    duration?: number;
}

const ShimmerChar = ({
    char,
    index,
    total,
    duration,
    textStyle
}: {
    char: string;
    index: number;
    total: number;
    duration: number;
    textStyle?: TextStyle;
}) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        const delay = (index * duration) / (total * 2); // Spread the wave
        progress.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
                ),
                -1, // Infinite
                true // Reverse? No, the sequence handles up/down. Actually withSequence(0->1, 1->0) returns to 0. 
                // withRepeat(anim, -1, false) is just loop 0->1->0->0->1->0 
                // User code: [0, 1, 0] in one cycle.
                // So let's just do 0 to 1 loop.
            )
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        // scale: [1, 1.02, 1] - Very subtle scale
        const scale = 1 + progress.value * 0.02;

        // translateY: [0, -1, 0] - Reduced movement
        const translateY = progress.value * -1;

        // opacity: 0.7 -> 1.0 -> 0.7 - Smoother, less "blinking"
        return {
            transform: [
                { scale },
                { translateY }
            ],
            opacity: 0.7 + progress.value * 0.3,
        };
    });

    return (
        <Animated.Text style={[styles.char, textStyle, animatedStyle]}>
            {char}
        </Animated.Text>
    );
};

export const TextShimmerWave = ({
    children,
    style,
    textStyle,
    duration = 1000,
}: TextShimmerWaveProps) => {
    return (
        <View style={[styles.container, style]}>
            {children.split('').map((char, i) => (
                <ShimmerChar
                    key={i}
                    char={char}
                    index={i}
                    total={children.length}
                    duration={duration}
                    textStyle={textStyle}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    char: {
        // Default styles
        color: '#A1A1AA',
    },
});
