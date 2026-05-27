import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { ModernSwitch } from '@/components/ui/ModernSwitch';
import { AuthButton } from '@/components/ui/AuthButton';
import { databaseService } from '@/services/firebase';
import { Wallet } from 'lucide-react-native';
import React, { useEffect, useState, useRef } from 'react';
import LottieView from 'lottie-react-native';
import {
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { height: windowHeight } = Dimensions.get('window');


interface BankAccount {
    id: string;
    name: string;
    balance: number;
    type: string;
    subtype?: string;
    number?: string;
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
    const lottieRef = useRef<LottieView>(null);


    // Sync with props when modal opens
    useEffect(() => {
        if (visible) {
            setSelected(selectedAccountIds);
        }
    }, [visible, selectedAccountIds]);

    const displayedAccounts = (accounts || []).filter(account => {
        const isCheckingType = account.type === 'BANK' || account.type === 'checking' || account.subtype === 'CHECKING_ACCOUNT';
        const isCreditType = account.type === 'credit' || account.type === 'CREDIT' || account.type === 'CREDIT_CARD' || account.subtype === 'CREDIT_CARD';
        const isSavingsType = account.type === 'SAVINGS' || account.subtype === 'SAVINGS_ACCOUNT' || account.subtype === 'SAVINGS';
        const isInvestmentType = account.type === 'INVESTMENT';
        
        const nameLower = (account.name || '').toLowerCase();
        const isSavingsByName = nameLower.includes('poupança') || nameLower.includes('poupanca') || nameLower.includes('savings');
        const isCaixinhaByName = nameLower.includes('caixinha') || nameLower.includes('invest');

        return isCheckingType && !isCreditType && !isSavingsType && !isInvestmentType && !isSavingsByName && !isCaixinhaByName;
    });

    // Play lottie animation periodically when empty state is visible
    useEffect(() => {
        if (visible && (displayedAccounts?.length || 0) === 0) {
            const initialTimeout = setTimeout(() => {
                lottieRef.current?.play();
            }, 500);

            const interval = setInterval(() => {
                lottieRef.current?.play();
            }, 5000);

            return () => {
                clearTimeout(initialTimeout);
                clearInterval(interval);
            };
        }
    }, [visible, displayedAccounts?.length]);

    // Count occurrences of each name to add indexes if necessary
    const nameTotals = (displayedAccounts || []).reduce((acc, account) => {
        const name = account.name || account.connector?.name || 'Conta';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const nameCurrentCounts: Record<string, number> = {};

    const toggleAccount = (accountId: string) => {
        setSelected(prev => {
            if (prev.includes(accountId)) {
                return prev.filter(id => id !== accountId);
            }
            return [...prev, accountId];
        });
    };

    const handleSave = () => {
        onSave(selected);
        onClose();

        databaseService.updatePreference(userId, {
            balanceAccountIds: selected
        }).catch((error) => {
            console.error('Error saving balance preferences:', error);
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const Footer = () => (
        <AuthButton
            title="Salvar Alterações"
            onPress={handleSave}
        />
    );

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title="Contas Bancárias"
            titleAlign="start"
            footer={<Footer />}
        >
            <View style={styles.container}>
                {/* Accounts List */}
                {(displayedAccounts?.length || 0) === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <LottieView
                            ref={lottieRef}
                            source={require('@/assets/banco.json')}
                            autoPlay={false}
                            loop={false}
                            style={styles.emptyStateLottie}
                        />
                        <Text style={styles.emptyStateTitle}>Nenhuma conta</Text>
                        <Text style={styles.emptyStateDescription}>
                            Conecte uma conta para ver seu saldo.
                        </Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.sectionHeader}>CONTAS DISPONÍVEIS</Text>
                        <View style={styles.sectionCard}>
                            {displayedAccounts.map((account, index) => {
                                const isSelected = selected.includes(account.id);
                                const isLast = index === displayedAccounts.length - 1;

                                const baseName = account.name || account.connector?.name || 'Conta';
                                nameCurrentCounts[baseName] = (nameCurrentCounts[baseName] || 0) + 1;
                                
                                const hasDuplicates = nameTotals[baseName] > 1;
                                const accountNumberSuffix = account.number ? account.number.replace(/\D/g, '').slice(-4) : null;
                                
                                let displayName = baseName;
                                if (hasDuplicates) {
                                    if (accountNumberSuffix) {
                                        displayName = `${baseName} • ${accountNumberSuffix}`;
                                    } else {
                                        displayName = `${baseName} #${nameCurrentCounts[baseName]}`;
                                    }
                                }

                                let subtitle = 'Conta Corrente';
                                if (!hasDuplicates && accountNumberSuffix) {
                                    subtitle = `Conta Corrente • Final ${accountNumberSuffix}`;
                                }

                                return (
                                    <View key={account.id} style={!isLast && styles.itemBorder}>
                                        <TouchableOpacity
                                            activeOpacity={0.7}
                                            onPress={() => toggleAccount(account.id)}
                                            style={[
                                                styles.itemContainer,
                                                !isSelected && { opacity: 0.35 }
                                            ]}
                                        >
                                            <View style={styles.itemContent}>
                                                <View style={styles.itemInfo}>
                                                    <Text style={styles.itemTitle} numberOfLines={1}>
                                                        {displayName}
                                                    </Text>
                                                    <Text style={styles.itemSubtitle}>
                                                        {subtitle}
                                                    </Text>
                                                </View>

                                                <View style={styles.itemRight}>
                                                    <Text style={[
                                                        styles.itemBalance,
                                                        account.balance >= 0 ? styles.positiveValue : styles.negativeValue
                                                    ]}>
                                                        {formatCurrency(account.balance || 0)}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 8,
        paddingBottom: 0,
    },
    positiveValue: {
        color: '#04D361'
    },
    negativeValue: {
        color: '#FF4C4C'
    },
    sectionHeader: {
        fontSize: 11,
        color: '#606060',
        marginBottom: 8,
        marginLeft: 0,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        fontFamily: 'AROneSans_400Regular',
    },
    sectionCard: {
        backgroundColor: '#111111',
        borderRadius: 14,
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    itemBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255, 255, 255, 0.06)',
        marginLeft: 0,
    },
    itemIconContainer: {
        width: 34,
        height: 34,
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
        color: '#E5E5E5',
        fontFamily: 'AROneSans_400Regular',
        marginBottom: 2
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#606060',
        fontFamily: 'AROneSans_400Regular',
    },
    itemRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    itemBalance: {
        fontSize: 15,
        fontFamily: 'AROneSans_400Regular',
    },
    itemDot: {
        color: '#444',
        fontSize: 13,
    },
    itemBalancePreview: {
        fontSize: 13,
        fontFamily: 'AROneSans_400Regular',
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
        fontFamily: 'AROneSans_400Regular',
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
    },
    emptyStateLottie: {
        width: 70,
        height: 70,
        marginBottom: 12,
    },
    emptyStateTitle: {
        fontSize: 17,
        fontFamily: 'AROneSans_400Regular',
        color: '#E5E5E5',
        marginBottom: 6,
        textAlign: 'center',
    },
    emptyStateDescription: {
        fontSize: 13,
        color: '#606060',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 20,
        fontFamily: 'AROneSans_400Regular',
    },
});
