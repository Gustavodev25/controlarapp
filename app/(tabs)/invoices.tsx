/**
 * Credit Card Invoices Screen
 * Main screen for viewing credit card invoices
 */

import { CreditCardInvoice } from '@/components/CreditCardInvoice';
import { UniversalBackground } from '@/components/UniversalBackground';
import { useAuthContext } from '@/contexts/AuthContext';
import { db } from '@/services/firebase';
import { CreditCardAccount, normalizePluggyDate, Transaction } from '@/services/invoiceBuilder';
import { queryCache } from '@/services/queryCache';
import { useRouter } from 'expo-router';
import {
    collection,
    DocumentData,
    getDocs,
    limit,
    orderBy,
    query,
    QueryDocumentSnapshot,
    startAfter,
    where
} from 'firebase/firestore';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    InteractionManager,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const INITIAL_BATCH = 2000;
const PAGE_BATCH = 500;
const MAX_HISTORY_LIMIT = 2000;
const SILENT_REFRESH_BATCH = 350;

function normalizeCreditTransactionType(data: DocumentData): 'income' | 'expense' {
    const explicitType = typeof data?.type === 'string' ? data.type.toLowerCase() : '';
    const pluggyType = typeof data?.pluggyRaw?.type === 'string' ? data.pluggyRaw.type.toLowerCase() : '';
    const rawAmount = Number(data?.pluggyRaw?.amount ?? data?.amount ?? 0);
    const isRefund = data?.isRefund === true || data?.category === 'Refund' || typeof data?.originalTransactionId === 'string';

    if (isRefund) return 'income';

    if (pluggyType === 'debit' || pluggyType === 'expense') return 'expense';
    if (pluggyType === 'credit' || pluggyType === 'income') return 'income';

    if (explicitType === 'expense' || explicitType === 'debit') return 'expense';
    if (explicitType === 'income' || explicitType === 'credit') {
        // Legacy docs may store regular purchases as "income" with positive amount.
        return rawAmount < 0 ? 'income' : 'expense';
    }

    // For credit cards, positive amounts are usually purchases and should increase the bill.
    return rawAmount < 0 ? 'income' : 'expense';
}

function mapCreditTransaction(doc: QueryDocumentSnapshot<DocumentData>): Transaction {
    const data = doc.data();
    const txCardId = data.cardId || data.accountId || data.pluggyAccountId || data.pluggyRaw?.accountId || null;
    const isRefund = data.isRefund === true || data.category === 'Refund' || typeof data.originalTransactionId === 'string';
    return {
        id: doc.id,
        description: data.description || '',
        amount: Math.abs(data.amount || 0),
        date: normalizePluggyDate(data.date) || '',
        type: normalizeCreditTransactionType(data),
        category: data.category || null,
        cardId: txCardId,
        accountId: txCardId,
        installmentNumber: data.installmentNumber || 1,
        totalInstallments: data.totalInstallments || 1,
        isRefund,
        originalTransactionId: typeof data.originalTransactionId === 'string' ? data.originalTransactionId : undefined,
        pluggyRaw: data.pluggyRaw ?? undefined,
        invoiceMonthKey: data.invoiceMonthKey || null,
        invoiceMonthKeyManual: data.invoiceMonthKeyManual === true,
        manualInvoiceMonth: typeof data.manualInvoiceMonth === 'string' ? data.manualInvoiceMonth : undefined,
        creditCardMetadata: data.creditCardMetadata ? {
            billId: data.creditCardMetadata.billId ?? null,
            installmentNumber: data.creditCardMetadata.installmentNumber ?? null,
            totalInstallments: data.creditCardMetadata.totalInstallments ?? null,
        } : undefined
    } as Transaction;
}

