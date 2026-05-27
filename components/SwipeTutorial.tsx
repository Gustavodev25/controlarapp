import { BlurView } from 'expo-blur';
import LottieView from 'lottie-react-native';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface SwipeTutorialProps {
    visible: boolean;
    onDismiss?: () => void;
    style?: any;
    size?: number;
    absoluteFill?: boolean;
}

export const SwipeTutorial = ({
    visible,
    onDismiss,
    style,
    size = 80,
    absoluteFill = true
}: SwipeTutorialProps) => {
    const animation = useRef<LottieView>(null);

    useEffect(() => {
        if (visible) {
            animation.current?.play();
        } else {
            animation.current?.pause();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={[
                absoluteFill ? StyleSheet.absoluteFillObject : null,
                styles.container,
                style
            ]}
            pointerEvents="box-none" // Allow touches to pass through IF we want to allow interaction to dismiss, but we handle dismiss via press on this overlay usually
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onDismiss}
                style={styles.touchable}
            >
                <BlurView
                    intensity={80}
                    tint="dark"
                    experimentalBlurMethod="dimezisBlurView"
                    style={StyleSheet.absoluteFill}
                />
                <View style={styles.content}>
                    <LottieView
                        ref={animation}
                        source={require('../assets/swipe.json')}
                        style={{ width: size, height: size }}
                        autoPlay
                        loop
                    />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16, // Default matching most cards
        overflow: 'hidden',
    },
    touchable: {
        flex: 1,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottie: {
        width: 100,
        height: 100,
    }
});
