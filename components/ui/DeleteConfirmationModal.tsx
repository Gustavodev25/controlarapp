import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    Layout,
    SlideOutUp,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface DeleteConfirmationModalProps {
    visible: boolean;
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
}

export function DeleteConfirmationModal({
    visible,
    title,
    onCancel,
    onConfirm,
    confirmText = "Desconectar",
    cancelText = "Cancelar"
}: DeleteConfirmationModalProps) {
    const [showContent, setShowContent] = useState(false);

    // Animation Values
    // Start collapsed (width ~44, height ~44) then expand
    const animatedWidth = useSharedValue(48);
    const animatedOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Force reset values immediately
            animatedWidth.value = 48;
            animatedOpacity.value = 0;
            setShowContent(false);

            // 2. Expand width after a small delay
            animatedWidth.value = withDelay(100, withSpring(width - 48, { damping: 15, mass: 1, stiffness: 100 }));

            // 3. Fade in content
            animatedOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));

            // Allow rendering of text after expansion starts
            const timer = setTimeout(() => {
                setShowContent(true);
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [visible]);



    const rStyle = useAnimatedStyle(() => {
        return {
            width: animatedWidth.value,
        };
    });

    const rContentStyle = useAnimatedStyle(() => {
        return {
            opacity: animatedOpacity.value,
        };
    });

    const handleClose = (callback: () => void) => {
        // 1. Fade out content immediately
        animatedOpacity.value = withTiming(0, { duration: 100 });
        setShowContent(false);

        // 2. Shrink width back to circle (using timing for precision)
        // Wait 50ms then shrink over 250ms
        animatedWidth.value = withDelay(50, withTiming(48, { duration: 250 }));

        // 3. Trigger actual close (unmount) after animation completes
        setTimeout(() => {
            callback();
        }, 350);
    };

    if (!visible) return null;

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => handleClose(onCancel)}
            />

            {/* Dynamic Pill Container */}
            <Animated.View
                entering={(values: any) => {
                    'worklet';
                    const animations = {
                        transform: [{ translateY: withSpring(0, { damping: 15, mass: 1, stiffness: 100 }) }],
                    };
                    const initialValues = {
                        transform: [{ translateY: -150 }],
                    };
                    return {
                        initialValues,
                        animations,
                    };
                }}
                exiting={SlideOutUp.duration(200)}
                layout={Layout.springify()}
                style={[styles.pillWrapper, rStyle]} // Animated Width applied here
                pointerEvents="auto"
            >
                <View style={styles.pillContainer}>
                    {/* Visual Border */}
                    <View style={styles.glassBorder} />

                    {/* Always visible Icon (centered initially) */}
                    <View style={styles.iconInitialPosition}>
                        <LottieView
                            source={require('../../assets/info.json')}
                            autoPlay
                            loop
                            style={{ width: 24, height: 24 }}
                        />
                    </View>

                    {/* Content that fades in after expansion */}
                    {showContent && (
                        <Animated.View style={[styles.contentRow, rContentStyle]}>
                            {/* Spacer for the icon's width so text doesn't overlap */}
                            <View style={{ width: 20 }} />

                            {/* Text */}
                            <Text style={styles.title} numberOfLines={1}>
                                {title}
                            </Text>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* Actions */}
                            <View style={styles.actionsContainer}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => handleClose(onCancel)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.cancelText}>{cancelText}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleClose(onConfirm)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Text style={styles.deleteText}>{confirmText}</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'flex-start',
        paddingTop: Platform.OS === 'ios' ? 40 : 20,
        alignItems: 'center',
    },
    pillWrapper: {
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
        height: 48, // Fixed height
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'transparent',
    },
    pillContainer: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        paddingHorizontal: 16, // Padding for content
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    iconInitialPosition: {
        position: 'absolute',
        left: 14, // Roughly centered when width is 44
        zIndex: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 4, // Slight detailed adjustment
        width: '100%',
        justifyContent: 'space-between',
        paddingRight: 0,
    },
    title: {
        fontSize: 13.5,
        fontWeight: '400',
        color: '#FFFFFF',
        flex: 1, // Take available space
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 4,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cancelButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 99,
    },
    cancelText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#A0A0A0',
    },
    deleteButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 99,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF453A',
    },
});
