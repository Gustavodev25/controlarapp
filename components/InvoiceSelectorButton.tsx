/**
 * Invoice Selector Button - Botão compacto para selecionar fatura
 * Usado inline nas listas de transações
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { formatMonthKey } from '../services/invoiceService';
import { InvoiceOption, InvoiceSelectorModal } from './InvoiceSelectorModal';

interface InvoiceSelectorButtonProps {
    currentInvoiceMonth: string;
    availableInvoices: InvoiceOption[];
    onMoveToInvoice: (targetMonth: string) => void;
    onRemoveOverride?: () => void;
    hasManualOverride: boolean;
}

export const InvoiceSelectorButton: React.FC<InvoiceSelectorButtonProps> = ({
    currentInvoiceMonth,
    availableInvoices,
    onMoveToInvoice,
    onRemoveOverride,
    hasManualOverride
}) => {
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <>
            <TouchableOpacity
                style={[
                    styles.container,
                    hasManualOverride && styles.containerManual
                ]}
                onPress={() => setModalVisible(true)}
            >
                {hasManualOverride && (
                    <Ionicons name="create" size={10} color="#9333EA" />
                )}
                <Text style={[
                    styles.text,
                    hasManualOverride && styles.textManual
                ]}>
                    {formatMonthKey(currentInvoiceMonth)}
                </Text>
                <Ionicons
                    name="chevron-down"
                    size={12}
                    color={hasManualOverride ? '#9333EA' : '#888'}
                />
            </TouchableOpacity>

            <InvoiceSelectorModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                currentInvoiceMonth={currentInvoiceMonth}
                availableInvoices={availableInvoices}
                onMoveToInvoice={onMoveToInvoice}
                onRemoveOverride={onRemoveOverride}
                hasManualOverride={hasManualOverride}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    containerManual: {
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderColor: 'rgba(147, 51, 234, 0.3)'
    },
    text: {
        fontSize: 10,
        fontWeight: '600',
        color: '#888'
    },
    textManual: {
        color: '#9333EA'
    }
});
