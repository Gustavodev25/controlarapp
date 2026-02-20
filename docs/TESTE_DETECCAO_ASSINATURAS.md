# Guia de Teste - Detecção de Assinaturas

## Como Testar a Funcionalidade

### Pré-requisitos
1. Ter uma conta bancária conectada via Open Finance
2. Ter transações recorrentes na conta (ex: Netflix, Spotify, etc.)

### Teste 1: Análise Manual (Mais Rápido)

1. Abra o app e vá para a aba "Assinaturas"
2. Clique no botão com ícone de estrela (✨) no canto superior direito
3. Aguarde o processamento
4. O modal deve aparecer mostrando as assinaturas detectadas

### Teste 2: Análise Automática

1. Abra o app e vá para a aba "Assinaturas"
2. A análise executa automaticamente ao abrir a tela
3. Se houver detecções pendentes, o modal aparece automaticamente

### Teste 3: Forçar Detecção com Dados de Teste

Se você não tem transações reais, pode adicionar dados de teste:

1. Abra o console do React Native (Metro Bundler)
2. Procure por logs com `[DailyAnalysis]` e `[RecurrenceView]`
3. Verifique se há erros ou mensagens importantes

### O que Verificar nos Logs

Procure por estas mensagens no console:

```
[RecurrenceView] Setting up daily analysis...
[DailyAnalysis] Starting analysis for user: [userId]
[DailyAnalysis] Found X accounts
[DailyAnalysis] Total transactions: X
[DailyAnalysis] Detected X subscriptions
[DailyAnalysis] X new subscriptions
[DailyAnalysis] Total pending after merge: X
[RecurrenceView] Pending detections: X
[RecurrenceView] Showing modal with X detections
[DetectedSubscriptionsModal] Rendering: { visible: true, remainingCount: X }
```

### Problemas Comuns

#### Modal não aparece

**Possíveis causas:**
1. Não há transações bancárias
2. Não há padrões recorrentes detectados
3. Todas as assinaturas já foram validadas ou descartadas
4. Análise já foi executada hoje (cache de 24h)

**Soluções:**
1. Verifique os logs do console
2. Use o botão ✨ para forçar nova análise
3. Limpe o cache do AsyncStorage:
   ```javascript
   // No console do React Native
   AsyncStorage.clear()
   ```

#### Erro ao buscar transações

**Causa:** Conta bancária não conectada ou sem permissões

**Solução:** 
1. Vá para "Open Finance"
2. Reconecte a conta bancária
3. Sincronize as transações

#### Detecções duplicadas

**Causa:** Assinaturas já existem no sistema

**Solução:** O sistema filtra automaticamente duplicatas. Se aparecer, é porque o nome é diferente.

### Testando o Modal

Quando o modal aparecer, você deve ver:

1. **Título**: "Assinaturas Detectadas"
2. **Subtítulo**: "Identificamos X possível(is) assinatura(s)..."
3. **Cards** com:
   - Nome da assinatura
   - Valor médio
   - Frequência (Mensal/Anual)
   - Número de ocorrências
   - Badge de confiança (Alta/Média/Baixa)
   - Categoria sugerida
4. **Botões**:
   - "Desconsiderar" (vermelho)
   - "Validar" (laranja)

### Testando as Ações

#### Validar Assinatura
1. Clique em "Validar"
2. A assinatura deve ser criada
3. O card desaparece do modal
4. Verifique na lista de assinaturas se foi criada

#### Desconsiderar Assinatura
1. Clique em "Desconsiderar"
2. O card desaparece do modal
3. A assinatura não é criada

#### Fechar Modal
1. Clique em "Revisar Depois" ou "Fechar"
2. Modal fecha
3. Detecções pendentes ficam salvas
4. Ao reabrir a tela, modal aparece novamente

### Verificando Persistência

1. Valide ou descarte algumas assinaturas
2. Feche o app completamente
3. Reabra o app
4. Vá para "Assinaturas"
5. Apenas as não revisadas devem aparecer no modal

### Testando Análise Diária

1. Aguarde até 9h da manhã do próximo dia
2. Você deve receber uma notificação se houver novas detecções
3. Abra o app
4. Modal aparece automaticamente com novas detecções

### Debug Avançado

Se nada funcionar, execute este código no console:

```javascript
// Verificar detecções pendentes
import AsyncStorage from '@react-native-async-storage/async-storage';

AsyncStorage.getItem('pending_subscription_detections_[SEU_USER_ID]')
  .then(data => console.log('Pending:', JSON.parse(data)));

// Verificar última análise
AsyncStorage.getItem('last_subscription_analysis_date')
  .then(date => console.log('Last analysis:', date));

// Limpar cache para forçar nova análise
AsyncStorage.removeItem('last_subscription_analysis_date');
```

### Exemplo de Transações que Devem Ser Detectadas

Para que uma assinatura seja detectada, você precisa ter:

**Exemplo 1: Netflix (Mensal)**
```
- 15/01/2024: NETFLIX.COM - R$ 39,90
- 15/02/2024: NETFLIX.COM - R$ 39,90
- 15/03/2024: NETFLIX.COM - R$ 39,90
```
✅ Detectado: 3 ocorrências, intervalo ~30 dias, valor consistente

**Exemplo 2: Spotify (Mensal)**
```
- 05/01/2024: SPOTIFY - R$ 19,90
- 05/02/2024: SPOTIFY - R$ 19,90
```
✅ Detectado: 2 ocorrências, intervalo ~30 dias

**Exemplo 3: Não Detectado**
```
- 10/01/2024: UBER - R$ 25,00
- 15/01/2024: UBER - R$ 30,00
- 20/01/2024: UBER - R$ 15,00
```
❌ Não detectado: Valores muito diferentes, sem padrão de frequência

### Contato para Suporte

Se após seguir todos os passos o modal ainda não aparecer:

1. Copie os logs do console
2. Verifique se há erros em vermelho
3. Compartilhe os logs para análise
