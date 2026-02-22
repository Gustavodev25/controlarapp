# Sincronização de Caixinhas entre Web e App

## Resumo das Mudanças

Este documento descreve as alterações implementadas no aplicativo mobile para sincronizar perfeitamente as movimentações (extratos) das Caixinhas com a versão Web.

## Problema Anterior

Antes, as movimentações das Caixinhas eram vinculadas apenas pelo nome da caixinha através da propriedade `category` (ex: `category: 'Caixinha - Reserva'`). Isso era frágil porque:
- Se o usuário renomeasse a caixinha, o extrato parava de funcionar
- Não havia sincronização entre Web e App
- Dados ficavam inconsistentes entre plataformas

## Solução Implementada

Agora o App utiliza o **ID da Caixinha** (`accountId`) para vincular transações, exatamente como a versão Web, garantindo sincronização perfeita.

## Mudanças Técnicas

### 1. Criação de Depósitos/Retiradas (`app/(tabs)/planning.tsx`)

**Arquivo modificado:** `app/(tabs)/planning.tsx`  
**Função:** `handleUpdateBalance`

Quando o usuário deposita ou retira dinheiro de uma caixinha, agora são salvos em dois lugares:

**A) Subcoleção `history` (histórico da caixinha):**
```typescript
await databaseService.addInvestmentTransaction(user.uid, selectedInvestment.id, {
    amount: amount,
    type: type,
    date: new Date().toISOString(),
    accountId: selectedInvestment.id,
    accountType: 'SAVINGS_ACCOUNT',
    category: `Caixinha - ${selectedInvestment.name}`,
});
```

**B) Coleção principal `transactions` (sincronização com Web):**
```typescript
await databaseService.addTransaction(user.uid, {
    amount: amount,
    date: new Date().toISOString(),
    description: type === 'deposit' ? 'Depósito na caixinha' : 'Retirada da caixinha',
    
    // ✅ CAMPOS OBRIGATÓRIOS PARA SINCRONIZAÇÃO WEB/APP
    accountId: selectedInvestment.id,           // ID exato da caixinha
    accountType: 'SAVINGS_ACCOUNT',             // Identificador do tipo
    isInvestment: true,                         // Marca como investimento
    category: `Caixinha - ${selectedInvestment.name}`, // Fallback para compatibilidade
    
    // Tipo da transação na conta principal
    type: type === 'deposit' ? 'expense' : 'income',
    // deposit = expense (tira da conta real)
    // withdraw = income (volta para conta real)
});
```

**Campos importantes:**
- `accountId`: ID único da caixinha (prioridade 1 para filtros)
- `accountType`: Sempre `'SAVINGS_ACCOUNT'` para caixinhas
- `isInvestment`: `true` para marcar como movimentação de investimento
- `category`: Fallback para transações antigas gravadas pelo nome
- `type`: `'expense'` para depósito (sai da conta), `'income'` para retirada (volta para conta)

### 2. Consulta do Extrato (`services/firebase.ts`)

**Arquivo modificado:** `services/firebase.ts`  
**Função:** `getInvestmentTransactions`

A função agora busca transações em múltiplas fontes para garantir compatibilidade total:

```typescript
// 1. Busca nas subcoleções history e transactions (padrão)
await collectInvestmentSubcollection('history');
await collectInvestmentSubcollection('transactions');

// 2. Busca na coleção principal por accountId (sincronização Web/App)
const qByAccountId = query(
    transactionsRef, 
    where('accountId', '==', investmentId)
);

// 3. Fallback Legado (transações antigas pelo nome)
const qByCategory = query(
    transactionsRef, 
    where('category', '==', `Caixinha - ${investmentName}`)
);

// 4. Fallback Extra (isInvestment + description contém nome)
const qByInvestment = query(
    transactionsRef, 
    where('isInvestment', '==', true)
);
// Depois filtra por description.includes(investmentName)
```

**Benefícios:**
- Transações novas usam `accountId` (sincronização perfeita)
- Transações antigas continuam funcionando (fallback por nome)
- Compatibilidade total entre Web e App
- Renomear caixinha não quebra o extrato
- Deduplica transações automaticamente

## Fluxo de Dados

### Depósito na Caixinha
1. Usuário deposita R$ 100 na "Caixinha Férias"
2. App salva em dois lugares:
   - **Subcoleção** `investments/{id}/history`: histórico da caixinha
   - **Coleção principal** `transactions`: com `accountId`, `type: 'expense'`, `isInvestment: true`
3. Web e App leem o mesmo extrato filtrando por `accountId`
4. A transação aparece como "saída" na conta principal (expense)

### Retirada da Caixinha
1. Usuário retira R$ 50 da "Caixinha Férias"
2. App salva em dois lugares:
   - **Subcoleção** `investments/{id}/history`: histórico da caixinha
   - **Coleção principal** `transactions`: com `accountId`, `type: 'income'`, `isInvestment: true`
3. Web e App leem o mesmo extrato filtrando por `accountId`
4. A transação aparece como "entrada" na conta principal (income)

## Compatibilidade

### Transações Antigas
Transações criadas antes desta atualização continuam funcionando através dos fallbacks:
- Busca por `category: 'Caixinha - Nome'`
- Busca por `isInvestment: true` + nome na descrição

### Transações Novas
Todas as novas transações usam `accountId`, garantindo:
- Sincronização perfeita Web/App
- Resistência a renomeações
- Dados consistentes

## Testes Recomendados

1. ✅ Criar depósito no App → Verificar no Web
2. ✅ Criar retirada no Web → Verificar no App
3. ✅ Renomear caixinha → Extrato continua funcionando
4. ✅ Transações antigas ainda aparecem no extrato
5. ✅ Saldo da caixinha sincroniza corretamente

## Arquivos Modificados

- `app/(tabs)/planning.tsx` - Função `handleUpdateBalance`
- `services/firebase.ts` - Função `getInvestmentTransactions`

## Próximos Passos

- Testar em ambiente de desenvolvimento
- Validar sincronização Web/App
- Monitorar logs do Firebase para erros
- Considerar migração de transações antigas (opcional)