export default function InvoicesScreen() {
    const router = useRouter();
    const { user } = useAuthContext();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCardAccount[]>([]);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
    const [loadingDots, setLoadingDots] = useState('');

    const transactionsRef = useRef<Transaction[]>([]);
    const knownTransactionIdsRef = useRef<Set<string>>(new Set());
    const historyCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const hasMoreHistoryRef = useRef(false);
    const prefetchingRef = useRef(false);
    const prefetchSessionRef = useRef(0);

    const appendBatchToHistory = useCallback((batch: Transaction[]) => {
        if (batch.length === 0) {
            return;
        }

        setTransactions((prev) => {
            const merged = [...prev];
            let appended = 0;

            batch.forEach((item) => {
                if (knownTransactionIdsRef.current.has(item.id)) {
                    return;
                }
                knownTransactionIdsRef.current.add(item.id);
                merged.push(item);
                appended += 1;
            });

            if (appended === 0) {
                return prev;
            }
            transactionsRef.current = merged;
            return merged;
        });
    }, []);

    useEffect(() => {
        if (!loading) return;
        const interval = setInterval(() => {
            setLoadingDots(prev => {
                if (prev === '...') return '';
                return prev + '.';
            });
        }, 500);
        return () => clearInterval(interval);
    }, [loading]);

    const updateHistoryState = useCallback((nextCursor: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean) => {
        historyCursorRef.current = nextCursor;
        hasMoreHistoryRef.current = hasMore;
        setHasMoreHistory(hasMore);
    }, []);

    const fetchCreditTransactionsBatch = useCallback(async (
        batchSize: number,
        cursor: QueryDocumentSnapshot<DocumentData> | null
    ): Promise<{
        data: Transaction[];
        nextCursor: QueryDocumentSnapshot<DocumentData> | null;
        hasMore: boolean;
    }> => {
        if (!user?.uid) {
            return { data: [], nextCursor: null, hasMore: false };
        }

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 24);
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

        const effectiveLimit = Math.min(batchSize, MAX_HISTORY_LIMIT);
        const creditRef = collection(db, 'users', user.uid, 'creditCardTransactions');

        const constraints = [
            where('date', '>=', cutoffDateStr),
            orderBy('date', 'desc'),
            limit(effectiveLimit)
        ] as const;

        const qCredit = cursor
            ? query(creditRef, where('date', '>=', cutoffDateStr), orderBy('date', 'desc'), startAfter(cursor), limit(effectiveLimit))
            : query(creditRef, ...constraints);

        const snapshotCredit = await getDocs(qCredit);
        const mapped = snapshotCredit.docs.map(mapCreditTransaction);
        const nextCursor = snapshotCredit.empty ? cursor : snapshotCredit.docs[snapshotCredit.docs.length - 1];
        const hasMore = snapshotCredit.docs.length === effectiveLimit;

        return {
            data: mapped,
            nextCursor,
            hasMore
        };
    }, [user?.uid]);

    const runBackgroundPrefetch = useCallback(() => {
        if (!user?.uid || !hasMoreHistoryRef.current || prefetchingRef.current) {
            return;
        }

        prefetchingRef.current = true;
        const session = ++prefetchSessionRef.current;

        const loop = async () => {
            try {
                let buffered: Transaction[] = [];
                while (hasMoreHistoryRef.current && session === prefetchSessionRef.current) {
                    const batch = await fetchCreditTransactionsBatch(PAGE_BATCH, historyCursorRef.current);
                    if (session !== prefetchSessionRef.current) {
                        break;
                    }
                    if (batch.data.length === 0) {
                        if (buffered.length > 0) {
                            await new Promise<void>((resolve) => {
                                InteractionManager.runAfterInteractions(() => {
                                    appendBatchToHistory(buffered);
                                    resolve();
                                });
                            });
                            buffered = [];
                        }
                        updateHistoryState(batch.nextCursor, false);
                        break;
                    }

                    buffered.push(...batch.data);
                    updateHistoryState(batch.nextCursor, batch.hasMore);

                    const shouldFlush = buffered.length >= PAGE_BATCH * 2 || !batch.hasMore;
                    if (shouldFlush) {
                        const flushBuffer = buffered;
                        buffered = [];
                        await new Promise<void>((resolve) => {
                            InteractionManager.runAfterInteractions(() => {
                                appendBatchToHistory(flushBuffer);
                                resolve();
                            });
                        });
                    }

                    await new Promise((resolve) => setTimeout(resolve, 220));
                }
            } catch (error) {
            } finally {
                if (session === prefetchSessionRef.current) {
                    prefetchingRef.current = false;
                }
            }
        };

        void loop();
    }, [appendBatchToHistory, fetchCreditTransactionsBatch, updateHistoryState, user?.uid]);

    const fetchAccounts = useCallback(async () => {
        if (!user?.uid) {
            return [] as CreditCardAccount[];
        }

        const getAccounts = async () => {
            const accountsRef = collection(db, 'users', user.uid, 'accounts');
            const snapshotAccounts = await getDocs(accountsRef);
            return snapshotAccounts.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || null,
                    type: data.type || 'credit',
                    subtype: data.subtype || null,
                    creditLimit: data.creditLimit || data.creditData?.creditLimit || null,
                    availableCreditLimit: data.availableCreditLimit || data.creditData?.availableCreditLimit || null,
                    balance: data.balance || null,
                    connector: data.connector || null,
                    balanceCloseDate: normalizePluggyDate(data.balanceCloseDate || data.creditData?.balanceCloseDate) || null,
                    balanceDueDate: normalizePluggyDate(data.balanceDueDate || data.creditData?.balanceDueDate) || null,
                    currentBill: data.currentBill || null,
                    bills: data.bills || null,
                    closingDateSettings: data.closingDateSettings || null
                } as CreditCardAccount;
            });
        };

        const accountsResult = await queryCache.get(`invoices_accounts_${user.uid}`, getAccounts, { ttlMinutes: 60 });
        const list = (accountsResult || []) as CreditCardAccount[];

        return list.filter((acc: any) => {
            const isCreditType = acc.type === 'credit' || acc.type === 'CREDIT' || acc.type === 'CREDIT_CARD' || acc.subtype === 'CREDIT_CARD';
            const isNotBankOrChecking = acc.type !== 'BANK' && acc.type !== 'checking';
            const hasCreditCardIndicators = acc.creditLimit != null || acc.currentBill != null || acc.balanceCloseDate != null;

            const nameLower = (acc.name || '').toLowerCase();
            const isDebitCard = nameLower.includes('elite') ||
                nameLower.includes('debito') ||
                nameLower.includes('débito') ||
                nameLower.includes('poupanca') ||
                nameLower.includes('poupança') ||
                nameLower.includes('conta corrente') ||
                nameLower.includes('savings');

            return isCreditType && isNotBankOrChecking && hasCreditCardIndicators && !isDebitCard;
        });
    }, [user?.uid]);

    const loadInitialData = useCallback(async (isSilent = false) => {
        if (!user?.uid) {
            if (!isSilent) setLoading(false);
            return;
        }

        // Modo silencioso evita reset pesado de estado para manter a UI responsiva.
        if (!isSilent) {
            prefetchSessionRef.current += 1;
            prefetchingRef.current = false;
            transactionsRef.current = [];
            knownTransactionIdsRef.current.clear();
            historyCursorRef.current = null;
            hasMoreHistoryRef.current = false;
            setLoadingMoreHistory(false);
        }

        try {
            if (!isSilent) setLoading(true);
            if (!isSilent) {
                await queryCache.invalidate(`dashboard_credit_transactions_${user.uid}_v2`);
                await queryCache.invalidate(`dashboard_credit_transactions_${user.uid}`);
                await queryCache.invalidate(`invoices_accounts_${user.uid}`);
            }

            const [firstBatch, cards] = await Promise.all([
                fetchCreditTransactionsBatch(isSilent ? SILENT_REFRESH_BATCH : INITIAL_BATCH, null),
                isSilent ? Promise.resolve<CreditCardAccount[] | null>(null) : fetchAccounts()
            ]);

            const firstUnique: Transaction[] = [];
            // Se for silent, mantemos o que já tínhamos e apenas atualizamos/adicionamos
            const newKnownIds = isSilent ? new Set(knownTransactionIdsRef.current) : new Set<string>();

            firstBatch.data.forEach((item) => {
                if (!isSilent && knownTransactionIdsRef.current.has(item.id)) {
                    return;
                }
                newKnownIds.add(item.id);
                firstUnique.push(item);
            });

            if (isSilent) {
                // Merge inteligente: substitui transações existentes e adiciona novas
                setTransactions(prev => {
                    const map = new Map(prev.map(t => [t.id, t]));
                    firstBatch.data.forEach(t => map.set(t.id, t));
                    const next = Array.from(map.values());
                    transactionsRef.current = next;
                    knownTransactionIdsRef.current = newKnownIds;
                    return next;
                });
            } else {
                knownTransactionIdsRef.current = newKnownIds;
                transactionsRef.current = firstUnique;
                setTransactions(firstUnique);
            }

            updateHistoryState(firstBatch.nextCursor, firstBatch.hasMore);
            if (!isSilent && cards) {
                setCreditCards(cards);
            }

        } catch (error) {
            console.error('[InvoicesScreen] Error loading data:', error);
        } finally {
            if (!isSilent) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [fetchAccounts, fetchCreditTransactionsBatch, updateHistoryState, user?.uid]);

    useEffect(() => {
        void loadInitialData(false);
        return () => {
            prefetchSessionRef.current += 1;
            prefetchingRef.current = false;
        };
    }, [loadInitialData]);

    const handleRefresh = useCallback(async (isSilent = false) => {
        if (!isSilent) {
            setRefreshing(true);
        }
        await loadInitialData(isSilent);
    }, [loadInitialData]);

    const loadMoreHistory = useCallback(async () => {
        if (!user?.uid || loading || loadingMoreHistory || !hasMoreHistoryRef.current) {
            return;
        }

        // Prioritize user-driven pagination over background prefetch.
        if (prefetchingRef.current) {
            prefetchSessionRef.current += 1;
            prefetchingRef.current = false;
        }

        setLoadingMoreHistory(true);
        try {
            const batch = await fetchCreditTransactionsBatch(PAGE_BATCH, historyCursorRef.current);
            if (batch.data.length > 0) {
                appendBatchToHistory(batch.data);
            }
            updateHistoryState(batch.nextCursor, batch.hasMore);

            if (batch.hasMore) {
                runBackgroundPrefetch();
            }
        } catch (error) {
        } finally {
            setLoadingMoreHistory(false);
        }
    }, [appendBatchToHistory, fetchCreditTransactionsBatch, loading, loadingMoreHistory, runBackgroundPrefetch, updateHistoryState, user?.uid]);

    return (
        <View style={styles.mainContainer}>
            <UniversalBackground
                backgroundColor="#0C0C0C"
                glowSize={350}
                height={280}
                showParticles={true}
                particleCount={8}
            />

            <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <LottieView
                                source={require('@/assets/carregando.json')}
                                autoPlay
                                loop
                                style={{ width: 50, height: 50 }}
                            />
                            <Text style={styles.loadingText}>Carregando dados da fatura{loadingDots}</Text>
                        </View>
                    ) : (
                        <CreditCardInvoice
                            transactions={transactions}
                            creditCards={creditCards}
                            userId={user?.uid || ''}
                            onRefresh={handleRefresh}
                            refreshing={refreshing}
                            onLoadMoreHistory={loadMoreHistory}
                            hasMoreHistory={hasMoreHistory}
                            loadingMoreHistory={loadingMoreHistory}
                            onNavigateToOpenFinance={() => router.push('/(tabs)/open-finance')}
                        />
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#0C0C0C',
    },
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        marginBottom: 10,
        height: 40,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#E0E0E0',
    },
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#888',
        fontSize: 14,
    },
});
