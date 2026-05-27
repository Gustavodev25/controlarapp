import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface ModernSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    activeColor?: string;
    inactiveColor?: string;
    thumbColor?: string;
    width?: number;
    height?: number;
    disabled?: boolean;
}

export function ModernSwitch({
    value,
    onValueChange,
    activeColor = '#FFFFFF',
    inactiveColor = 'rgba(255,255,255,0.1)',
    thumbColor = '#FFFFFF',
    width = 44,
    height = 24,
    disabled = false
}: ModernSwitchProps) {
    const progress = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, {
            mass: 1,
            damping: 30,
            stiffness: 350,
        });
    }, [value]);

    const animatedContainerStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            [inactiveColor, activeColor]
        );

        return {
            backgroundColor,
        };
    });

    const animatedThumbStyle = useAnimatedStyle(() => {
        const translateX = progress.value * (width - height);
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            ['#FFFFFF', '#1C1C1E']
        );

        return {
            transform: [{ translateX }],
            backgroundColor,
        };
    });

    return (
        <TouchableOpacity
            onPress={() => !disabled && onValueChange(!value)}
            activeOpacity={1}
            style={{ opacity: disabled ? 0.5 : 1 }}
        >
            <Animated.View style={[
                styles.container,
                animatedContainerStyle,
                { width, height, borderRadius: height / 2 }
            ]}>
                <Animated.View style={[
                    styles.thumb,
                    animatedThumbStyle,
                    {
                        width: height - 4,
                        height: height - 4,
                        borderRadius: (height - 4) / 2,
                    }
                ]} />
            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        padding: 2,
    },
    thumb: {
        // iOS Core style - precise shadow
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 3,
        },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 2,
    }
});

