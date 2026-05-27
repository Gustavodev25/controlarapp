# 📖 Exemplo Prático: Uso do Invoice Selector

## Exemplo Completo de Integração

### 1. Uso Básico no Componente

```typescript
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

function TransactionList({ userId, transactions }) {
    const handleRefresh = async () => {
        // Recarregar dados após mudança
        await fetchTransactions();
    };

    return (
        <View>
            {transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                    <Text>{transaction.description}</Text>
                    <Text>{formatCurrency(transaction.amount)}</Text>
                    
                    {/* Botão de seleção de fatura */}
                    <InvoiceSelectorButton
                        currentInvoiceMonth={transaction.invoiceMonthKey || "2026-02"}
                        availableInvoices={generateInvoiceOptions("2026-02", 2, 3)}
                        onMoveToInvoice={async (targetMonth) => {
                            const result = await moveTransactionToInvoice({
                                userId,
                                transactionId: transaction.id,
                                targetMonthKey: targetMonth
                            });
                            
                            if (result.success) {
                                await handleRefresh();
                            } else {
                                Alert.alert('Erro', result.error);
                            }
                        }}
                        onRemoveOverride={async () => {
                            const result = await moveTransactionToInvoice({
                                userId,
                                transactionId: transaction.id,
                                targetMonthKey: '',
                                isRemoveOverride: true
                            });
                            
                            if (result.success) {
                                await handleRefresh();
                            }
                        }}
                        hasManualOverride={transaction.invoiceMonthKeyManual === true}
                    />
                </View>
            ))}
        </View>
    );
}
```

### 2. Uso com Context API

```typescript
import { useAuth } from '@/contexts/AuthContext';
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

function TransactionCard({ transaction, onUpdate }) {
    const { userId } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleMoveInvoice = async (targetMonth: string) => {
        setLoading(true);
        try {
            const result = await moveTransactionToInvoice({
                userId,
                transactionId: transaction.id,
                targetMonthKey: targetMonth
            });

            if (result.success) {
                // Mostrar feedback visual
                Toast.show({
                    type: 'success',
                    text1: 'Transação movida!',
                    text2: `Movida para ${formatMonthKey(targetMonth)}`
                });
                
                // Atualizar dados
                onUpdate?.();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Erro ao mover transação',
                text2: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.card}>
            <Text>{transaction.description}</Text>
            
            {!loading && (
                <InvoiceSelectorButton
                    currentInvoiceMonth={transaction.invoiceMonthKey}
                    availableInvoices={generateInvoiceOptions(
                        transaction.invoiceMonthKey,
                        2,
                        3
                    )}
                    onMoveToInvoice={handleMoveInvoice}
                    hasManualOverride={transaction.invoiceMonthKeyManual}
                />
            )}
            
            {loading && <ActivityIndicator size="small" />}
        </View>
    );
}
```

### 3. Uso com React Query

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

function TransactionItem({ transaction, userId }) {
    const queryClient = useQueryClient();

    const moveInvoiceMutation = useMutation({
        mutationFn: ({ targetMonth }: { targetMonth: string }) =>
            moveTransactionToInvoice({
                userId,
                transactionId: transaction.id,
                targetMonthKey: targetMonth
            }),
        onSuccess: () => {
            // Invalidar queries relacionadas
            queryClient.invalidateQueries(['transactions']);
            queryClient.invalidateQueries(['invoices']);
        },
        onError: (error) => {
            Alert.alert('Erro', error.message);
        }
    });

    const removeOverrideMutation = useMutation({
        mutationFn: () =>
            moveTransactionToInvoice({
                userId,
                transactionId: transaction.id,
                targetMonthKey: '',
                isRemoveOverride: true
            }),
        onSuccess: () => {
            queryClient.invalidateQueries(['transactions']);
            queryClient.invalidateQueries(['invoices']);
        }
    });

    return (
        <View>
            <Text>{transaction.description}</Text>
            
            <InvoiceSelectorButton
                currentInvoiceMonth={transaction.invoiceMonthKey}
                availableInvoices={generateInvoiceOptions(
                    transaction.invoiceMonthKey,
                    2,
                    3
                )}
                onMoveToInvoice={(targetMonth) => {
                    moveInvoiceMutation.mutate({ targetMonth });
                }}
                onRemoveOverride={() => {
                    removeOverrideMutation.mutate();
                }}
                hasManualOverride={transaction.invoiceMonthKeyManual}
            />
        </View>
    );
}
```

### 4. Uso Direto do Modal (sem botão)

```typescript
import { useState } from 'react';
import { InvoiceSelectorModal } from '@/components/InvoiceSelectorModal';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

