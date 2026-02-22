/**
 * Invoice Selector Modal - Modal para selecionar a fatura de uma transação
 * Permite mover transações entre faturas manualmente
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

export interface InvoiceOption {
    monthKey: string;
    label: string;
    isCurrent: boolean;
}

interface InvoiceSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    currentInvoiceMonth: string;
    availableInvoices: InvoiceOption[];
    onMoveToInvoice: (targetMonth: string) => void;
    onRemoveOverride?: () => void;
    hasManualOverride: boolean;
}

export const InvoiceSelectorModal: React.FC<InvoiceSelectorModalProps> = ({
    visible,
    onClose,
    currentInvoiceMonth,
    availableInvoices,
    onMoveToInvoice,
    onRemoveOverride,
    hasManualOverride
}) => {
    const handleSelectInvoice = (monthKey: string) => {
        onMoveToInvoice(monthKey);
        onClose();
    };

    const handleRemoveOverride = () => {
        if (onRemoveOverride) {
            onRemoveOverride();
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Mover para fatura</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Info sobre override manual */}
                    {hasManualOverride && (
                        <View style={styles.infoBox}>
                            <Ionicons name="information-circle" size={20} color="#9333EA" />
                            <Text style={styles.infoText}>
                                Esta transação foi movida manualmente
                            </Text>
                        </View>
                    )}

                    {/* Lista de faturas */}
                    <ScrollView style={styles.scrollView}>
                        {availableInvoices.map((invoice) => {
                            const isSelected = invoice.monthKey === currentInvoiceMonth;

                            return (
                                <TouchableOpacity
                                    key={invoice.monthKey}
                                    style={[
                                        styles.invoiceOption,
                                        isSelected && styles.invoiceOptionSelected
                                    ]}
                                    onPress={() => handleSelectInvoice(invoice.monthKey)}
                                    disabled={isSelected}
                                >
                                    <View style={styles.invoiceOptionContent}>
                                        <Text style={[
                                            styles.invoiceLabel,
                                            isSelected && styles.invoiceLabelSelected
                                        ]}>
                                            {invoice.label}
                                        </Text>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Botão para remover override */}
                    {hasManualOverride && onRemoveOverride && (
                        <TouchableOpacity
                            style={styles.removeOverrideButton}
                            onPress={handleRemoveOverride}
                        >
                            <Ionicons name="refresh" size={20} color="#EF4444" />
                            <Text style={styles.removeOverrideText}>
                                Voltar ao cálculo automático
                            </Text>
                        </TouchableOpacity>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContainer: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        maxHeight: '80%',
        overflow: 'hidden'
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A'
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFF'
    },
    closeButton: {
        padding: 4
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        padding: 12,
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(147, 51, 234, 0.3)'
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        color: '#C084FC',
        fontWeight: '500'
    },
    scrollView: {
        maxHeight: 400,
        padding: 20
    },
    invoiceOption: {
        backgroundColor: '#252525',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2A2A2A'
    },
    invoiceOptionSelected: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: '#10B981'
    },
    invoiceOptionContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    invoiceLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF'
    },
    invoiceLabelSelected: {
        color: '#10B981'
    },
    removeOverrideButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 16,
        marginHorizontal: 20,
        marginVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)'
    },
    removeOverrideText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#EF4444'
    }
});
