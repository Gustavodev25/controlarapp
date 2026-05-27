# Comparação: App Mobile vs Web - Caixinhas

## ✅ Problema Resolvido

A função `addInvestmentTransaction` no `services/firebase.ts` agora cria automaticamente transações em ambos os lugares:

1. Subcoleção `investments/{id}/history` (histórico da caixinha)
2. Coleção principal `transactions` (sincronização Web/App)

## Implementação

**Arquivo:** `services/firebase.ts`  
**Função:** `addInvestmentTransaction`

A função agora:
- Busca o nome da caixinha automaticamente
- Salva na subcoleção `history`
- Cria transação na coleção principal `transactions` com todos os campos necessários
- Funciona tanto no App quanto no Web

## Uso Simplificado

```typescript
// Apenas uma chamada necessária
await databaseService.addInvestmentTransaction(userId, investmentId, {
    amount: 100,
    type: 'deposit', // ou 'withdraw'
    date: new Date().toISOString(),
});
```

A função cria automaticamente:
- Registro em `investments/{id}/history`
- Transação em `transactions` com `accountId`, `accountType`, `isInvestment`, `category`, etc.

## Campos Criados Automaticamente

- `accountId`: ID da caixinha
- `accountType`: `'SAVINGS_ACCOUNT'`
- `isInvestment`: `true`
- `category`: `'Caixinha - {nome}'`
- `type`: `'expense'` (depósito) ou `'income'` (retirada)
- `description`: Descrição automática


## Referência: Código Atualizado

**App:** `app/(tabs)/planning.tsx`

```typescript
const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
    // 1. Atualiza saldo
    await databaseService.updateInvestment(user.uid, selectedInvestment.id, {
        currentAmount: newAmount
    });

    // 2. Cria transação (history + transactions automaticamente)
    await databaseService.addInvestmentTransaction(user.uid, selectedInvestment.id, {
        amount: amount,
        type: type,
        date: new Date().toISOString(),
    });
};
```

**Web:** Usa a mesma função, sincronização automática!  
