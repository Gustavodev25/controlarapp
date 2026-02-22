import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { ArrowLeft, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface ConnectAccountModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    connectionStep: string;
    banksCount?: number;
    isBanksLoading?: boolean;
    credentialsCount?: number;
    onBack?: () => void;
    rightElement?: React.ReactNode;
    searchElement?: React.ReactNode;
    warningText?: string;
}

export function ConnectAccountModal({
    visible,
    onClose,
    title,
    children,
    connectionStep,
    banksCount = 0,
    isBanksLoading = false,
    credentialsCount = 0,
    onBack,
    rightElement,
    searchElement,
    warningText,
}: ConnectAccountModalProps) {
    const sheetRef = React.useRef<BottomSheetMethods>(null);
    const [isModalMounted, setIsModalMounted] = useState(false);

    // Determinar snapPoints baseado no connectionStep
    const getSnapPoints = () => {
        if (connectionStep === 'banks') {
            if (isBanksLoading) {
                return ["70%", "85%"];
            }
            if (banksCount <= 3) {
                return ["48%", "65%"];
            }
            if (banksCount <= 6) {
                return ["60%", "78%"];
            }
            return ["85%", "90%"];
        }
        if (connectionStep === 'credentials') {
            if (credentialsCount <= 1) {
                return ["42%", "56%"];
            }
            if (credentialsCount <= 3) {
                return ["50%", "65%"];
            }
            return ["60%", "72%"];
        }
        return ["60%", "70%"];
    };

    useEffect(() => {
        if (visible) {
            setIsModalMounted(true);
            requestAnimationFrame(() => {
                sheetRef.current?.snapToIndex(0);
            });
        } else if (isModalMounted) {
            sheetRef.current?.close();
        }
    }, [visible, isModalMounted]);

    const handleBottomSheetClose = () => {
        setIsModalMounted(false);
        onClose();
    };

    return (
        <Modal visible={isModalMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheet
                    ref={sheetRef}
                    snapPoints={getSnapPoints()}
                    backgroundColor="#141414"
                    backdropOpacity={0.6}
                    borderRadius={24}
                    onClose={handleBottomSheetClose}
                >
                    <View style={styles.header}>
                        <View style={styles.headerTopRow}>
                            <View style={styles.headerLeft}>
                                {onBack && (
                                    <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backButton}>
                                        <ArrowLeft size={24} color="#FFFFFF" />
                                    </TouchableOpacity>
                                )}
                                <View style={styles.titleContainer}>
                                    <Text style={styles.title}>{title}</Text>
                                    {warningText && (
                                        <Text style={styles.warningText}>{warningText}</Text>
                                    )}
                                </View>
                            </View>
                            <View style={styles.headerRight}>
                                {rightElement}
                                <TouchableOpacity onPress={() => sheetRef.current?.close()}>
                                    <X size={20} color="#909090" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {searchElement && <View style={styles.searchWrapper}>{searchElement}</View>}
                    </View>
                    {children}
                </BottomSheet>
            </GestureHandlerRootView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        backgroundColor: '#141414',
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    searchWrapper: {
        marginTop: 12,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
    },
    backButton: {
        padding: 4,
    },
    titleContainer: {
        flexDirection: 'column',
        flex: 1,
        marginRight: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    warningText: {
        fontSize: 11,
        color: '#FF9F0A',
        marginTop: 4,
    },
});
