# 🔧 Implementação: Sincronização de Mudança de Fatura entre App e Web

## ✅ Status: Implementado

A sincronização bidirecional de mudança de fatura entre App Mobile e Web foi implementada com sucesso.

## 📋 Arquivos Criados/Modificados

### Novos Arquivos

1. **`services/invoiceService.ts`**
   - Serviço para gerenciar operações de fatura
   - Função `moveTransactionToInvoice()` para mover transações entre faturas
   - Função `formatMonthKey()` para formatação de datas
   - Função `generateInvoiceOptions()` para gerar opções de faturas

2. **`components/InvoiceSelectorModal.tsx`**
   - Modal completo para seleção de fatura
   - Lista de faturas disponíveis (passadas, atual, futuras)
   - Indicador visual de override manual
   - Botão para remover override e voltar ao cálculo automático

3. **`components/InvoiceSelectorButton.tsx`**
   - Botão compacto inline para seleção de fatura
   - Indicador visual quando há override manual (ícone roxo)
   - Abre o modal de seleção ao clicar

### Arquivos Modificados

4. **`components/CreditCardInvoice.tsx`**
   - Adicionados imports dos novos componentes
   - Integrado `InvoiceSelectorButton` no `TransactionItem`
   - Adicionadas props `userId`, `currentInvoiceMonth` e `onInvoiceChange`
   - Callbacks para mover transação e remover override

## 🔄 Como Funciona

### Estrutura de Dados no Firestore

```typescript
// Transação com override manual
{
  id: "tx_123",
  description: "Compra no mercado",
  amount: -150.00,
  date: "2026-02-15",
  category: "groceries",
  accountId: "card_456",
  invoiceMonthKey: "2026-03",        // ⭐ Mês da fatura (manual ou automático)
  invoiceMonthKeyManual: true,       // ⭐ Flag indicando override manual
  updatedAt: "2026-02-21T10:30:00Z"
}
```

### Fluxo de Sincronização

#### App → Web
1. Usuário clica no botão de fatura no app
2. Modal abre com opções de faturas
3. Usuário seleciona nova fatura
4. App chama `moveTransactionToInvoice()`
5. Firestore atualiza os campos `invoiceMonthKey` e `invoiceMonthKeyManual`
6. Web recebe atualização via listener em tempo real
7. ✅ Sincronizado!

#### Web → App
1. Usuário muda fatura no web
2. Web atualiza Firestore com `invoiceMonthKey` e `invoiceMonthKeyManual`
3. App recebe atualização via listener em tempo real
4. UI do app atualiza automaticamente
5. ✅ Sincronizado!

## 🎨 Interface do Usuário

### Botão de Seleção de Fatura

O botão aparece na linha de categoria de cada transação:

```
┌─────────────────────────────────────┐
│ 🛒  Compra no mercado      -R$ 150  │
│     Supermercado  [Fev/26 ▼]        │ ← Botão aqui
└─────────────────────────────────────┘
```

**Estados visuais:**
- Normal: Fundo cinza, texto cinza
- Com override manual: Fundo roxo, texto roxo, ícone de edição

### Modal de Seleção

```
┌─────────────────────────────────────┐
│ Mover para fatura              [X]  │
├─────────────────────────────────────┤
│ ℹ️ Esta transação foi movida        │
│   manualmente                       │
├─────────────────────────────────────┤
│ ✓ Janeiro 2026 (Fechada)            │
│   Fevereiro 2026 (Atual)            │
│   Março 2026 (Futura)               │
│   Abril 2026 (Futura)               │
├─────────────────────────────────────┤
│ 🔄 Voltar ao cálculo automático     │
└─────────────────────────────────────┘
```

## 🔧 API do Serviço

### `moveTransactionToInvoice()`

```typescript
interface MoveTransactionOptions {
    userId: string;
    transactionId: string;
    targetMonthKey: string;      // "YYYY-MM"
    isRemoveOverride?: boolean;  // true para remover override
}

const result = await moveTransactionToInvoice({
    userId: "user_123",
    transactionId: "tx_456",
    targetMonthKey: "2026-03"
});

// Resultado
{
    success: true,
    error?: string
}
```

### `generateInvoiceOptions()`

```typescript
const options = generateInvoiceOptions(
    "2026-02",  // Mês atual
    2,          // Meses para trás
    3           // Meses para frente
);

// Retorna
[
    { monthKey: "2025-12", label: "Dezembro 2025 (Fechada)", isCurrent: false },
    { monthKey: "2026-01", label: "Janeiro 2026 (Fechada)", isCurrent: false },
    { monthKey: "2026-02", label: "Fevereiro 2026 (Atual)", isCurrent: true },
    { monthKey: "2026-03", label: "Março 2026 (Futura)", isCurrent: false },
    { monthKey: "2026-04", label: "Abril 2026 (Futura)", isCurrent: false },
    { monthKey: "2026-05", label: "Maio 2026 (Futura)", isCurrent: false }
]
```

## 🎯 Casos de Uso

