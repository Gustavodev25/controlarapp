import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    LayoutChangeEvent,
    Modal,
    ModalProps,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    ScrollViewProps,
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    useWindowDimensions,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ModalPadraoProps
    extends Omit<ModalProps, 'visible' | 'transparent' | 'animationType'> {
    visible: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;

    headerRight?: React.ReactNode;
    footer?: React.ReactNode;

    closeOnBackdropPress?: boolean;
    enableDragToClose?: boolean;
    showHandle?: boolean;
    scrollable?: boolean;

    maxHeightRatio?: number;
    minHeight?: number;
    size?: 'sm' | 'md' | 'lg' | 'full';
    modalWidth?: number | `${number}%`;
    maxWidth?: number;
    horizontalMargin?: number;

    contentStyle?: StyleProp<ViewStyle>;
    headerStyle?: StyleProp<ViewStyle>;
    bodyStyle?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
    footerStyle?: StyleProp<ViewStyle>;
    closeButtonStyle?: StyleProp<ViewStyle>;
    backdropStyle?: StyleProp<ViewStyle>;
    scrollViewProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;

    titleAlign?: 'center' | 'start';
    presentation?: 'bottom' | 'center';

    hideCloseButton?: boolean;
    canClose?: boolean;
    onBeforeClose?: () => boolean | Promise<boolean>;

    loading?: boolean;
    disableCloseWhenLoading?: boolean;

    footerSafeArea?: boolean;
    footerBorder?: boolean;

    keyboardVerticalOffset?: number;

    onAfterOpen?: () => void;
    onAfterClose?: () => void;
    onDragClose?: () => void;

    closeButtonAccessibilityLabel?: string;
}

const MODAL_BACKGROUND = '#141414';
const MODAL_BORDER = '#2B2B2B';
const IOS_SEPARATOR = 'rgba(255,255,255,0.10)';
const ANDROID_BACKDROP_BLUR = Platform.OS === 'android';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const clamp = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
};

const CENTER_SIZE_WIDTH = {
    sm: 360,
    md: 430,
    lg: 560,
    full: 9999,
};

