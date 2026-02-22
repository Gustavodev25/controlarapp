import { BottomModal } from '@/components/ui/BottomModal';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Transaction {
    id: string;
    amount: number;
    type: string;
    date?: string;
    createdAt?: any;
    description?: string;
    source?: string;
    category?: string;
}

interface InvestmentStatementModalProps {
    visible: boolean;
    onClose: () => void;
    investmentId: string;
    investmentName: string;
}

export function InvestmentStatementModal({
    visible,
    onClose,
    investmentId,
    investmentName
}: InvestmentStatementModalProps) {
    const { user } = useAuthContext();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    const loadTransactions = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const result = await databaseService.getInvestmentTransactions(user.uid, investmentId);
        if (result.success) {
            setTransactions(result.data as Transaction[]);
        } else {
            setTransactions([]);
        }
        setLoading(false);
    }, [investmentId, user]);

    useEffect(() => {
        if (visible && user && investmentId) {
            loadTransactions();
        }
    }, [visible, user, investmentId, loadTransactions]);

    const getNormalizedType = (item: Transaction): 'deposit' | 'withdraw' => {
        const normalized = String(item.type || '').trim().toLowerCase();
        const depositTokens = ['deposit', 'deposito', 'aplicacao', 'aporte', 'entrada', 'income', 'credit', 'credito', 'guardar'];
        const withdrawTokens = ['withdraw', 'withdrawal', 'resgate', 'retirada', 'saque', 'saida', 'expense', 'debit', 'debito'];

        if (depositTokens.some(token => normalized.includes(token))) {
            return 'deposit';
        }
        if (withdrawTokens.some(token => normalized.includes(token))) {
            return 'withdraw';
        }

        return Number(item.amount || 0) >= 0 ? 'deposit' : 'withdraw';
    };

    const formatDate = (dateString: string, createdAt?: any) => {
        let date: Date;

        if (createdAt) {
            if (typeof createdAt.toDate === 'function') {
                date = createdAt.toDate();
            } else if (typeof createdAt === 'number') {
                date = new Date(createdAt);
            } else if (createdAt.seconds) {
                date = new Date(createdAt.seconds * 1000);
            } else {
                date = new Date(createdAt);
            }
        } else if (dateString) {
            date = new Date(dateString);
        } else {
            return '-';
        }

        if (isNaN(date.getTime())) {
            return '-';
        }

        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderTransaction = (item: Transaction, index: number, isLast: boolean) => {
        const normalizedType = getNormalizedType(item);
        const isDeposit = normalizedType === 'deposit';
        const color = isDeposit ? '#04D361' : '#FF453A';
        const Icon = isDeposit ? ArrowUpCircle : ArrowDownCircle;
        const title = item.description || item.category || (isDeposit ? 'Aplicacao' : 'Resgate');
        const dateLabel = formatDate(item.date || '', item.createdAt);
        const sourceLabel = item.source ? String(item.source).trim() : '';
        const subtitle = sourceLabel ? `${dateLabel} - ${sourceLabel}` : dateLabel;
        const amount = Math.abs(Number(item.amount || 0));

        return (
            <View key={`${item.id}_${index}`} style={styles.itemContainer}>
                <View style={[styles.itemIconContainer, { backgroundColor: isDeposit ? 'rgba(4, 211, 97, 0.1)' : 'rgba(255, 69, 58, 0.1)' }]}>
                    <Icon size={20} color={color} />
                </View>
                <View style={styles.itemRightContainer}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
                            <Text style={styles.itemSubtitle}>{subtitle}</Text>
                        </View>
                        <Text style={[styles.itemAmount, { color }]}>
                            {isDeposit ? '+' : '-'} {currencyFormatter.format(amount)}
                        </Text>
                    </View>
                </View>
                {!isLast && <View style={styles.itemSeparator} />}
            </View>
        );
    };

    return (
        <BottomModal
            visible={visible}
            onClose={onClose}
            title={`Extrato - ${investmentName}`}
            height="60%"
        >
            <View style={styles.container}>
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#D97757" />
                    </View>
                ) : transactions.length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.sectionCard}>
                            {transactions.map((item, index) =>
                                renderTransaction(item, index, index === transactions.length - 1)
                            )}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyTitle}>Nenhuma movimentacao</Text>
                        <Text style={styles.emptyText}>As movimentacoes aparecerao aqui.</Text>
                    </View>
                )}
            </View>
        </BottomModal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        minHeight: 200,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    sectionCard: {
        backgroundColor: '#1A1A1A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2A2A2A',
        overflow: 'hidden',
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        position: 'relative',
        backgroundColor: '#1A1A1A',
    },
    itemIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    itemRightContainer: {
        flex: 1,
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemTitle: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '500',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#707070',
        marginTop: 2,
    },
    itemAmount: {
        fontSize: 15,
        fontWeight: '600',
    },
    itemSeparator: {
        position: 'absolute',
        bottom: 0,
        left: 64,
        right: 16,
        height: 1,
        backgroundColor: '#2A2A2A',
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyText: {
        color: '#707070',
        fontSize: 14,
        textAlign: 'center',
    },
});
