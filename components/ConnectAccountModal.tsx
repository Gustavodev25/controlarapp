import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

interface ConnectAccountModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    connectionStep: string;
    banksCount?: number;
    isBanksLoading?: boolean;
    credentialsCount?: number;
    onBack?: () => void;
    rightElement?: React.ReactNode;
    searchElement?: React.ReactNode;
    warningText?: string;
    overlayElement?: React.ReactNode;
    onDismiss?: () => void;
}

export function ConnectAccountModal({
    visible,
    onClose,
    title,
    subtitle,
    children,
    connectionStep,
    banksCount = 0,
    isBanksLoading = false,
    credentialsCount = 0,
    onBack,
    rightElement,
    searchElement,
    warningText,
    overlayElement,
    onDismiss,
}: ConnectAccountModalProps) {
    const [isModalMounted, setIsModalMounted] = useState(false);
    const { width, height } = useWindowDimensions();
    const isNarrowPhone = width < 360;
    const isShortPhone = height < 700;

    useEffect(() => {
        if (visible) {
            setIsModalMounted(true);
        } else {
            setIsModalMounted(false);
        }
    }, [visible]);

    const handleClose = () => {
        setIsModalMounted(false);
        onClose();
    };

    return (
        <Modal
            visible={isModalMounted}
            transparent={false}
            animationType="slide"
            statusBarTranslucent
            onRequestClose={handleClose}
            onDismiss={onDismiss}
        >
            <SafeAreaView style={styles.safeArea}>
                <View
                    style={[
                        styles.container,
                        isShortPhone && styles.containerShort
                    ]}
                >
                    <View
                        style={[
                            styles.header,
                            isNarrowPhone && styles.headerNarrow,
                            isShortPhone && styles.headerShort
                        ]}
                    >
                        <TouchableOpacity onPress={handleClose} hitSlop={10} style={styles.backButton}>
                            <ArrowLeft size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text
                                style={[styles.title, isNarrowPhone && styles.titleNarrow]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.84}
                            >
                                {title}
                            </Text>
                            {subtitle && (
                                <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
                            )}
                            {warningText && (
                                <Text style={styles.warningText} numberOfLines={2}>{warningText}</Text>
                            )}
                        </View>
                        {searchElement && (
                            <View style={[styles.searchWrapper, isShortPhone && styles.searchWrapperShort]}>
                                {searchElement}
                            </View>
                        )}
                    </View>
                    <View style={styles.content}>
                        {children}
                    </View>
                </View>
                {overlayElement}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
        paddingTop: Platform.OS === 'android' ? 40 : 0,
    },
    containerShort: {
        paddingTop: Platform.OS === 'android' ? 28 : 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#0A0A0A',
    },
    headerNarrow: {
        paddingHorizontal: 12,
    },
    headerShort: {
        paddingTop: 10,
        paddingBottom: 8,
    },
    searchWrapper: {
        marginTop: 12,
        width: '100%',
        alignSelf: 'stretch',
    },
    searchWrapperShort: {
        marginTop: 8,
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: 4,
        marginBottom: 12,
    },
    titleContainer: {
        flexDirection: 'column',
    },
    title: {
        fontSize: 24,
        color: '#FFFFFF',
        fontFamily: 'AROneSans_400Regular',
    },
    titleNarrow: {
        fontSize: 21,
    },
    subtitle: {
        fontSize: 15,
        color: '#909090',
        marginTop: 2,
        fontFamily: 'AROneSans_400Regular',
    },
    warningText: {
        fontSize: 11,
        color: '#FF9F0A',
        marginTop: 4,
    },
    content: {
        flex: 1,
    }
});