export function ModalPadrao({
    visible,
    onClose,
    title,
    children,
    headerRight,
    footer,

    closeOnBackdropPress = true,
    enableDragToClose = true,
    showHandle,
    scrollable = true,

    maxHeightRatio = 0.92,
    minHeight,
    size = 'md',
    modalWidth,
    maxWidth,
    horizontalMargin = 16,

    contentStyle,
    headerStyle,
    bodyStyle,
    titleStyle,
    footerStyle,
    closeButtonStyle,
    backdropStyle,
    scrollViewProps,

    titleAlign = 'start',
    presentation = 'center',

    hideCloseButton = false,
    canClose = true,
    onBeforeClose,

    loading = false,
    disableCloseWhenLoading = true,

    footerSafeArea = true,
    footerBorder = true,

    keyboardVerticalOffset = 0,

    onAfterOpen,
    onAfterClose,
    onDragClose,

    closeButtonAccessibilityLabel = 'Fechar modal',

    ...rest
}: ModalPadraoProps) {
    const insets = useSafeAreaInsets();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();

    const [mounted, setMounted] = useState(visible);
    const mountedRef = useRef(visible);

    const [sheetHeight, setSheetHeight] = useState(
        screenHeight * clamp(maxHeightRatio, 0.45, 0.97),
    );

    const [keyboardHeight, setKeyboardHeight] = useState(0);

    const sheetY = useRef(new Animated.Value(screenHeight)).current;
    const dragY = useRef(new Animated.Value(0)).current;

    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const sheetOpacity = useRef(new Animated.Value(0)).current;

    const sheetScaleX = useRef(new Animated.Value(0.96)).current;
    const sheetScaleY = useRef(new Animated.Value(0.94)).current;

    const radiusProgress = useRef(new Animated.Value(0)).current;
    const liquidImpulse = useRef(new Animated.Value(0)).current;

    const headerProgress = useRef(new Animated.Value(0)).current;
    const closeMorph = useRef(new Animated.Value(0)).current;

    const isOpenRef = useRef(false);
    const isClosingRef = useRef(false);
    const isCheckingCloseRef = useRef(false);
    const shouldOpenOnMountRef = useRef(false);

    const setMountedSafe = useCallback((nextMounted: boolean) => {
        mountedRef.current = nextMounted;
        setMounted(nextMounted);
    }, []);

    const closeDisabled = canClose === false || (loading && disableCloseWhenLoading);

    const availableHeight = useMemo(() => {
        const safeHeight = screenHeight - insets.top - insets.bottom - 24;

        if (presentation === 'center') {
            return Math.max(260, safeHeight - keyboardHeight);
        }

        return Math.max(320, safeHeight);
    }, [
        screenHeight,
        insets.top,
        insets.bottom,
        keyboardHeight,
        presentation,
    ]);

    const modalMaxHeight = useMemo(() => {
        return availableHeight * clamp(maxHeightRatio, 0.45, 0.97);
    }, [availableHeight, maxHeightRatio]);

    const computedCenterMaxWidth = useMemo(() => {
        if (maxWidth) return maxWidth;

        if (size === 'full') {
            return Math.max(280, screenWidth - horizontalMargin * 2);
        }

        return CENTER_SIZE_WIDTH[size];
    }, [maxWidth, size, screenWidth, horizontalMargin]);

    const centerSheetWidth = useMemo(() => {
        if (modalWidth) return modalWidth;

        return Math.min(
            screenWidth - horizontalMargin * 2,
            computedCenterMaxWidth,
        );
    }, [modalWidth, screenWidth, horizontalMargin, computedCenterMaxWidth]);

    const closedSheetY = presentation === 'center' ? 22 : screenHeight + 54;
    const initialSheetScaleX = presentation === 'center' ? 0.955 : 0.985;
    const initialSheetScaleY = presentation === 'center' ? 0.935 : 0.965;

    const shouldEnableDragToClose = presentation === 'bottom' && enableDragToClose;
    const shouldShowHandle = showHandle ?? presentation === 'bottom';

    const translateY = useMemo(() => {
        return Animated.add(sheetY, dragY).interpolate({
            inputRange: [0, screenHeight],
            outputRange: [0, screenHeight],
            extrapolate: 'clamp',
        });
    }, [sheetY, dragY, screenHeight]);

    const dragScaleX = useMemo(() => {
        return dragY.interpolate({
            inputRange: [0, Math.max(sheetHeight * 0.55, 1)],
            outputRange: [1, 0.982],
            extrapolate: 'clamp',
        });
    }, [dragY, sheetHeight]);

    const dragScaleY = useMemo(() => {
        return dragY.interpolate({
            inputRange: [0, Math.max(sheetHeight * 0.55, 1)],
            outputRange: [1, 0.99],
            extrapolate: 'clamp',
        });
    }, [dragY, sheetHeight]);

    const headerTranslateY = useMemo(() => {
        return headerProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [12, 0],
        });
    }, [headerProgress]);

    const headerScale = useMemo(() => {
        return headerProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.965, 1],
        });
    }, [headerProgress]);

    const sheetRadius = useMemo(() => {
        const closedRadius = presentation === 'center' ? 18 : 42;
        const openRadius = presentation === 'center' ? 24 : 34;

        const baseRadius = radiusProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [closedRadius, openRadius],
            extrapolate: 'clamp',
        });

        const impulseRadius = liquidImpulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0, presentation === 'center' ? 7 : 10],
            extrapolate: 'clamp',
        });

        return Animated.add(baseRadius, impulseRadius);
    }, [radiusProgress, liquidImpulse, presentation]);

    const sheetAnimatedStyle = useMemo(() => {
        const scaleX = Animated.multiply(sheetScaleX, dragScaleX);
        const scaleY = Animated.multiply(sheetScaleY, dragScaleY);

        return {
            opacity: sheetOpacity,
            borderTopLeftRadius: sheetRadius,
            borderTopRightRadius: sheetRadius,
            borderBottomLeftRadius: presentation === 'center' ? sheetRadius : 0,
            borderBottomRightRadius: presentation === 'center' ? sheetRadius : 0,
            transform: [
                { translateY },
                { scaleX },
                { scaleY },
            ],
        } as any;
    }, [
        sheetOpacity,
        sheetRadius,
        presentation,
        translateY,
        sheetScaleX,
        sheetScaleY,
        dragScaleX,
        dragScaleY,
    ]);

    const closeButtonAnimatedStyle = useMemo(() => {
        const closeRadius = closeMorph.interpolate({
            inputRange: [0, 1],
            outputRange: [999, 13],
            extrapolate: 'clamp',
        });

        const closeBg = closeMorph.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.115)'],
        });

        const closeBorder = closeMorph.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(255,255,255,0.075)', 'rgba(255,255,255,0.16)'],
        });

        const closeScaleX = closeMorph.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.92],
            extrapolate: 'clamp',
        });

        const closeScaleY = closeMorph.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.08],
            extrapolate: 'clamp',
        });

        return {
            borderRadius: closeRadius,
            backgroundColor: closeBg,
            borderColor: closeBorder,
            transform: [
                { scaleX: closeScaleX },
                { scaleY: closeScaleY },
            ],
        } as any;
    }, [closeMorph]);

    const triggerHaptic = useCallback(
        (style = Haptics.ImpactFeedbackStyle.Light) => {
            Haptics.impactAsync(style).catch(() => { });
        },
        [],
    );

    const resetAnimatedValues = useCallback(() => {
        dragY.stopAnimation();
        sheetY.stopAnimation();
        backdropOpacity.stopAnimation();
        sheetOpacity.stopAnimation();
        sheetScaleX.stopAnimation();
        sheetScaleY.stopAnimation();
        radiusProgress.stopAnimation();
        liquidImpulse.stopAnimation();
        headerProgress.stopAnimation();
        closeMorph.stopAnimation();

        dragY.setValue(0);
        sheetY.setValue(closedSheetY);
        backdropOpacity.setValue(0);
        sheetOpacity.setValue(0);
        sheetScaleX.setValue(initialSheetScaleX);
        sheetScaleY.setValue(initialSheetScaleY);
        radiusProgress.setValue(0);
        liquidImpulse.setValue(0);
        headerProgress.setValue(0);
        closeMorph.setValue(0);
    }, [
        dragY,
        sheetY,
        backdropOpacity,
        sheetOpacity,
        sheetScaleX,
        sheetScaleY,
        radiusProgress,
        liquidImpulse,
        headerProgress,
        closeMorph,
        closedSheetY,
        initialSheetScaleX,
        initialSheetScaleY,
    ]);

    const runOpenAnimation = useCallback(() => {
        if (isOpenRef.current && !isClosingRef.current) {
            return;
        }

        isOpenRef.current = true;
        isClosingRef.current = false;

        resetAnimatedValues();

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 260,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(sheetOpacity, {
                toValue: 1,
                duration: presentation === 'center' ? 170 : 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.spring(sheetY, {
                toValue: 0,
                damping: presentation === 'center' ? 18 : 20,
                stiffness: presentation === 'center' ? 235 : 245,
                mass: 0.78,
                overshootClamping: false,
                useNativeDriver: false,
            }),

            Animated.sequence([
                Animated.timing(sheetScaleX, {
                    toValue: presentation === 'center' ? 1.018 : 1.012,
                    duration: 165,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.spring(sheetScaleX, {
                    toValue: 1,
                    damping: 13,
                    stiffness: 190,
                    mass: 0.62,
                    overshootClamping: false,
                    useNativeDriver: false,
                }),
            ]),

            Animated.sequence([
                Animated.timing(sheetScaleY, {
                    toValue: presentation === 'center' ? 1.012 : 1.018,
                    duration: 185,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.spring(sheetScaleY, {
                    toValue: 1,
                    damping: 13,
                    stiffness: 185,
                    mass: 0.62,
                    overshootClamping: false,
                    useNativeDriver: false,
                }),
            ]),

            Animated.timing(radiusProgress, {
                toValue: 1,
                duration: 230,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),

            Animated.sequence([
                Animated.timing(liquidImpulse, {
                    toValue: 1,
                    duration: 155,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: false,
                }),
                Animated.spring(liquidImpulse, {
                    toValue: 0,
                    damping: 11,
                    stiffness: 145,
                    mass: 0.58,
                    overshootClamping: false,
                    useNativeDriver: false,
                }),
            ]),

            Animated.timing(headerProgress, {
                toValue: 1,
                duration: 280,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }),
        ]).start(({ finished }) => {
            if (finished && isOpenRef.current) {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                onAfterOpen?.();
            }
        });
    }, [
        resetAnimatedValues,
        backdropOpacity,
        sheetOpacity,
        sheetY,
        sheetScaleX,
        sheetScaleY,
        radiusProgress,
        liquidImpulse,
        headerProgress,
        presentation,
        triggerHaptic,
        onAfterOpen,
    ]);

    const runCloseAnimation = useCallback(() => {
        if (isClosingRef.current) {
            return;
        }

        if (!isOpenRef.current) {
            setMountedSafe(false);
            return;
        }

        isOpenRef.current = false;
        isClosingRef.current = true;

        Keyboard.dismiss();
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 190,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(sheetOpacity, {
                toValue: 0,
                duration: presentation === 'center' ? 150 : 185,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(headerProgress, {
                toValue: 0,
                duration: 130,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(sheetScaleX, {
                toValue: initialSheetScaleX,
                duration: 190,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                useNativeDriver: false,
            }),

            Animated.timing(sheetScaleY, {
                toValue: initialSheetScaleY,
                duration: 205,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                useNativeDriver: false,
            }),

            Animated.timing(radiusProgress, {
                toValue: 0,
                duration: 170,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(liquidImpulse, {
                toValue: 0,
                duration: 120,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),

            Animated.timing(sheetY, {
                toValue: closedSheetY,
                duration: presentation === 'center' ? 205 : 255,
                easing: Easing.bezier(0.22, 1, 0.36, 1),
                useNativeDriver: false,
            }),
        ]).start(({ finished }) => {
            if (finished && isClosingRef.current) {
                dragY.setValue(0);
                isClosingRef.current = false;
                setMountedSafe(false);
                onAfterClose?.();
            }
        });
    }, [
        backdropOpacity,
        sheetOpacity,
        headerProgress,
        sheetScaleX,
        sheetScaleY,
        radiusProgress,
        liquidImpulse,
        sheetY,
        dragY,
        closedSheetY,
        initialSheetScaleX,
        initialSheetScaleY,
        presentation,
        triggerHaptic,
        setMountedSafe,
        onAfterClose,
    ]);

    const requestClose = useCallback(async () => {
        if (isClosingRef.current || isCheckingCloseRef.current) return;
        if (closeDisabled) return;

        if (onBeforeClose) {
            isCheckingCloseRef.current = true;

            try {
                const allowed = await onBeforeClose();

                if (!allowed) {
                    return;
                }
            } finally {
                isCheckingCloseRef.current = false;
            }
        }

        Keyboard.dismiss();
        onClose();
    }, [closeDisabled, onBeforeClose, onClose]);

    const handleRequestClose = useCallback(() => {
        void requestClose();
    }, [requestClose]);

    const handleClosePressIn = useCallback(() => {
        Animated.spring(closeMorph, {
            toValue: 1,
            damping: 13,
            stiffness: 260,
            mass: 0.48,
            useNativeDriver: false,
        }).start();
    }, [closeMorph]);

    const handleClosePressOut = useCallback(() => {
        Animated.spring(closeMorph, {
            toValue: 0,
            damping: 12,
            stiffness: 210,
            mass: 0.52,
            useNativeDriver: false,
        }).start();
    }, [closeMorph]);

    useEffect(() => {
        const showEvent =
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent =
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, (event) => {
            setKeyboardHeight(event.endCoordinates?.height ?? 0);
        });

        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    useEffect(() => {
        return () => {
            isOpenRef.current = false;
            isClosingRef.current = false;
            isCheckingCloseRef.current = false;

            dragY.stopAnimation();
            sheetY.stopAnimation();
            backdropOpacity.stopAnimation();
            sheetOpacity.stopAnimation();
            sheetScaleX.stopAnimation();
            sheetScaleY.stopAnimation();
            radiusProgress.stopAnimation();
            liquidImpulse.stopAnimation();
            headerProgress.stopAnimation();
            closeMorph.stopAnimation();
        };
    }, [
        dragY,
        sheetY,
        backdropOpacity,
        sheetOpacity,
        sheetScaleX,
        sheetScaleY,
        radiusProgress,
        liquidImpulse,
        headerProgress,
        closeMorph,
    ]);

    useEffect(() => {
        if (visible) {
            resetAnimatedValues();

            isOpenRef.current = false;
            isClosingRef.current = false;

            if (!mountedRef.current) {
                shouldOpenOnMountRef.current = true;
                setMountedSafe(true);
                return;
            }

            runOpenAnimation();
            return;
        }

        runCloseAnimation();
    }, [
        visible,
        resetAnimatedValues,
        runOpenAnimation,
        runCloseAnimation,
        setMountedSafe,
    ]);

    useLayoutEffect(() => {
        if (mounted && shouldOpenOnMountRef.current) {
            shouldOpenOnMountRef.current = false;
            runOpenAnimation();
        }
    }, [mounted, runOpenAnimation]);

    const handleSheetLayout = useCallback((event: LayoutChangeEvent) => {
        const nextHeight = Math.ceil(event.nativeEvent.layout.height);

        setSheetHeight((currentHeight) => {
            return currentHeight === nextHeight ? currentHeight : nextHeight;
        });
    }, []);

    const resetDrag = useCallback(() => {
        Animated.parallel([
            Animated.spring(dragY, {
                toValue: 0,
                damping: 17,
                stiffness: 220,
                mass: 0.74,
                useNativeDriver: false,
            }),

            Animated.spring(liquidImpulse, {
                toValue: 0,
                damping: 10,
                stiffness: 145,
                mass: 0.58,
                useNativeDriver: false,
            }),

            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: false,
            }),
        ]).start();
    }, [dragY, liquidImpulse, backdropOpacity]);

    const panResponder = useMemo(() => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => false,

            onMoveShouldSetPanResponder: (_, gesture) => {
                if (!shouldEnableDragToClose || closeDisabled) return false;

                const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx);
                const isPullingDown = gesture.dy > 7;

                return isVertical && isPullingDown;
            },

            onPanResponderGrant: () => {
                dragY.stopAnimation();

                Animated.spring(liquidImpulse, {
                    toValue: 0.55,
                    damping: 12,
                    stiffness: 155,
                    mass: 0.55,
                    useNativeDriver: false,
                }).start();
            },

            onPanResponderMove: (_, gesture) => {
                if (!shouldEnableDragToClose || closeDisabled) return;

                const nextDrag = Math.max(0, gesture.dy);
                const nextOpacity = clamp(
                    1 - nextDrag / (screenHeight * 0.85),
                    0.28,
                    1,
                );

                dragY.setValue(nextDrag);
                backdropOpacity.setValue(nextOpacity);
            },

            onPanResponderRelease: (_, gesture) => {
                if (!shouldEnableDragToClose || closeDisabled) return;

                const closeDistance = clamp(sheetHeight * 0.22, 90, 180);
                const shouldClose = gesture.dy > closeDistance || gesture.vy > 1.15;

                if (shouldClose) {
                    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

                    Animated.parallel([
                        Animated.timing(dragY, {
                            toValue: screenHeight,
                            duration: 190,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: false,
                        }),

                        Animated.timing(liquidImpulse, {
                            toValue: 0,
                            duration: 120,
                            easing: Easing.out(Easing.quad),
                            useNativeDriver: false,
                        }),
                    ]).start(() => {
                        onDragClose?.();
                        void requestClose();
                    });

                    return;
                }

                resetDrag();
            },

            onPanResponderTerminate: () => {
                resetDrag();
            },
        });
    }, [
        shouldEnableDragToClose,
        closeDisabled,
        dragY,
        backdropOpacity,
        liquidImpulse,
        screenHeight,
        sheetHeight,
        triggerHaptic,
        requestClose,
        onDragClose,
        resetDrag,
    ]);

    const keyboardContainerStyle = useMemo<StyleProp<ViewStyle>>(() => {
        if (presentation === 'center') {
            return [
                styles.keyboardAvoiding,
                styles.keyboardAvoidingCenter,
                {
                    paddingTop: insets.top + 16,
                    paddingBottom: Math.max(insets.bottom + 16, 16),
                    paddingHorizontal: horizontalMargin,
                },
            ];
        }

        return [
            styles.keyboardAvoiding,
            {
                paddingTop: insets.top,
            },
        ];
    }, [
        presentation,
        insets.top,
        insets.bottom,
        horizontalMargin,
    ]);

    const sheetDynamicStyle = useMemo<StyleProp<ViewStyle>>(() => {
        if (presentation === 'center') {
            return {
                width: centerSheetWidth,
                maxWidth: computedCenterMaxWidth,
                maxHeight: modalMaxHeight,
                minHeight,
            };
        }

        return {
            width: '100%',
            maxHeight: modalMaxHeight,
            minHeight,
        };
    }, [
        presentation,
        centerSheetWidth,
        computedCenterMaxWidth,
        modalMaxHeight,
        minHeight,
    ]);

    const bodyContentDynamicStyle = useMemo<StyleProp<ViewStyle>>(() => {
        const bottomPaddingWithoutFooter =
            presentation === 'bottom'
                ? Math.max(insets.bottom + 16, 24)
                : 20;

        return [
            styles.bodyContent,
            {
                paddingBottom: footer ? 16 : bottomPaddingWithoutFooter,
            },
            bodyStyle,
        ];
    }, [
        presentation,
        insets.bottom,
        footer,
        bodyStyle,
    ]);

    const bodyStaticDynamicStyle = useMemo<StyleProp<ViewStyle>>(() => {
        const bottomPaddingWithoutFooter =
            presentation === 'bottom'
                ? Math.max(insets.bottom + 16, 24)
                : 20;

        return [
            styles.bodyStatic,
            {
                paddingBottom: footer ? 16 : bottomPaddingWithoutFooter,
            },
            bodyStyle,
        ];
    }, [
        presentation,
        insets.bottom,
        footer,
        bodyStyle,
    ]);

    const footerDynamicStyle = useMemo<StyleProp<ViewStyle>>(() => {
        return [
            styles.footer,
            {
                borderTopWidth: footerBorder ? 1 : 0,
                paddingBottom: footerSafeArea
                    ? presentation === 'bottom'
                        ? Math.max(insets.bottom + 14, 24)
                        : 20
                    : 18,
            },
            footerStyle,
        ];
    }, [
        footerBorder,
        footerSafeArea,
        presentation,
        insets.bottom,
        footerStyle,
    ]);

    const renderTitle = () => {
        if (typeof title === 'string') {
            return (
                <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                    {title}
                </Text>
            );
        }

        return title;
    };

    if (!mounted) {
        return null;
    }

    return (
        <Modal
            visible={mounted}
            transparent
            statusBarTranslucent
            hardwareAccelerated
            animationType="none"
            onRequestClose={handleRequestClose}
            {...rest}
        >
            <View
                style={[
                    styles.container,
                    presentation === 'center' && styles.containerCenter,
                ]}
            >
                {ANDROID_BACKDROP_BLUR ? (
                    <Animated.View
                        pointerEvents="none"
                        renderToHardwareTextureAndroid
                        style={[
                            styles.backdrop,
                            backdropStyle,
                            { opacity: backdropOpacity },
                        ]}
                    >
                        <BlurView
                            intensity={90}
                            tint="dark"
                            experimentalBlurMethod="dimezisBlurView"
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.backdropDim} />
                    </Animated.View>
                ) : (
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.backdropWithTint,
                            backdropStyle,
                            { opacity: backdropOpacity },
                        ]}
                    >
                        <BlurView
                            intensity={70}
                            tint="dark"
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.backdropTint} />
                    </Animated.View>
                )}

                <Pressable
                    pointerEvents={closeOnBackdropPress ? 'auto' : 'none'}
                    style={StyleSheet.absoluteFill}
                    onPress={handleRequestClose}
                />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={keyboardVerticalOffset}
                    style={keyboardContainerStyle}
                >
                    <Animated.View
                        accessibilityViewIsModal
                        accessibilityLabel={
                            typeof title === 'string' ? title : 'Modal'
                        }
                        onLayout={handleSheetLayout}
                        renderToHardwareTextureAndroid
                        style={[
                            styles.sheet,
                            presentation === 'center' && styles.sheetCenter,
                            sheetDynamicStyle,
                            sheetAnimatedStyle,
                            contentStyle,
                        ]}
                    >
                        <View
                            style={styles.gestureArea}
                            {...(shouldEnableDragToClose
                                ? panResponder.panHandlers
                                : {})}
                        >
                            {shouldShowHandle && (
                                <View style={styles.handleWrapper}>
                                    <View style={styles.handle} />
                                </View>
                            )}

                            <Animated.View
                                style={[
                                    styles.header,
                                    headerStyle,
                                    {
                                        opacity: headerProgress,
                                        transform: [
                                            { translateY: headerTranslateY },
                                            { scale: headerScale },
                                        ],
                                    },
                                ]}
                            >
                                {titleAlign === 'center' ? (
                                    <View
                                        pointerEvents="none"
                                        style={styles.titleCenterLayer}
                                    >
                                        {renderTitle()}
                                    </View>
                                ) : (
                                    <View style={styles.titleStartContainer}>
                                        {renderTitle()}
                                    </View>
                                )}

                                <View style={styles.headerActions}>
                                    {headerRight}

                                    {!hideCloseButton && (
                                        <AnimatedTouchableOpacity
                                            activeOpacity={1}
                                            disabled={closeDisabled}
                                            onPress={handleRequestClose}
                                            onPressIn={handleClosePressIn}
                                            onPressOut={handleClosePressOut}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                closeButtonAccessibilityLabel
                                            }
                                            style={[
                                                styles.closeButton,
                                                closeButtonAnimatedStyle,
                                                closeDisabled && styles.closeButtonDisabled,
                                                closeButtonStyle,
                                            ]}
                                        >
                                            {loading && disableCloseWhenLoading ? (
                                                <ActivityIndicator
                                                    size="small"
                                                    color="#8E8E93"
                                                />
                                            ) : (
                                                <X size={19} color="#8E8E93" />
                                            )}
                                        </AnimatedTouchableOpacity>
                                    )}
                                </View>
                            </Animated.View>
                        </View>

                        {scrollable ? (
                            <ScrollView
                                style={styles.bodyScroll}
                                contentContainerStyle={bodyContentDynamicStyle}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode={
                                    Platform.OS === 'ios' ? 'interactive' : 'on-drag'
                                }
                                nestedScrollEnabled
                                bounces
                                contentInsetAdjustmentBehavior="never"
                                {...scrollViewProps}
                            >
                                {children}
                            </ScrollView>
                        ) : (
                            <View style={bodyStaticDynamicStyle}>
                                {children}
                            </View>
                        )}

                        {footer && <View style={footerDynamicStyle}>{footer}</View>}
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },

    containerCenter: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },

    backdropWithTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.42)',
    },

    backdropTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.50)',
    },

    backdropDim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.72)',
    },

    keyboardAvoiding: {
        flex: 1,
        justifyContent: 'flex-end',
        width: '100%',
    },

    keyboardAvoidingCenter: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    sheet: {
        backgroundColor: MODAL_BACKGROUND,
        borderTopLeftRadius: 34,
        borderTopRightRadius: 34,
        overflow: 'hidden',

        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 0,
        borderColor: MODAL_BORDER,

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -18,
        },
        shadowOpacity: 0.32,
        shadowRadius: 30,
        elevation: 30,
    },

    sheetCenter: {
        borderRadius: 24,
        borderBottomWidth: 1,
        shadowOffset: {
            width: 0,
            height: 18,
        },
    },

    gestureArea: {
        paddingTop: 10,
        backgroundColor: MODAL_BACKGROUND,
    },

    handleWrapper: {
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
    },

    handle: {
        width: 42,
        height: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.28)',
    },

    header: {
        height: 58,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        backgroundColor: MODAL_BACKGROUND,
        paddingHorizontal: 18,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: IOS_SEPARATOR,
        position: 'relative',
    },

    titleCenterLayer: {
        position: 'absolute',
        left: 72,
        right: 72,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },

    titleStartContainer: {
        flex: 1,
        minWidth: 0,
        paddingRight: 12,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },

    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        zIndex: 2,
    },

    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.055)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.075)',
    },

    closeButtonDisabled: {
        opacity: 0.45,
    },

    title: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '600',
        letterSpacing: -0.1,
    },

    bodyScroll: {
        flexShrink: 1,
        backgroundColor: MODAL_BACKGROUND,
    },

    bodyContent: {
        paddingHorizontal: 24,
        paddingTop: 18,
        backgroundColor: MODAL_BACKGROUND,
    },

    bodyStatic: {
        paddingHorizontal: 24,
        paddingTop: 18,
        backgroundColor: MODAL_BACKGROUND,
    },

    footer: {
        paddingHorizontal: 24,
        paddingTop: 14,
        borderTopColor: MODAL_BORDER,
        backgroundColor: MODAL_BACKGROUND,
    },
});