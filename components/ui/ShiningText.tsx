import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';

interface ShiningTextProps {
    text: string;
    textStyle?: TextStyle;
}

export function ShiningText({ text, textStyle }: ShiningTextProps) {
    const [width, setWidth] = useState(0);
    const translateX = useSharedValue(0);

    useEffect(() => {
        if (width > 0) {
            translateX.value = -width;
            translateX.value = withRepeat(
                withTiming(width, {
                    duration: 2000,
                    easing: Easing.linear,
                }),
                -1, // Infinite
                false // Do not reverse
            );
        }
    }, [width]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    return (
        <View>
            {/* Base Text Layer - Always visible */}
            <Text
                style={[styles.text, textStyle]}
                onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            >
                {text}
            </Text>

            {/* Shine Overlay Layer */}
            <MaskedView
                style={StyleSheet.absoluteFill}
                maskElement={
                    <Text style={[styles.text, textStyle]}>
                        {text}
                    </Text>
                }
            >
                {/* Animated Gradient Shine */}
                <Animated.View style={[StyleSheet.absoluteFill, { width: '100%' }, animatedStyle]}>
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.8)', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                        locations={[0, 0.5, 1]}
                    />
                </Animated.View>
            </MaskedView>
        </View>
    );
}

const styles = StyleSheet.create({
    text: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});
