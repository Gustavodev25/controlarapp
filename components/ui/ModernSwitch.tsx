import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
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
    activeColor = '#D97757', // Premium orange/rust
    inactiveColor = '#3f3f46',
    thumbColor = '#FFFFFF',
    width = 50,
    height = 28,
    disabled = false
}: ModernSwitchProps) {
    const progress = useSharedValue(value ? 1 : 0);

    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, {
            mass: 1,
            damping: 15,
            stiffness: 120,
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

        return {
            transform: [{ translateX }],
        };
    });

    return (
        <TouchableOpacity
            onPress={() => !disabled && onValueChange(!value)}
            activeOpacity={disabled ? 1 : 0.8}
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
                        backgroundColor: thumbColor
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
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    }
});
