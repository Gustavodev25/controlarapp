# 🧪 Guia de Testes: Sincronização de Fatura

## Checklist de Testes

### ✅ Testes Funcionais

#### 1. Mover Transação no App Mobile
- [ ] Abrir app mobile
- [ ] Navegar para tela de faturas
- [ ] Localizar uma transação
- [ ] Clicar no botão de fatura (ex: "Fev/26")
- [ ] Modal abre com lista de faturas
- [ ] Selecionar outra fatura (ex: "Março 2026")
- [ ] Modal fecha
- [ ] Transação aparece na nova fatura
- [ ] Botão mostra nova fatura e ícone roxo (override manual)

#### 2. Sincronização App → Web
- [ ] Realizar teste 1 (mover no app)
- [ ] Abrir web app em outro dispositivo/navegador
- [ ] Verificar que a transação está na nova fatura
- [ ] Verificar que há indicador de override manual

#### 3. Mover Transação no Web
- [ ] Abrir web app
- [ ] Localizar uma transação
- [ ] Mover para outra fatura usando o dropdown
- [ ] Verificar que transação mudou de fatura

#### 4. Sincronização Web → App
- [ ] Realizar teste 3 (mover no web)
- [ ] Abrir app mobile
- [ ] Verificar que a transação está na nova fatura
- [ ] Verificar indicador de override manual

#### 5. Remover Override Manual
- [ ] Mover uma transação manualmente (app ou web)
- [ ] Clicar no botão de fatura
- [ ] Clicar em "Voltar ao cálculo automático"
- [ ] Verificar que transação voltou para fatura calculada automaticamente
- [ ] Verificar que ícone roxo desapareceu

#### 6. Sincronização em Tempo Real
- [ ] Abrir app e web lado a lado
- [ ] Mover transação no app
- [ ] Verificar que web atualiza automaticamente (sem refresh)
- [ ] Mover transação no web
- [ ] Verificar que app atualiza automaticamente

### ✅ Testes de UI/UX

#### 7. Aparência do Botão
- [ ] Botão aparece em todas as transações (exceto pagamentos/estornos)
- [ ] Botão tem tamanho adequado (não muito grande/pequeno)
- [ ] Texto é legível
- [ ] Ícone de dropdown está visível
- [ ] Estado normal: fundo cinza, texto cinza
- [ ] Estado com override: fundo roxo, texto roxo, ícone de edição

#### 8. Modal de Seleção
- [ ] Modal abre suavemente
- [ ] Modal fecha ao clicar fora
- [ ] Modal fecha ao clicar no X
- [ ] Lista de faturas é scrollável
- [ ] Fatura atual está marcada com ✓
- [ ] Labels são claros (Fechada/Atual/Futura)
- [ ] Info box aparece quando há override manual
- [ ] Botão de remover override aparece quando há override

#### 9. Feedback Visual
- [ ] Modal fecha após selecionar fatura
- [ ] UI atualiza imediatamente
- [ ] Não há flickering ou bugs visuais
- [ ] Animações são suaves

### ✅ Testes de Dados

#### 10. Verificar Firestore
```javascript
// No console do Firebase
const docRef = db.collection('users')
  .doc(userId)
  .collection('creditCardTransactions')
  .doc(transactionId);

const doc = await docRef.get();
console.log(doc.data());

// Verificar campos:
// - invoiceMonthKey: "2026-03"
// - invoiceMonthKeyManual: true
// - updatedAt: timestamp recente
```

#### 11. Verificar Ambas as Coleções
- [ ] Testar com transação em `transactions`
- [ ] Testar com transação em `creditCardTransactions`
- [ ] Ambas funcionam corretamente

#### 12. Formato de Data
- [ ] `invoiceMonthKey` está no formato YYYY-MM
- [ ] Não há datas inválidas (ex: "2026-13")
- [ ] Mês com zero à esquerda (ex: "2026-03", não "2026-3")

### ✅ Testes de Edge Cases

#### 13. Transação sem Override
- [ ] Transação nova (sem `invoiceMonthKeyManual`)
- [ ] Botão aparece normalmente
- [ ] Não mostra ícone roxo
- [ ] Pode ser movida normalmente

#### 14. Transação com Override
- [ ] Transação com `invoiceMonthKeyManual: true`
- [ ] Botão mostra ícone roxo
- [ ] Modal mostra info box
- [ ] Botão de remover override aparece

#### 15. Múltiplas Mudanças Rápidas
- [ ] Mover transação para fatura A
- [ ] Imediatamente mover para fatura B
- [ ] Imediatamente mover para fatura C
- [ ] Verificar que ficou na fatura C
- [ ] Não há inconsistências

