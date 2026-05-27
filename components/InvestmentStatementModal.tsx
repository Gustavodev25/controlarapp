import { ModalPadrao } from '@/components/ui/ModalPadrao';
import { IosCoreLoader } from '@/components/ui/IosCoreLoader';
import { useAuthContext } from '@/contexts/AuthContext';
import { databaseService } from '@/services/firebase';
import { Search, X as XIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
    const [searchQuery, setSearchQuery] = useState('');
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
        if (!visible) {
            setSearchQuery('');
        }
    }, [visible, user, investmentId, loadTransactions]);

    const filteredTransactions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return transactions;
        const normalizedQuery = query.replace(/[.,\s]/g, '');
        return transactions.filter((item) => {
            const haystack = [
                item.description,
                item.category,
                item.source,
                item.type,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            if (haystack.includes(query)) return true;
            const amountStr = String(Math.abs(Number(item.amount || 0))).replace('.', '');
            return amountStr.includes(normalizedQuery);
        });
    }, [transactions, searchQuery]);

    const getNormalizedType = (item: Transaction): 'deposit' | 'withdraw' => {
        const normalized = String(item.type || '').trim().toLowerCase();
        const depositTokens = ['deposit', 'deposito', 'aplicacao', 'aporte', 'entrada', 'income', 'credit', 'credito', 'guardar'];
        const withdrawTokens = ['withdraw', 'withdrawal', 'resgate', 'retirada', 'saque', 'saida', 'expense', 'debit', 'debito'];

        if (depositTokens.some(token => normalized.includes(token))) return 'deposit';
        if (withdrawTokens.some(token => normalized.includes(token))) return 'withdraw';
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

        if (isNaN(date.getTime())) return '-';

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
        const title = item.description || item.category || (isDeposit ? 'Aplicação' : 'Resgate');
        const dateLabel = formatDate(item.date || '', item.createdAt);
        const sourceLabel = item.source ? String(item.source).trim() : '';
        const subtitle = sourceLabel ? `${dateLabel} - ${sourceLabel}` : dateLabel;
        const amount = Math.abs(Number(item.amount || 0));

        return (
            <View key={`${item.id}_${index}`}>
                <View style={styles.itemContent}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
                        <Text style={styles.itemSubtitle}>{subtitle}</Text>
                    </View>
                    <Text style={[styles.itemAmount, { color }]}>
                        {isDeposit ? '+' : '-'} {currencyFormatter.format(amount)}
                    </Text>
                </View>
                {!isLast && <View style={styles.separator} />}
            </View>
        );
    };

    const titleComponent = (
        <View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
                Extrato
            </Text>
            {investmentName.includes(' • ') ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ fontSize: 13, color: '#D9D9D9', fontWeight: '500' }}>
                        {investmentName.split(' • ')[0]}
                    </Text>
                    <Text style={{ fontSize: 13, color: '#909090', marginLeft: 4 }}>
                        • {investmentName.split(' • ')[1]}
                    </Text>
                </View>
            ) : (
                <Text style={{ fontSize: 13, color: '#909090', marginTop: 2 }}>
                    {investmentName}
                </Text>
            )}
        </View>
    );

    return (
        <ModalPadrao
            visible={visible}
            onClose={onClose}
            title={titleComponent}
            titleAlign="start"
        >
            <View style={styles.container}>
                {loading ? (
                    <IosCoreLoader style={styles.centerContainer} />
                ) : transactions.length > 0 ? (
                    <>
                        <View style={styles.searchContainer}>
                            <Search size={16} color="#8E8E93" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Pesquisar por descrição ou valor..."
                                placeholderTextColor="#8E8E93"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                                    <XIcon size={16} color="#8E8E93" />
                                </Pressable>
                            )}
                        </View>
                        {filteredTransactions.length > 0 ? (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={styles.groupCard}>
                                    {filteredTransactions.map((item, index) =>
                                        renderTransaction(item, index, index === filteredTransactions.length - 1)
                                    )}
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={styles.centerContainer}>
                                <Text style={styles.emptyTitle}>Nada encontrado</Text>
                                <Text style={styles.emptyText}>Tente ajustar a pesquisa.</Text>
                            </View>
                        )}
                    </>
                ) : (
                    <View style={styles.centerContainer}>
                        <Text style={styles.emptyTitle}>Nenhuma movimentação</Text>
                        <Text style={styles.emptyText}>As movimentações aparecerão aqui.</Text>
                    </View>
                )}
            </View>
        </ModalPadrao>
    );
}

const styles = StyleSheet.create({
    container: {},
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#101010',
        marginBottom: 12,
        paddingHorizontal: 12,
        height: 44,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#252525',
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
        padding: 0,
    },
    centerContainer: {
        flex: 1,
        minHeight: 200,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    groupCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        overflow: 'hidden',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        minHeight: 48,
    },
    itemTitle: {
        fontSize: 17,
        color: '#FFFFFF',
        fontWeight: '400',
    },
    itemSubtitle: {
        fontSize: 12,
        color: '#8E8E93',
        marginTop: 1,
    },
    itemAmount: {
        fontSize: 15,
        fontWeight: '600',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: '#38383A',
        marginLeft: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    emptyText: {
        color: '#8E8E93',
        fontSize: 14,
        textAlign: 'center',
    },
});
