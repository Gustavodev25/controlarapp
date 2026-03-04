import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
}: ConnectAccountModalProps) {
    const [isModalMounted, setIsModalMounted] = useState(false);

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
        >
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} hitSlop={10} style={styles.backButton}>
                            <ArrowLeft size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>{title}</Text>
                            {subtitle && (
                                <Text style={styles.subtitle}>{subtitle}</Text>
                            )}
                            {warningText && (
                                <Text style={styles.warningText}>{warningText}</Text>
                            )}
                        </View>
                        {searchElement && <View style={styles.searchWrapper}>{searchElement}</View>}
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
        backgroundColor: '#141414',
    },
    container: {
        flex: 1,
        backgroundColor: '#141414',
        paddingTop: Platform.OS === 'android' ? 40 : 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#141414',
    },
    searchWrapper: {
        marginTop: 12,
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
        fontWeight: '700',
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 15,
        color: '#909090',
        marginTop: 2,
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
