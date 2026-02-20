import BottomSheet from '@/components/templates/bottom-sheet';
import { BottomSheetMethods } from '@/components/templates/bottom-sheet/types';
import { useToast } from '@/contexts/ToastContext';
import { databaseService } from '@/services/firebase';
import { AlertCircle, Calendar as CalendarIcon, Save, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface CreditCardSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    account: any;
    onSave: () => void;

}

export function CreditCardSettingsModal({
    visible,
    onClose,
    userId,
    account,
    onSave,

}: CreditCardSettingsModalProps) {
    const { showSuccess, showError } = useToast();

    // Data de Fechamento Base (quando a última fatura fechou)
    const [closingDate, setClosingDate] = useState('');
    const [loading, setSaving] = useState(false);
    const [dataSource, setDataSource] = useState<'pluggy' | 'manual' | 'default'>('default');
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    // Helper to safely parse a date string that may come in different formats
    const safeParseDateString = (dateStr: string | undefined | null): Date | null => {
        if (!dateStr) return null;
        // Handle both ISO with timestamp (YYYY-MM-DDTHH:mm:ss.sssZ) and just date (YYYY-MM-DD)
        const testDate = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
        return isNaN(testDate.getTime()) ? null : testDate;
    };

    // Helper to validate a date string
    const isValidDateString = (dateStr: string | undefined | null): boolean => {
        return safeParseDateString(dateStr) !== null;
    };

    // Helper to convert Date to ISO string
    const toIsoDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Format YYYY-MM-DD to DD/MM/YYYY
    const formatDateForDisplay = (isoDate: string) => {
        if (!isoDate) return '';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    };

    const sheetRef = useRef<BottomSheetMethods>(null);
    const scrollViewRef = useRef<ScrollView>(null);
    const [isModalMounted, setIsModalMounted] = useState(false);

    // Listener para expandir o BottomSheet quando o teclado abrir
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const keyboardShowListener = Keyboard.addListener(showEvent, (e) => {
            setKeyboardHeight(e.endCoordinates.height);
            // Expandir o BottomSheet para o snap point máximo quando o teclado abrir
            sheetRef.current?.snapToIndex(1);
        });

        const keyboardHideListener = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
            // Voltar ao tamanho original quando o teclado fechar
            sheetRef.current?.snapToIndex(0);
        });

        return () => {
            keyboardShowListener.remove();
            keyboardHideListener.remove();
        };
    }, []);

    // Initial load - Prioridade: 1. Manual (usuário), 2. currentBill (Pluggy), 3. balanceCloseDate (Pluggy), 4. Default
    useEffect(() => {
        if (!visible) {
            if (isModalMounted) {
                sheetRef.current?.close();
            }
            return;
        }

        setIsModalMounted(true);
        requestAnimationFrame(() => {
            sheetRef.current?.snapToIndex(0);
        });

        console.log('[CreditCardSettings] Modal aberto/atualizado');
        console.log('[CreditCardSettings] Account data:', {
            id: account?.id,
            name: account?.name,
            currentBillDueDate: account?.currentBill?.dueDate,
            balanceCloseDate: account?.balanceCloseDate,
            balanceDueDate: account?.balanceDueDate,
            closingDateSettings: account?.closingDateSettings
        });

        // ==========================================
        // CARREGAR DATA DE FECHAMENTO
        // ==========================================
        // APENAS carregar se já existe configuração manual salva
        // Se não tiver, deixar o campo VAZIO para o usuário preencher
        if (account?.closingDateSettings?.lastClosingDate && isValidDateString(account.closingDateSettings.lastClosingDate)) {
            const formattedDate = formatDateForDisplay(account.closingDateSettings.lastClosingDate);
            console.log('[CreditCardSettings] Carregando data salva:', formattedDate);
            setClosingDate(formattedDate);
            setDataSource('manual');
        } else {
            // Deixar o campo VAZIO - o usuário deve configurar manualmente
            console.log('[CreditCardSettings] Nenhuma configuração encontrada, campo vazio');
            setClosingDate('');
            setDataSource('default');
        }
    }, [account, visible, isModalMounted]);

    const handleBottomSheetClose = () => {
        setIsModalMounted(false);
        onClose();
    };

    // Format DD/MM/YYYY to YYYY-MM-DD for storage/logic
    const parseDateFromDisplay = (displayDate: string) => {
        if (!displayDate || displayDate.length < 10) return null; // DD/MM/YYYY = 10 chars

        const parts = displayDate.split('/');
        if (parts.length !== 3) return null;

        const [day, month, year] = parts;

        // Validar que todos os parts são números válidos
        const dayNum = parseInt(day, 10);
        const monthNum = parseInt(month, 10);
        const yearNum = parseInt(year, 10);

        if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return null;
        if (dayNum < 1 || dayNum > 31) return null;
        if (monthNum < 1 || monthNum > 12) return null;
        if (yearNum < 1900 || yearNum > 2100) return null;

        // Padronizar com zeros à esquerda
        const paddedDay = String(dayNum).padStart(2, '0');
        const paddedMonth = String(monthNum).padStart(2, '0');

        return `${yearNum}-${paddedMonth}-${paddedDay}`;
    };

    const handleDateChange = (text: string, setter: (val: string) => void) => {
        // Simple mask for DD/MM/YYYY
        let cleaned = text.replace(/\D/g, '');
        if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);

        let formatted = cleaned;
        if (cleaned.length >= 3) {
            formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
        }
        if (cleaned.length >= 5) {
            formatted = `${formatted.slice(0, 5)}/${cleaned.slice(4)}`;
        }
        setter(formatted);
    };

    const handleSave = async () => {
        console.log('[CreditCardSettings] Iniciando salvamento...');
        console.log('[CreditCardSettings] Data de fechamento digitada:', closingDate);

        setSaving(true);
        try {
            const isoClosingDate = parseDateFromDisplay(closingDate);
            console.log('[CreditCardSettings] Data convertida para ISO:', isoClosingDate);

            if (!isoClosingDate) {
                console.error('[CreditCardSettings] Data inválida:', closingDate);
                showError('Data inválida', 'Informe uma data válida no formato DD/MM/AAAA');
                setSaving(false);
                return;
            }

            console.log('[CreditCardSettings] Salvando configuração para conta:', account.id);
            console.log('[CreditCardSettings] Dados a salvar:', {
                lastClosingDate: isoClosingDate,
                currentClosingDate: calculateNextClosing(isoClosingDate)
            });

            // Salvar apenas lastClosingDate - o vencimento vem automaticamente do Pluggy
            const result = await databaseService.updateAccount(userId, account.id, {
                closingDateSettings: {
                    lastClosingDate: isoClosingDate,
                    // Mantemos currentClosingDate por compatibilidade
                    currentClosingDate: calculateNextClosing(isoClosingDate),
                    updatedAt: new Date().toISOString()
                }
            });

            console.log('[CreditCardSettings] Resultado do salvamento:', result);

            if (result.success) {
                console.log('[CreditCardSettings] Configuração salva com sucesso!');
                showSuccess('Configuração salva com sucesso!');
                onSave();
                sheetRef.current?.close();
            } else {
                console.error('[CreditCardSettings] Erro ao salvar:', result.error);
                showError('Erro ao salvar', result.error || 'Não foi possível salvar a configuração');
            }
        } catch (error) {
            console.error('[CreditCardSettings] Erro ao salvar configurações:', error);
            showError('Erro ao salvar', 'Ocorreu um erro ao salvar a configuração');
        } finally {
            setSaving(false);
        }
    };

    // Calcular próximo fechamento a partir da data base
    const calculateNextClosing = (baseIsoDate: string) => {
        const parts = baseIsoDate.split('-').map(Number);
        const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);
        baseDate.setMonth(baseDate.getMonth() + 1);
        return toIsoDate(baseDate);
    };








    return (
        <Modal visible={isModalMounted} transparent animationType="none" statusBarTranslucent hardwareAccelerated>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <BottomSheet
                        ref={sheetRef}
                        snapPoints={["50%", "90%"]}
                        backgroundColor="#141414"
                        backdropOpacity={0.6}
                        borderRadius={24}
                        onClose={handleBottomSheetClose}
                    >
                        <View style={styles.header}>
                            <Text style={styles.title}>Configurar Fatura</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.headerSaveButton}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#D97757" />
                                    ) : (
                                        <>
                                            <Save size={18} color="#D97757" />
                                            <Text style={styles.headerSaveText}>Salvar</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => sheetRef.current?.close()}>
                                    <X size={20} color="#909090" />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <ScrollView
                            ref={scrollViewRef}
                            contentContainerStyle={[styles.container, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >



                            <Text style={styles.sectionHeader}>CONFIGURAÇÃO</Text>
                            <View style={styles.sectionCard}>
                                <View style={styles.itemContainer}>
                                    <View style={styles.itemIconContainer}>
                                        <CalendarIcon size={20} color="#E0E0E0" />
                                    </View>
                                    <View style={styles.itemRightContainer}>
                                        <View style={styles.itemContent}>
                                            <Text style={styles.itemTitle}>Data do Fechamento</Text>
                                            <TextInput
                                                style={styles.inputRight}
                                                value={closingDate}
                                                onChangeText={(t) => handleDateChange(t, setClosingDate)}
                                                placeholder="DD/MM/AAAA"
                                                placeholderTextColor="#666"
                                                keyboardType="numeric"
                                                maxLength={10}
                                            />
                                        </View>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.helpContainer}>
                                <View style={styles.helpHeaderRow}>
                                    <AlertCircle size={18} color="#D97757" />
                                    <Text style={styles.helpTitle}>Como preencher?</Text>
                                </View>
                                <Text style={styles.helpText}>
                                    Informe a data exata do fechamento da sua <Text style={styles.helpTextBold}>última fatura encerrada (já fechada)</Text>.
                                </Text>
                                <Text style={[styles.helpText, { marginTop: 8 }]}>
                                    O sistema usará essa data base para calcular os próximos ciclos automaticamente.
                                </Text>
                                <Text style={[styles.helpText, { marginTop: 8, opacity: 0.8 }]}>
                                    Ex: Se sua fatura fecha todo dia 01, e a de Janeiro já fechou, informe <Text style={styles.helpTextBold}>01/01/2026</Text>.
                                </Text>
                            </View>








                        </ScrollView>
                    </BottomSheet>
                </GestureHandlerRootView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        backgroundColor: '#141414',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    container: {
        padding: 20,
        paddingBottom: 40
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
        marginTop: 10,
        marginBottom: 8,
        marginLeft: 4,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2A2A2A',
        marginBottom: 10
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        minHeight: 56,
        position: 'relative',
    },
    itemIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginLeft: 16,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 16,
        paddingVertical: 16,
    },
    itemTitle: {
        fontSize: 16,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    inputRight: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'right',
        minWidth: 100
    },
    headerSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 4,
        paddingHorizontal: 8,
    },
    headerSaveText: {
        color: '#D97757',
        fontSize: 14,
        fontWeight: '600'
    },
    helpContainer: {
        backgroundColor: '#1A1A1A',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        marginTop: 4
    },
    helpHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    helpTitle: {
        fontSize: 14,
        color: '#D97757',
        fontWeight: '600'
    },
    helpText: {
        fontSize: 13,
        color: '#CCC',
        lineHeight: 18
    },
    helpTextBold: {
        fontWeight: '700',
        color: '#FFF'
    }
});
