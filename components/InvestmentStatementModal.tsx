import { BottomModal } from '@/components/ui/BottomModal';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

interface Transaction {
    id: string;
    amount: number;
    type: 'deposit' | 'withdraw';
    date: string;
    createdAt: any;
    description?: string;
    source?: string;
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

    useEffect(() => {
        if (visible && user && investmentId) {
            loadTransactions();
        }
    }, [visible, user, investmentId]);

    const loadTransactions = async () => {
        if (!user) return;
        setLoading(true);
        const result = await databaseService.getInvestmentTransactions(user.uid, investmentId);
        if (result.success) {
            setTransactions(result.data as Transaction[]);
        }
        setLoading(false);
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
        const isDeposit = item.type === 'deposit';
        const color = isDeposit ? '#04D361' : '#FF453A';
        const Icon = isDeposit ? ArrowUpCircle : ArrowDownCircle;
        const title = item.description || (isDeposit ? 'Aplicação' : 'Resgate');

        return (
            <View key={item.id} style={styles.itemContainer}>
                <View style={[styles.itemIconContainer, { backgroundColor: isDeposit ? 'rgba(4, 211, 97, 0.1)' : 'rgba(255, 69, 58, 0.1)' }]}>
                    <Icon size={20} color={color} />
                </View>
                <View style={styles.itemRightContainer}>
                    <View style={styles.itemContent}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
                            <Text style={styles.itemSubtitle}>{formatDate(item.date, item.createdAt)}</Text>
                        </View>
                        <Text style={[styles.itemAmount, { color }]}>
                            {isDeposit ? '+' : '-'} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.amount)}
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
            title={`Extrato`}
            height="60%"
        >
            <View style={styles.container}>
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#D97757" />
                    </View>
                ) : transactions.length > 0 ? (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Card de transações agrupadas */}
                        <View style={styles.sectionCard}>
                            {transactions.map((item, index) =>
                                renderTransaction(item, index, index === transactions.length - 1)
                            )}
                        </View>
                    </ScrollView>
                ) : (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyTitle}>Nenhuma movimentação</Text>
                        <Text style={styles.emptyText}>As movimentações aparecerão aqui.</Text>
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
    // Section Card (grouped items)
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
    // Empty state
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