function CustomTransactionView({ transaction, userId }) {
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <View>
            <TouchableOpacity onPress={() => setModalVisible(true)}>
                <Text>Fatura: {formatMonthKey(transaction.invoiceMonthKey)}</Text>
            </TouchableOpacity>

            <InvoiceSelectorModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                currentInvoiceMonth={transaction.invoiceMonthKey}
                availableInvoices={generateInvoiceOptions(
                    transaction.invoiceMonthKey,
                    2,
                    3
                )}
                onMoveToInvoice={async (targetMonth) => {
                    const result = await moveTransactionToInvoice({
                        userId,
                        transactionId: transaction.id,
                        targetMonthKey: targetMonth
                    });
                    
                    if (result.success) {
                        setModalVisible(false);
                        // Atualizar dados
                    }
                }}
                onRemoveOverride={async () => {
                    const result = await moveTransactionToInvoice({
                        userId,
                        transactionId: transaction.id,
                        targetMonthKey: '',
                        isRemoveOverride: true
                    });
                    
                    if (result.success) {
                        setModalVisible(false);
                        // Atualizar dados
                    }
                }}
                hasManualOverride={transaction.invoiceMonthKeyManual}
            />
        </View>
    );
}
```

### 5. Uso com Firestore Listener (Tempo Real)

```typescript
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

function RealtimeTransactionView({ transactionId, userId }) {
    const [transaction, setTransaction] = useState(null);

    useEffect(() => {
        // Listener em tempo real
        const unsubscribe = onSnapshot(
            doc(db, 'users', userId, 'creditCardTransactions', transactionId),
            (doc) => {
                if (doc.exists()) {
                    setTransaction({ id: doc.id, ...doc.data() });
                }
            }
        );

        return () => unsubscribe();
    }, [transactionId, userId]);

    if (!transaction) return <ActivityIndicator />;

    return (
        <View>
            <Text>{transaction.description}</Text>
            
            <InvoiceSelectorButton
                currentInvoiceMonth={transaction.invoiceMonthKey}
                availableInvoices={generateInvoiceOptions(
                    transaction.invoiceMonthKey,
                    2,
                    3
                )}
                onMoveToInvoice={async (targetMonth) => {
                    // Não precisa atualizar manualmente - o listener faz isso!
                    await moveTransactionToInvoice({
                        userId,
                        transactionId: transaction.id,
                        targetMonthKey: targetMonth
                    });
                }}
                onRemoveOverride={async () => {
                    await moveTransactionToInvoice({
                        userId,
                        transactionId: transaction.id,
                        targetMonthKey: '',
                        isRemoveOverride: true
                    });
                }}
                hasManualOverride={transaction.invoiceMonthKeyManual}
            />
        </View>
    );
}
```

### 6. Batch Update (Múltiplas Transações)

```typescript
import { moveTransactionToInvoice } from '@/services/invoiceService';

async function moveMultipleTransactions(
    userId: string,
    transactionIds: string[],
    targetMonth: string
) {
    const results = await Promise.allSettled(
        transactionIds.map(id =>
            moveTransactionToInvoice({
                userId,
                transactionId: id,
                targetMonthKey: targetMonth
            })
        )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
        successful,
        failed,
        total: transactionIds.length
    };
}

// Uso
const result = await moveMultipleTransactions(
    userId,
    ['tx_1', 'tx_2', 'tx_3'],
    '2026-03'
);

Alert.alert(
    'Resultado',
    `${result.successful} movidas, ${result.failed} falharam`
);
```

## Dicas de Uso

### 1. Feedback Visual

```typescript
const [isMoving, setIsMoving] = useState(false);

const handleMove = async (targetMonth: string) => {
    setIsMoving(true);
    try {
        await moveTransactionToInvoice({...});
        // Mostrar sucesso
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
        // Mostrar erro
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
        setIsMoving(false);
    }
};
```

### 2. Validação Antes de Mover

```typescript
const handleMove = async (targetMonth: string) => {
    // Validar se a fatura de destino está aberta
    if (isInvoiceClosed(targetMonth)) {
        Alert.alert(
            'Fatura Fechada',
            'Não é possível mover para uma fatura já fechada'
        );
        return;
    }

    await moveTransactionToInvoice({...});
};
```

### 3. Confirmação do Usuário

```typescript
const handleMove = async (targetMonth: string) => {
    Alert.alert(
        'Confirmar',
        `Mover transação para ${formatMonthKey(targetMonth)}?`,
        [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Mover',
                onPress: async () => {
                    await moveTransactionToInvoice({...});
                }
            }
        ]
    );
};
```

## Estilos Customizados

### Personalizar o Botão

```typescript
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';

// Criar wrapper com estilos customizados
function CustomInvoiceButton(props) {
    return (
        <View style={{ 
            backgroundColor: '#1A1A1A',
            padding: 8,
            borderRadius: 8
        }}>
            <InvoiceSelectorButton {...props} />
        </View>
    );
}
```

### Personalizar o Modal

```typescript
// Criar versão customizada do modal
import { InvoiceSelectorModal } from '@/components/InvoiceSelectorModal';

function BrandedInvoiceModal(props) {
    return (
        <InvoiceSelectorModal
            {...props}
            // Adicionar props customizadas se necessário
        />
    );
}
```

## Conclusão

Estes exemplos cobrem os casos de uso mais comuns. A implementação é flexível e pode ser adaptada para diferentes necessidades e padrões de código.