#### 16. Offline/Online
- [ ] Desconectar internet
- [ ] Tentar mover transação
- [ ] Verificar tratamento de erro
- [ ] Reconectar internet
- [ ] Tentar novamente
- [ ] Deve funcionar

#### 17. Transações Especiais
- [ ] Pagamento de fatura: botão NÃO deve aparecer
- [ ] Estorno: botão NÃO deve aparecer
- [ ] Transação parcelada: botão deve aparecer
- [ ] Transação projetada: botão deve aparecer

### ✅ Testes de Performance

#### 18. Lista Grande
- [ ] Testar com 100+ transações
- [ ] Scroll deve ser suave
- [ ] Botões devem renderizar rapidamente
- [ ] Não deve haver lag ao abrir modal

#### 19. Múltiplos Usuários
- [ ] Usuário A move transação
- [ ] Usuário B (mesmo dispositivo) vê mudança
- [ ] Não há conflitos

### ✅ Testes de Compatibilidade

#### 20. Plataformas
- [ ] iOS
- [ ] Android
- [ ] Web (Chrome)
- [ ] Web (Safari)
- [ ] Web (Firefox)

#### 21. Tamanhos de Tela
- [ ] Smartphone pequeno (< 5")
- [ ] Smartphone médio (5-6")
- [ ] Smartphone grande (> 6")
- [ ] Tablet
- [ ] Desktop

## Scripts de Teste Automatizado

### Teste de Integração

```typescript
import { moveTransactionToInvoice } from '@/services/invoiceService';

describe('Invoice Service', () => {
    it('should move transaction to another invoice', async () => {
        const result = await moveTransactionToInvoice({
            userId: 'test_user',
            transactionId: 'test_tx',
            targetMonthKey: '2026-03'
        });

        expect(result.success).toBe(true);
    });

    it('should remove override', async () => {
        const result = await moveTransactionToInvoice({
            userId: 'test_user',
            transactionId: 'test_tx',
            targetMonthKey: '',
            isRemoveOverride: true
        });

        expect(result.success).toBe(true);
    });

    it('should handle invalid transaction', async () => {
        const result = await moveTransactionToInvoice({
            userId: 'test_user',
            transactionId: 'invalid_tx',
            targetMonthKey: '2026-03'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

### Teste de Componente

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { InvoiceSelectorButton } from '@/components/InvoiceSelectorButton';

describe('InvoiceSelectorButton', () => {
    it('should render correctly', () => {
        const { getByText } = render(
            <InvoiceSelectorButton
                currentInvoiceMonth="2026-02"
                availableInvoices={[]}
                onMoveToInvoice={() => {}}
                hasManualOverride={false}
            />
        );

        expect(getByText('Fev/26')).toBeTruthy();
    });

    it('should show manual override indicator', () => {
        const { getByTestId } = render(
            <InvoiceSelectorButton
                currentInvoiceMonth="2026-02"
                availableInvoices={[]}
                onMoveToInvoice={() => {}}
                hasManualOverride={true}
            />
        );

        // Verificar que ícone roxo está presente
        expect(getByTestId('manual-override-icon')).toBeTruthy();
    });

    it('should open modal on press', () => {
        const { getByText, getByTestId } = render(
            <InvoiceSelectorButton
                currentInvoiceMonth="2026-02"
                availableInvoices={[
                    { monthKey: '2026-03', label: 'Março 2026', isCurrent: false }
                ]}
                onMoveToInvoice={() => {}}
                hasManualOverride={false}
            />
        );

        fireEvent.press(getByText('Fev/26'));
        
        // Modal deve estar visível
        expect(getByText('Mover para fatura')).toBeTruthy();
    });
});
```

## Métricas de Sucesso

### Funcionalidade
- ✅ 100% dos testes funcionais passam
- ✅ Sincronização bidirecional funciona
- ✅ Dados são salvos corretamente no Firestore

### Performance
- ✅ Modal abre em < 300ms
- ✅ Atualização após mover em < 500ms
- ✅ Scroll suave (60 FPS)

### UX
- ✅ Interface intuitiva
- ✅ Feedback visual claro
- ✅ Sem bugs visuais

## Relatório de Bugs

### Template

```markdown
## Bug: [Título]

**Severidade:** Crítico / Alto / Médio / Baixo

**Descrição:**
[Descrever o problema]

**Passos para Reproduzir:**
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Resultado Esperado:**
[O que deveria acontecer]

**Resultado Atual:**
[O que está acontecendo]

**Screenshots:**
[Anexar screenshots se aplicável]

**Ambiente:**
- Plataforma: iOS / Android / Web
- Versão: [versão do app]
- Dispositivo: [modelo]
```

## Conclusão

Após completar todos os testes deste checklist, a funcionalidade de sincronização de fatura estará validada e pronta para produção.
