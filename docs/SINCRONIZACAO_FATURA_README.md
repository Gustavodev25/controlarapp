# 🔄 Sincronização de Fatura - App Mobile ↔️ Web

## 📌 Resumo

Implementação completa da sincronização bidirecional de mudança de fatura entre o aplicativo mobile e a versão web. Agora os usuários podem mover transações entre faturas em qualquer plataforma e ver as mudanças refletidas instantaneamente em todas as plataformas.

## ✅ O Que Foi Implementado

### Novos Arquivos

1. **`services/invoiceService.ts`** - Serviço para gerenciar faturas
2. **`components/InvoiceSelectorModal.tsx`** - Modal de seleção de fatura
3. **`components/InvoiceSelectorButton.tsx`** - Botão compacto de seleção

### Arquivos Modificados

4. **`components/CreditCardInvoice.tsx`** - Integração do seletor de fatura

## 🎯 Funcionalidades

### ✨ Mover Transação para Outra Fatura
- Clique no botão de fatura ao lado da categoria
- Selecione a fatura de destino
- Transação é movida instantaneamente
- Sincroniza automaticamente entre app e web

### 🔄 Voltar ao Cálculo Automático
- Remova o ajuste manual
- Sistema volta a calcular a fatura automaticamente
- Baseado na data da transação e dia de fechamento

### 🎨 Indicador Visual
- Botão roxo quando há ajuste manual
- Ícone de edição para identificar override
- Info box no modal explicando o ajuste

## 🚀 Como Usar

### No Código

```typescript
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';
import { moveTransactionToInvoice, generateInvoiceOptions } from '@/services/invoiceService';

// Adicionar ao componente de transação
<InvoiceSelectorButton
    currentInvoiceMonth={transaction.invoiceMonthKey}
    availableInvoices={generateInvoiceOptions("2026-02", 2, 3)}
    onMoveToInvoice={async (targetMonth) => {
        await moveTransactionToInvoice({
            userId,
            transactionId: transaction.id,
            targetMonthKey: targetMonth
        });
        // Atualizar dados
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
```

### Para o Usuário

1. **Mover Transação:**
   - Toque no botão de fatura (ex: "Fev/26")
   - Selecione a nova fatura
   - Pronto! A transação foi movida

2. **Remover Ajuste:**
   - Toque no botão de fatura
   - Toque em "Voltar ao cálculo automático"
   - Sistema calcula automaticamente a fatura correta

## 📊 Estrutura de Dados

### Firestore

```typescript
// Transação com ajuste manual
{
  id: "tx_123",
  description: "Compra no mercado",
  amount: -150.00,
  date: "2026-02-15",
  invoiceMonthKey: "2026-03",        // Fatura escolhida
  invoiceMonthKeyManual: true,       // Flag de ajuste manual
  updatedAt: "2026-02-21T10:30:00Z"
}

// Transação sem ajuste (automática)
{
  id: "tx_456",
  description: "Restaurante",
  amount: -80.00,
  date: "2026-02-20",
  // invoiceMonthKey calculado automaticamente
  // invoiceMonthKeyManual não existe
}
```

## 🔄 Fluxo de Sincronização

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   App       │         │  Firestore  │         │    Web      │
│   Mobile    │         │             │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │ 1. Mover transação    │                       │
       ├──────────────────────>│                       │
       │                       │                       │
       │                       │ 2. Listener notifica  │
       │                       ├──────────────────────>│
       │                       │                       │
       │                       │ 3. UI atualiza        │
       │                       │<──────────────────────┤
       │                       │                       │
       │ 4. Listener notifica  │                       │
       │<──────────────────────┤                       │
       │                       │                       │
       │ 5. UI atualiza        │                       │
       │                       │                       │
```

## 📚 Documentação Completa

- **[INVOICE_SYNC_IMPLEMENTATION.md](./INVOICE_SYNC_IMPLEMENTATION.md)** - Documentação técnica completa
- **[INVOICE_SYNC_EXAMPLE.md](./INVOICE_SYNC_EXAMPLE.md)** - Exemplos práticos de uso
- **[INVOICE_SYNC_TESTING.md](./INVOICE_SYNC_TESTING.md)** - Guia de testes

## 🧪 Testes Rápidos

### Teste 1: App → Web
1. Abra o app mobile
2. Mova uma transação para outra fatura
3. Abra o web app
4. ✅ Verifique que a transação está na nova fatura

### Teste 2: Web → App
1. Abra o web app
2. Mova uma transação para outra fatura
3. Abra o app mobile
4. ✅ Verifique que a transação está na nova fatura

### Teste 3: Tempo Real
1. Abra app e web lado a lado
2. Mova transação no app
3. ✅ Web atualiza automaticamente
4. Mova transação no web
5. ✅ App atualiza automaticamente

## 🐛 Troubleshooting

### Problema: Mudança não sincroniza

**Solução:**
1. Verifique conexão com internet
2. Verifique se listeners do Firestore estão ativos
3. Verifique console para erros

### Problema: Botão não aparece

**Solução:**
1. Verifique se `userId` está sendo passado
2. Verifique se `currentInvoiceMonth` está definido
3. Verifique se não é pagamento ou estorno

### Problema: Erro ao mover

**Solução:**
1. Verifique permissões do Firestore
2. Verifique se transação existe
3. Verifique formato do `targetMonthKey` (deve ser YYYY-MM)

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação completa
2. Verifique os exemplos práticos
3. Execute os testes do checklist

## 🎉 Pronto!

A sincronização de fatura está implementada e funcionando. Os usuários agora podem mover transações entre faturas em qualquer plataforma com sincronização automática e em tempo real.

---

**Última atualização:** 21 de Fevereiro de 2026
