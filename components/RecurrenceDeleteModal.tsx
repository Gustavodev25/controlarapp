import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { Trash2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecurrenceDeleteModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
}

export function RecurrenceDeleteModal({
    visible,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Excluir",
    cancelText = "Cancelar"
}: RecurrenceDeleteModalProps) {
    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Excluir"
        >
             <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Trash2 size={48} color="#FF453A" />
                </View>
                <Text style={styles.title}>{title}</Text>
                {message && <Text style={styles.message}>{message}</Text>}

                <View style={styles.actions}>
                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelText}>{cancelText}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={() => { onConfirm(); onClose(); }}>
                        <Text style={styles.confirmText}>{confirmText}</Text>
                    </TouchableOpacity>
                </View>
             </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: 16,
        paddingBottom: 16
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFF',
        textAlign: 'center'
    },
    message: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        marginBottom: 8
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 8
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#2A2A2A',
        alignItems: 'center'
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FF453A',
        alignItems: 'center'
    },
    cancelText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16
    },
    confirmText: {
        color: '#FFF',
        fontWeight: '600',
        fontSize: 16
    }
});
