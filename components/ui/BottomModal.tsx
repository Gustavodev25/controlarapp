import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { ArrowLeft, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    LayoutChangeEvent,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
    
    // NOVO: Controla se a medição da altura inteligente já terminou
    const [isReady, setIsReady] = useState(height !== 'auto');
    
    const { height: windowHeight } = useWindowDimensions();

    // Listeners do Teclado (agrupados e otimizados)
    useEffect(() => {
        const handleKeyboardShow = (e: any) => setKeyboardHeight(e.endCoordinates.height);
        const handleKeyboardHide = () => setKeyboardHeight(0);

        const subscriptions = [
            Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
            Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
            Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
            Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
        ];

        return () => {
            subscriptions.forEach((sub) => sub.remove());
        };
    }, []);

    // Reseta e reabre o modal corretamente
    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            if (height === 'auto') {
                setIsReady(false); // Força uma nova medição ao abrir
                setCalculatedHeight(0);
            } else {
                requestAnimationFrame(() => sheetRef.current?.snapToIndex(0));
            }
        } else {
            sheetRef.current?.close();
        }
    }, [visible, height]);

    // Aplica a abertura apenas quando a medição inteligente terminar
    useEffect(() => {
        if (height === 'auto' && isReady && calculatedHeight > 0) {
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        }
    }, [isReady, calculatedHeight, height, keyboardHeight]);

    const handleClose = useCallback(() => {
        setIsMounted(false);
        if (onClose) onClose();
    }, [onClose]);

    // Otimização: SnapPoints precisos e sem sobras
    const snapPoints = useMemo(() => {
        if (height === 'auto') {
            if (calculatedHeight > 0) {
                // Limita a altura máxima a 90% da tela para não cobrir tudo
                const capped = Math.min(calculatedHeight, windowHeight * 0.9);
                
                // Reduz o espaço do teclado, se ele estiver aberto
                if (keyboardHeight > 0) {
                    return [Math.min(capped, windowHeight - keyboardHeight - 20)];
                }
                return [capped];
            }
            // NOVO: Retorna 1px enquanto mede para não mostrar um painel vazio gigante
            return [1];
        }

        // Se uma altura fixa foi passada, respeita ela e o teclado (removemos o "90%" hardcoded que gerava vazio)
        return [
            typeof height === 'number'
                ? (keyboardHeight > 0 ? Math.min(height, windowHeight - keyboardHeight - 20) : height)
                : height
        ];
    }, [height, calculatedHeight, windowHeight, keyboardHeight]);

    // Função que mede o conteúdo inteligentemente
    const handleLayout = useCallback((e: LayoutChangeEvent) => {
        if (height === 'auto') {
            // Pega a altura estritamente necessária pelo conteúdo + paddings da view
            const measuredHeight = Math.ceil(e.nativeEvent.layout.height);
            setCalculatedHeight(measuredHeight);
            setIsReady(true); // Medição concluída, pode mostrar!
        }
    }, [height]);

    if (!visible && !isMounted) return null;

    const containerStyle = height === 'auto' ? styles.containerAuto : styles.containerFlex;
    const contentStyle = height === 'auto' ? styles.contentAuto : styles.content;

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
                            containerStyle,
                            // NOVO: Esconde visualmente enquanto calcula para não dar "pulo" na tela
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

                        <View style={contentStyle}>
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
        paddingBottom: 24,
        // Propositalmente sem flex: 1 para que a view abrace apenas o conteúdo necessário
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
        padding: 20,
    },
});