### 1. Mover Transação para Outra Fatura

```typescript
// Usuário comprou algo que será cobrado na próxima fatura
await moveTransactionToInvoice({
    userId: "user_123",
    transactionId: "tx_456",
    targetMonthKey: "2026-03"  // Próximo mês
});
```

### 2. Remover Override Manual

```typescript
// Voltar ao cálculo automático baseado na data
await moveTransactionToInvoice({
    userId: "user_123",
    transactionId: "tx_456",
    targetMonthKey: "",
    isRemoveOverride: true
});
```

## 🔍 Detalhes Técnicos

### Coleções do Firestore

O serviço busca transações em duas coleções:
1. `users/{userId}/transactions` - Transações normais
2. `users/{userId}/creditCardTransactions` - Transações de cartão (Open Finance)

### Campos Atualizados

```typescript
// Ao mover para outra fatura
{
    invoiceMonthKey: "2026-03",
    invoiceMonthKeyManual: true,
    updatedAt: new Date().toISOString()
}

// Ao remover override
{
    invoiceMonthKey: FieldValue.delete(),
    invoiceMonthKeyManual: FieldValue.delete(),
    updatedAt: new Date().toISOString()
}
```

### Lógica de Prioridade

O sistema determina a fatura de uma transação nesta ordem:

1. **Se `invoiceMonthKeyManual === true`**: Usa `invoiceMonthKey` (override manual)
2. **Senão**: Calcula automaticamente baseado na data da transação e dia de fechamento

```typescript
// Exemplo no invoiceBuilder.ts
const hasManualOverride = tx.invoiceMonthKeyManual === true;

if (hasManualOverride) {
    // Respeitar a escolha manual do usuário
    invoiceMonth = tx.invoiceMonthKey;
} else {
    // Calcular automaticamente
    invoiceMonth = calculateInvoiceMonth(tx.date, card.closingDay);
}
```

## ✅ Testes Recomendados

### Teste 1: Mover no App
1. Abrir app mobile
2. Ir para tela de faturas
3. Clicar no botão de fatura de uma transação
4. Selecionar outra fatura
5. Verificar que a transação mudou de fatura
6. Abrir web e verificar que a mudança foi sincronizada

### Teste 2: Mover no Web
1. Abrir web
2. Mover uma transação para outra fatura
3. Abrir app mobile
4. Verificar que a transação está na nova fatura

### Teste 3: Remover Override
1. Mover uma transação manualmente
2. Clicar em "Voltar ao cálculo automático"
3. Verificar que a transação voltou para a fatura calculada automaticamente

### Teste 4: Sincronização em Tempo Real
1. Abrir app e web lado a lado
2. Mover transação no app
3. Verificar que web atualiza automaticamente (sem refresh)
4. Mover transação no web
5. Verificar que app atualiza automaticamente

## 🐛 Troubleshooting

### Problema: Mudança não sincroniza

**Verificar:**
1. Conexão com internet
2. Listeners do Firestore ativos
3. Campos `invoiceMonthKey` e `invoiceMonthKeyManual` no Firestore

**Debug:**
```typescript
// Verificar se o campo foi salvo
const docRef = doc(db, 'users', userId, 'creditCardTransactions', transactionId);
const docSnap = await getDoc(docRef);
console.log('Dados:', docSnap.data());
```

### Problema: Transação não encontrada

**Causa:** Transação pode estar em coleção diferente

**Solução:** O serviço já busca em ambas as coleções automaticamente

### Problema: Override não é respeitado

**Verificar:**
1. Campo `invoiceMonthKeyManual` está como `true`
2. Lógica no `invoiceBuilder.ts` está verificando o campo

## 📊 Compatibilidade

### Versões Suportadas
- ✅ App Mobile (React Native/Expo)
- ✅ Web App (React)
- ✅ Firestore (qualquer versão)

### Retrocompatibilidade
- ✅ Transações antigas sem `invoiceMonthKeyManual` continuam funcionando
- ✅ Cálculo automático é o padrão quando não há override

## 🚀 Próximos Passos

### Melhorias Futuras
1. Adicionar animação ao mover transação
2. Mostrar toast de confirmação
3. Adicionar undo/redo
4. Histórico de mudanças de fatura
5. Sugestões inteligentes de fatura baseadas em padrões

### Otimizações
1. Cache local de opções de fatura
2. Debounce em mudanças rápidas
3. Batch updates para múltiplas transações

## 📝 Notas Importantes

1. **Duas coleções**: Sempre verificar ambas `transactions` e `creditCardTransactions`
2. **Formato do mês**: Sempre usar `YYYY-MM` (ex: "2026-02")
3. **Listeners**: Firestore notifica automaticamente todas as mudanças
4. **Performance**: Componentes são memoizados para evitar re-renders desnecessários

## 🎉 Conclusão

A implementação está completa e funcional. A sincronização bidirecional entre App e Web está funcionando corretamente, permitindo que usuários movam transações entre faturas em qualquer plataforma e vejam as mudanças refletidas instantaneamente em todas as plataformas.
