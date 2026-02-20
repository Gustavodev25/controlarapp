import { ArrowLeft, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming
} from 'react-native-reanimated';

interface BottomModalProps {
    visible: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    height?: number | string;
    rightElement?: React.ReactNode;
    subtitle?: string;
    onBack?: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function BottomModal({
    visible,
    onClose,
    title,
    children,
    height = '60%', // Default height
    rightElement,
    subtitle,
    onBack,
}: BottomModalProps) {
    const [showModal, setShowModal] = React.useState(visible);
    const translateY = useSharedValue(SCREEN_HEIGHT);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setShowModal(true);

            // Resetar valores antes de animar
            translateY.value = SCREEN_HEIGHT;
            opacity.value = 0;

            // Animate immediately
            requestAnimationFrame(() => {
                opacity.value = withTiming(1, { duration: 300 });
                translateY.value = withSpring(0, {
                    damping: 30,
                    stiffness: 250,
                    mass: 1,
                });
            });
        } else {
            opacity.value = withTiming(0, { duration: 250 });
            translateY.value = withTiming(SCREEN_HEIGHT, {
                duration: 300,
                easing: Easing.in(Easing.quad),
            }, (finished) => {
                if (finished) {
                    runOnJS(setShowModal)(false);
                }
            });
        }
    }, [visible]);

    const handleClose = React.useCallback(() => {
        if (onClose) onClose();
    }, [onClose]);

    const context = useSharedValue({ y: 0 });

    const pan = React.useMemo(() => Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(event.translationY + context.value.y, 0);
        })
        .onEnd((event) => {
            if (translateY.value > 100 || event.velocityY > 500) {
                runOnJS(handleClose)();
            } else {
                translateY.value = withSpring(0, {
                    damping: 30,
                    stiffness: 250,
                    mass: 1,
                });
            }
        }), [handleClose, translateY, context]);

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const isAutoHeight = height === 'auto';
    const contentHeight = isAutoHeight
        ? undefined
        : (typeof height === 'number' ? height : (parseFloat(height as string) / 100) * SCREEN_HEIGHT);

    if (!showModal) return null;

    return (
        <Modal
            transparent
            visible={showModal}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
            hardwareAccelerated
        >
            <KeyboardAvoidingView
                style={styles.overlay}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Backdrop */}
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
                    <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
                </Pressable>

                {/* Modal Content */}
                <Animated.View
                    style={[
                        styles.modalContainer,
                        isAutoHeight ? { maxHeight: '90%' } : { height: contentHeight },
                        animatedContentStyle,
                    ]}
                    renderToHardwareTextureAndroid
                >
                    <GestureDetector gesture={pan}>
                        <View style={styles.header}>

                            {/* Header Content */}
                            <View style={styles.headerRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                    {onBack && (
                                        <TouchableOpacity onPress={onBack} hitSlop={10}>
                                            <ArrowLeft size={24} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    )}
                                    <View>
                                        <Text style={styles.title}>{title}</Text>
                                        {subtitle && (
                                            <Text style={styles.subtitle}>{subtitle}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.headerRightContainer}>
                                    {rightElement}
                                    <Pressable onPress={handleClose} style={styles.closeButton}>
                                        <X size={20} color="#909090" />
                                    </Pressable>
                                </View>
                            </View>
                        </View>
                    </GestureDetector>

                    <View style={isAutoHeight ? { padding: 20 } : styles.content}>
                        {children}
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
        backgroundColor: '#141414',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: '#30302E',
        paddingBottom: 40, // Safe area
    },
    header: {
        backgroundColor: '#1A1A1A', // Requested header color
        borderTopLeftRadius: 24, // Match container radius
        borderTopRightRadius: 24, // Match container radius
        alignItems: 'center',
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#30302E',
        borderRadius: 2,
        marginBottom: 20,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
        // backgroundColor: '#2A2A2A', // Removed as per request
        borderRadius: 20,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    subtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
        fontWeight: '500',
    }
});
