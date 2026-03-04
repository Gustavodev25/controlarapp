import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    ModalProps,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModalPadraoProps extends ModalProps {
    visible: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    headerRight?: React.ReactNode;
}

export function ModalPadrao({
    visible,
    onClose,
    title,
    children,
    headerRight,
    ...rest
}: ModalPadraoProps) {
    const [showModal, setShowModal] = useState(visible);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 6,
                    speed: 14,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            });
        } else {
            Keyboard.dismiss();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });

            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowModal(false);
            });
        }
    }, [visible, slideAnim, opacityAnim]);

    return (
        <Modal
            visible={showModal}
            transparent
            statusBarTranslucent
            hardwareAccelerated
            animationType="none"
            onRequestClose={onClose}
            {...rest}
        >
            <View style={styles.container}>
                {/* Backdrop com Blur + animação suave */}
                <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
                    <BlurView
                        intensity={85}
                        tint="dark"
                        experimentalBlurMethod="dimezisBlurView"
                        style={StyleSheet.absoluteFill}
                    />

                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={onClose}
                    />
                </Animated.View>

                {/* Sheet com KeyboardAvoidingView */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardAvoiding}
                >
                    <Animated.View
                        style={[
                            styles.modalContent,
                            { transform: [{ translateY: slideAnim }] },
                        ]}
                    >
                        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                            <View style={styles.innerContent}>
                                {/* Header */}
                                <View style={styles.modalHeader}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        {typeof title === 'string' ? (
                                            <Text style={styles.modalTitle} numberOfLines={2}>
                                                {title}
                                            </Text>
                                        ) : (
                                            title
                                        )}
                                    </View>

                                    <View style={styles.headerRightContainer}>
                                        {headerRight && (
                                            <View style={{ marginRight: 12 }}>
                                                {headerRight}
                                            </View>
                                        )}
                                        <TouchableOpacity
                                            onPress={onClose}
                                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                        >
                                            <X size={24} color="#8E8E93" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {children}
                            </View>
                        </TouchableWithoutFeedback>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    keyboardAvoiding: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        maxHeight: SCREEN_HEIGHT * 0.92,   // ← evita modal gigante
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 20,
        overflow: 'hidden',               // ← evita vazamento visual
    },
    innerContent: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.3,
    },
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});