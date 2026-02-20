import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal as RNModal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

interface CreditCardEditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave?: (cardData: any) => Promise<void> | void;
}

export function CreditCardEditModal({ visible, onClose, onSave }: CreditCardEditModalProps) {
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [expiry, setExpiry] = useState('');
    const [cvv, setCvv] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Formatters
    const formatCardNumber = (text: string) => {
        const cleaned = text.replace(/\s/g, '').replace(/\D/g, '');
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        return formatted.substring(0, 19);
    };

    const formatExpiryDate = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
        }
        return cleaned;
    };

    const handleSave = async () => {
        if (!cardNumber || !cardName || !expiry || !cvv) {
            Alert.alert('Erro', 'Preencha todos os campos do cartão.');
            return;
        }

        setIsSaving(true);

        try {
            if (onSave) {
                await onSave({ cardNumber, cardName, expiry, cvv });
            } else {
                // Default mock behavior if no prop provided
                await new Promise(resolve => setTimeout(resolve, 1500));
                Alert.alert('Sucesso', 'Seu cartão foi atualizado com sucesso!');
            }
            onClose();
            // Reset form
            setCardNumber('');
            setCardName('');
            setExpiry('');
            setCvv('');
        } catch (error) {
            Alert.alert('Erro', 'Falha ao salvar cartão.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <RNModal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalOverlay}
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <Animated.View
                    entering={ZoomIn.duration(300).springify()}
                    style={styles.modalContent}
                >
                    <View style={styles.editHeader}>
                        <Text style={styles.editTitle}>Novo Cartão</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.cancelLink}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Número do cartão</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0000 0000 0000 0000"
                            placeholderTextColor="#555"
                            keyboardType="numeric"
                            value={cardNumber}
                            onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                            maxLength={19}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nome no cartão</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="NOME COMO NO CARTÃO"
                            placeholderTextColor="#555"
                            autoCapitalize="characters"
                            value={cardName}
                            onChangeText={setCardName}
                        />
                    </View>

                    <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                            <Text style={styles.label}>Validade</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="MM/AA"
                                placeholderTextColor="#555"
                                keyboardType="numeric"
                                value={expiry}
                                onChangeText={(t) => setExpiry(formatExpiryDate(t))}
                                maxLength={5}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>CVV</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="123"
                                placeholderTextColor="#555"
                                keyboardType="numeric"
                                secureTextEntry
                                value={cvv}
                                onChangeText={setCvv}
                                maxLength={4}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.saveButtonText}>Salvar Cartão</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </KeyboardAvoidingView>
        </RNModal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 20,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: '#151515',
        width: '100%',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#252525',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.51,
        shadowRadius: 13.16,
        elevation: 20,
    },
    editHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    editTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    cancelLink: {
        fontSize: 14,
        color: '#8E8E93',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        color: '#8E8E93',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#1A1A1A',
        height: 48,
        borderRadius: 12,
        paddingHorizontal: 16,
        color: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#333',
        fontSize: 15,
    },
    rowInputs: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    saveButton: {
        backgroundColor: '#FFFFFF',
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#000000',
        fontSize: 15,
        fontWeight: '700',
    },
});
