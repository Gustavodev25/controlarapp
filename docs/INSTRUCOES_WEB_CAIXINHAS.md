# Instruções para Implementar Sincronização de Caixinhas no Web

## Problema
O App mobile já está criando transações na coleção principal `transactions` quando o usuário deposita ou retira dinheiro de uma caixinha, mas o Web ainda não está fazendo isso. Isso causa inconsistência entre as plataformas.

## Solução
O Web precisa criar transações na coleção principal `transactions` da mesma forma que o App, usando os mesmos campos para garantir sincronização perfeita.

---

## O que fazer no Web

### 1. Localizar a função de Depósito/Retirada

Encontre no seu código Web a função que é chamada quando o usuário deposita ou retira dinheiro de uma caixinha. Provavelmente está em um arquivo como:
- `src/services/investments.ts`
- `src/services/firebase.ts`
- `src/hooks/useInvestments.ts`
- Ou similar

### 2. Modificar a função para criar transação na coleção principal

Quando o usuário faz um depósito ou retirada, além de salvar na subcoleção `history`, você deve TAMBÉM salvar na coleção principal `transactions`.

**Exemplo de código para adicionar:**

```typescript
// Após atualizar o saldo e salvar na subcoleção history...

// Criar transação na coleção principal (sincronização com App)
const transactionsRef = collection(db, 'users', userId, 'transactions');
const newTransactionRef = doc(transactionsRef);

await setDoc(newTransactionRef, {
    // Campos básicos
    amount: amount,
    date: new Date().toISOString(),
    description: type === 'deposit' 
        ? 'Depósito na caixinha' 
        : 'Retirada da caixinha',
    
    // ✅ CAMPOS OBRIGATÓRIOS PARA SINCRONIZAÇÃO WEB/APP
    accountId: investmentId,              // ID da caixinha
    accountType: 'SAVINGS_ACCOUNT',       // Tipo de conta
    isInvestment: true,                   // Marca como investimento
    category: `Caixinha - ${investmentName}`, // Fallback para compatibilidade
    
    // Tipo da transação
    type: type === 'deposit' ? 'expense' : 'income',
    // deposit = expense (tira da conta real)
    // withdraw = income (volta para conta real)
    
    // Metadados
    createdAt: serverTimestamp(),
    status: 'completed',
});
```

### 3. Estrutura Completa da Função

Aqui está como deve ficar a função completa no Web:

```typescript
async function handleInvestmentMovement(
    userId: string,
    investmentId: string,
    investmentName: string,
    amount: number,
    type: 'deposit' | 'withdraw'
) {
    // 1. Atualizar saldo da caixinha
    const investmentRef = doc(db, 'users', userId, 'investments', investmentId);
    const investmentDoc = await getDoc(investmentRef);
    const currentAmount = investmentDoc.data()?.currentAmount || 0;
    
    const newAmount = type === 'deposit'
        ? currentAmount + amount
        : currentAmount - amount;
    
    await updateDoc(investmentRef, {
        currentAmount: newAmount,
        updatedAt: serverTimestamp()
    });
    
    // 2. Salvar na subcoleção history (histórico da caixinha)
    const historyRef = collection(db, 'users', userId, 'investments', investmentId, 'history');
    const newHistoryRef = doc(historyRef);
    
    await setDoc(newHistoryRef, {
        amount: amount,
        type: type,
        date: new Date().toISOString(),
        accountId: investmentId,
        accountType: 'SAVINGS_ACCOUNT',
        category: `Caixinha - ${investmentName}`,
        createdAt: serverTimestamp()
    });
    
    // 3. ✅ CRIAR TRANSAÇÃO NA COLEÇÃO PRINCIPAL (SINCRONIZAÇÃO COM APP)
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    const newTransactionRef = doc(transactionsRef);
    
    await setDoc(newTransactionRef, {
        amount: amount,
        date: new Date().toISOString(),
        description: type === 'deposit' 
            ? 'Depósito na caixinha' 
            : 'Retirada da caixinha',
        
        // Campos obrigatórios para sincronização
        accountId: investmentId,
        accountType: 'SAVINGS_ACCOUNT',
        isInvestment: true,
        category: `Caixinha - ${investmentName}`,
        
        // Tipo da transação na conta principal
        type: type === 'deposit' ? 'expense' : 'income',
        
        // Metadados
        createdAt: serverTimestamp(),
        status: 'completed',
    });
}
```

### 4. Imports necessários

Certifique-se de ter esses imports no topo do arquivo:

```typescript
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from 'firebase/firestore';
```

---

## Campos Importantes

### accountId
- **Valor:** ID da caixinha (mesmo ID do documento em `investments`)
- **Propósito:** Vincular a transação à caixinha específica
- **Crítico:** Este é o campo principal usado para filtrar transações

### accountType
- **Valor:** Sempre `'SAVINGS_ACCOUNT'` para caixinhas
- **Propósito:** Identificar o tipo de conta

### isInvestment
- **Valor:** Sempre `true` para movimentações de caixinhas
- **Propósito:** Marcar como transação de investimento (pode ser usado para filtros)

### category
- **Valor:** `'Caixinha - {nome da caixinha}'`
- **Propósito:** Fallback para transações antigas que usavam apenas o nome

### type
- **Valor:** `'expense'` para depósito, `'income'` para retirada
- **Propósito:** Indicar se o dinheiro saiu ou entrou na conta principal
- **Lógica:**
  - Depósito = `'expense'` (dinheiro sai da conta e vai para caixinha)
  - Retirada = `'income'` (dinheiro volta da caixinha para conta)

---

## Exemplo Prático

### Cenário: Usuário deposita R$ 100 na "Caixinha Férias"

**Dados salvos na subcoleção `history`:**
```json
{
  "amount": 100,
  "type": "deposit",
  "date": "2024-02-22T10:30:00.000Z",
  "accountId": "abc123",
  "accountType": "SAVINGS_ACCOUNT",
  "category": "Caixinha - Férias",
  "createdAt": "Timestamp"
}
```

**Dados salvos na coleção principal `transactions`:**
```json
{
  "amount": 100,
  "date": "2024-02-22T10:30:00.000Z",
  "description": "Depósito na caixinha",
  "accountId": "abc123",
  "accountType": "SAVINGS_ACCOUNT",
  "isInvestment": true,
  "category": "Caixinha - Férias",
  "type": "expense",
  "status": "completed",
  "createdAt": "Timestamp"
}
```

---

## Verificação

Após implementar, teste:

1. ✅ Criar depósito no Web → Verificar se aparece no App
2. ✅ Criar retirada no Web → Verificar se aparece no App
3. ✅ Verificar se a transação aparece na coleção `transactions` no Firebase Console
4. ✅ Verificar se o extrato da caixinha mostra a transação em ambas plataformas
5. ✅ Renomear caixinha → Extrato continua funcionando

---

## Resumo

**O que adicionar no Web:**
1. Após salvar na subcoleção `history`
2. Criar documento na coleção `transactions`
3. Com os campos: `accountId`, `accountType`, `isInvestment`, `category`, `type`
4. Usar `type: 'expense'` para depósito e `type: 'income'` para retirada

Isso garante que Web e App criem transações idênticas e o extrato fique sincronizado!
