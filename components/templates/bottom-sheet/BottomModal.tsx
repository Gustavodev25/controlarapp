import { ArrowLeft, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    KeyboardEvent,
    LayoutChangeEvent,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HANDLE_HEIGHT } from './conf';
import BottomSheet from './index';
import type { BottomSheetMethods } from './types';

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

export function BottomModal({
    visible,
    onClose,
    title,
    children,
    height = 'auto',
    rightElement,
    subtitle,
    onBack,
}: BottomModalProps) {
    const sheetRef = useRef<BottomSheetMethods>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [calculatedHeight, setCalculatedHeight] = useState<number>(0);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [isReady, setIsReady] = useState(height !== 'auto');

    const { height: windowHeight } = useWindowDimensions();

    // Listeners do Teclado (Otimizado por Plataforma)
    useEffect(() => {
        const handleKeyboardShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
        const handleKeyboardHide = () => setKeyboardHeight(0);

        // iOS lida melhor com animações via 'Will', Android geralmente via 'Did'
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
        const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    // Controle de estado de montagem e resete
    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            if (height === 'auto') {
                setIsReady(false);
                setCalculatedHeight(0);
            } else {
                setIsReady(true);
            }
        } else {
            sheetRef.current?.close();
        }
    }, [visible, height]);

    // Aplica a abertura do sheet apenas quando tudo estiver pronto
    useEffect(() => {
        if (visible && isReady && (height !== 'auto' || calculatedHeight > 0)) {
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        }
    }, [visible, isReady, calculatedHeight, height]);

    // Re-snap quando o teclado abre/fecha para mover o sheet para cima/baixo
    useEffect(() => {
        if (visible && isReady) {
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        }
    }, [keyboardHeight]);

    const handleClose = useCallback(() => {
        setIsMounted(false);
        onClose?.();
    }, [onClose]);

    // Otimização: SnapPoints precisos
    // HANDLE_HEIGHT é adicionado porque o BottomSheet subtrai esse valor
    // para calcular a área de conteúdo. Sem isso, o conteúdo ficaria cortado.
    const BOTTOM_SAFE_MARGIN = 20;
    const snapPoints = useMemo(() => {
        if (height === 'auto') {
            if (calculatedHeight > 0 && isReady) {
                const totalNeeded = calculatedHeight + HANDLE_HEIGHT + BOTTOM_SAFE_MARGIN;
                const capped = Math.min(totalNeeded, windowHeight * 0.9);
                if (keyboardHeight > 0) {
                    // Quando teclado abre, aumenta a altura para empurrar o sheet pra cima
                    const withKeyboard = capped + keyboardHeight;
                    return [Math.min(withKeyboard, windowHeight * 0.95)];
                }
                return [capped];
            }
            return [1]; // Painel imperceptível enquanto mede
        }

        if (typeof height === 'number') {
            if (keyboardHeight > 0) {
                // Aumenta o snap point para mover o sheet pra cima sem cortar conteúdo
                const withKeyboard = height + keyboardHeight;
                return [Math.min(withKeyboard, windowHeight * 0.95)];
            }
            return [height];
        }

        return [height]; // Retorna string (ex: '50%') sem modificar
    }, [height, calculatedHeight, windowHeight, keyboardHeight, isReady]);

    // Função que mede o conteúdo (Otimizada para evitar loop infinito)
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        if (height === 'auto' && !isReady) {
            const measuredHeight = Math.ceil(e.nativeEvent.layout.height);

            // Só atualiza se houver uma medida válida e diferente da atual
            if (measuredHeight > 0 && measuredHeight !== calculatedHeight) {
                setCalculatedHeight(measuredHeight);
                setIsReady(true);
            }
        }
    }, [height, isReady, calculatedHeight]);

    if (!visible && !isMounted) return null;

    const isAutoHeight = height === 'auto';

    return (
        <Modal
            transparent
            visible={visible || isMounted}
            animationType="none"
            onRequestClose={handleClose}
            statusBarTranslucent
            hardwareAccelerated
        >
            <GestureHandlerRootView style={styles.rootView}>
                <BottomSheet
                    ref={sheetRef}
                    snapPoints={snapPoints as any}
                    backgroundColor="#141414"
                    backdropOpacity={0.6}
                    borderRadius={24}
                    onClose={handleClose}
                >
                    <View
                        onLayout={handleLayout}
                        style={[
                            isAutoHeight ? styles.containerAuto : styles.containerFlex,
                            { opacity: isReady ? 1 : 0 }
                        ]}
                    >
                        <View style={styles.header}>
                            <View style={styles.headerRow}>
                                <View style={styles.headerLeftContainer}>
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
                                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                                        <X size={20} color="#909090" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View style={isAutoHeight ? styles.contentAuto : styles.content}>
                            {children}
                        </View>
                    </View>
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    rootView: {
        flex: 1,
    },
    containerFlex: {
        flex: 1,
    },
    containerAuto: {
        paddingBottom: 16,
    },
    header: {
        backgroundColor: '#141414',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        alignItems: 'center',
        paddingTop: 16,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    headerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 12,
    },
    headerRightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 13,
        color: '#8E8E93',
        marginTop: 2,
        fontWeight: '500',
        fontFamily: 'AROneSans_500Medium',
    },
    closeButton: {
        padding: 4,
        borderRadius: 20,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    contentAuto: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 4,
    },
});