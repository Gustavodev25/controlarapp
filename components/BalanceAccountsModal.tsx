import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { databaseService } from '@/services/firebase';
import { Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ModernSwitch } from './ui/ModernSwitch';

const { height: windowHeight } = Dimensions.get('window');


interface BankAccount {
    id: string;
    name: string;
    balance: number;
    type: string;
    subtype?: string;
    connector?: {
        name?: string;
        primaryColor?: string;
        imageUrl?: string;
    };
}

interface BalanceAccountsModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    accounts: BankAccount[];
    selectedAccountIds: string[];
    onSave: (selectedIds: string[]) => void;
}

export function BalanceAccountsModal({
    visible,
    onClose,
    userId,
    accounts,
    selectedAccountIds,
    onSave,
}: BalanceAccountsModalProps) {
    const [selected, setSelected] = useState<string[]>(selectedAccountIds);
    const [loading, setLoading] = useState(false);

    // Sync with props when modal opens
    useEffect(() => {
        if (visible) {
            setSelected(selectedAccountIds);
        }
    }, [visible, selectedAccountIds]);

    // Show all non-savings accounts. The toggle controls which ones are included in saldo.
    const displayedAccounts = accounts.filter(account =>
        account.subtype !== 'SAVINGS_ACCOUNT'
    );

    const toggleAccount = (accountId: string) => {
        setSelected(prev => {
            if (prev.includes(accountId)) {
                return prev.filter(id => id !== accountId);
            }
            return [...prev, accountId];
        });
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await databaseService.updatePreference(userId, {
                balanceAccountIds: selected
            });

            onSave(selected);
            onClose();
        } catch (error) {
            console.error('Error saving balance preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Minhas Contas"
            headerRight={
                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.headerSaveButton}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#D97757" />
                    ) : (
                        <Text style={styles.headerSaveText}>Salvar</Text>
                    )}
                </TouchableOpacity>
            }
        >
            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: windowHeight * 0.7 }}
            >
                {/* Accounts List */}
                <Text style={styles.sectionHeader}>CONTAS DISPONÍVEIS</Text>
                <View style={styles.sectionCard}>
                    {displayedAccounts.map((account, index) => {
                        const isSelected = selected.includes(account.id);
                        const isLast = index === displayedAccounts.length - 1;

                        return (
                            <View
                                key={account.id}
                                style={[
                                    styles.itemContainer,
                                    !isLast && styles.itemBorder
                                ]}
                            >
                                <View style={[
                                    styles.itemIconContainer,
                                    { backgroundColor: account.connector?.primaryColor || '#252525' }
                                ]}>
                                    <Wallet size={18} color="#FFFFFF" />
                                </View>

                                <View style={styles.itemContent}>
                                    <View style={styles.itemInfo}>
                                        <Text style={styles.itemTitle} numberOfLines={1}>
                                            {account.name || account.connector?.name || 'Conta'}
                                        </Text>
                                        <Text style={styles.itemSubtitle}>
                                            {account.subtype === 'CHECKING_ACCOUNT' ? 'Conta Corrente' :
                                                account.subtype === 'SAVINGS_ACCOUNT' ? 'Poupança' : 'Conta'}
                                        </Text>
                                    </View>

                                    <View style={styles.itemRight}>
                                        <Text style={[
                                            styles.itemBalance,
                                            account.balance >= 0 ? styles.positiveValue : styles.negativeValue
                                        ]}>
                                            {formatCurrency(account.balance || 0)}
                                        </Text>

                                        <ModernSwitch
                                            value={isSelected}
                                            onValueChange={() => toggleAccount(account.id)}
                                            activeColor="#d97757"
                                            width={44}
                                            height={24}
                                        />
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20
    },
    positiveValue: {
        color: '#04D361'
    },
    negativeValue: {
        color: '#FF4C4C'
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8E8E93',
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
        borderColor: '#2A2A2A'
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    itemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A'
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    itemInfo: {
        flex: 1,
        marginRight: 12
    },
    itemTitle: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '500',
        marginBottom: 2
    },
    itemSubtitle: {
        fontSize: 13,
        color: '#666'
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    itemBalance: {
        fontSize: 14,
        fontWeight: '600',
        marginRight: 12
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
        fontSize: 16,
        fontWeight: 'bold'
    }
});
