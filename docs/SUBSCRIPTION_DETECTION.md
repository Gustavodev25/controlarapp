# Detecção Automática de Assinaturas

## Visão Geral

O sistema de detecção automática de assinaturas identifica pagamentos recorrentes nas transações bancárias do usuário e sugere a criação de assinaturas no app. A análise é executada **automaticamente todos os dias** às 9h da manhã.

## Como Funciona

### 1. Análise Diária Automática

O sistema executa uma análise completa todos os dias:

1. **Agendamento**: Na primeira vez que o usuário acessa a tela de assinaturas, o sistema agenda uma tarefa diária
2. **Execução**: Todos os dias às 9h, o sistema:
   - Busca todas as transações bancárias
   - Identifica padrões recorrentes
   - Compara com assinaturas já existentes
   - Salva apenas novas detecções
3. **Notificação**: Se novas assinaturas forem detectadas, o usuário recebe uma notificação
4. **Persistência**: Detecções ficam salvas até serem validadas ou descartadas

### 2. Detecção em Tempo Real

Além da análise diária, o sistema também:

- Carrega detecções pendentes ao abrir a tela de assinaturas
- Permite análise manual através do botão ✨
- Mantém histórico de detecções não validadas

### 2. Validação pelo Usuário

**IMPORTANTE**: Assinaturas detectadas NÃO são somadas nos totais até que o usuário as valide.

- Assinaturas detectadas têm `isValidated: false` (ou undefined)
- Apenas após validação, `isValidated: true` e são incluídas nos cálculos
- Assinaturas criadas manualmente já vêm com `isValidated: true`

Isso garante que:
- Os totais mostram apenas assinaturas confirmadas
- Usuário tem controle total sobre o que é contabilizado
- Não há "surpresas" nos valores totais

### 2. Critérios de Detecção

Uma assinatura é detectada quando:

- **Mínimo de 2 ocorrências** da mesma transação
- **Frequência identificada**:
  - Mensal: intervalo de 25-35 dias entre transações
  - Anual: intervalo de 350-380 dias entre transações
- **Valores consistentes**: variação máxima de 5% entre transações

**Nota**: Assinaturas detectadas são marcadas com `isValidated: true` apenas após validação do usuário.

### 3. Níveis de Confiança

Cada assinatura detectada recebe um nível de confiança:

- **Alta**: 3+ ocorrências, valores muito consistentes (< 5% variação)
- **Média**: 2+ ocorrências, valores razoavelmente consistentes (< 15% variação)
- **Baixa**: Padrão detectado mas com inconsistências

### 4. Categorização Automática

O sistema tenta categorizar automaticamente as assinaturas baseado em palavras-chave:

- **Streaming**: Netflix, Spotify, Prime, Disney+, HBO, YouTube, Deezer, Apple Music
- **Assinaturas**: Termos genéricos de assinatura
- **Serviços**: Internet, telefone, celular, energia, água, gás
- **Saúde**: Academia, gym, plano de saúde
- **Educação**: Curso, escola, faculdade
- **Transporte**: Uber, Cabify, 99, estacionamento
- **Outros**: Quando não se encaixa em nenhuma categoria

## Interface do Usuário

### Modal de Assinaturas Detectadas

Quando assinaturas são detectadas, um modal é exibido mostrando:

- Nome da assinatura (baseado na descrição da transação)
- Valor médio
- Frequência (mensal ou anual)
- Número de ocorrências
- Nível de confiança
- Categoria sugerida

### Ações Disponíveis

Para cada assinatura detectada, o usuário pode:

1. **Validar**: Cria a assinatura no app com os dados detectados e marca como `isValidated: true`, incluindo nos totais
2. **Desconsiderar**: Remove da lista sem criar a assinatura

**Importante**: Apenas assinaturas validadas são somadas nos totais mensais e anuais.

### Detecção Manual

O usuário pode acionar a detecção manualmente através do botão com ícone de estrela (✨) na tela de assinaturas. Isso força uma nova análise imediata, ignorando a verificação de "já executado hoje".

## Arquivos Principais

### 1. **`services/dailySubscriptionAnalysis.ts`** (NOVO)
   - Gerenciamento de análise diária
   - Agendamento de notificações
   - Persistência de detecções pendentes
   - Funções principais:
     - `scheduleDailySubscriptionAnalysis()`: Agenda análise diária
     - `runDailySubscriptionAnalysis()`: Executa análise
     - `loadPendingDetections()`: Carrega detecções salvas
     - `removePendingDetection()`: Remove após validar/descartar
     - `forceRunAnalysis()`: Força análise manual

1. **`services/subscriptionDetector.ts`**
   - Lógica de detecção de padrões
   - Algoritmos de similaridade
   - Cálculo de frequência e confiança

2. **`components/DetectedSubscriptionsModal.tsx`**
   - Interface do modal
   - Gerenciamento de estado das assinaturas
   - Ações de validar/desconsiderar

3. **`components/RecurrenceView.tsx`**
   - Integração com a tela de assinaturas
   - Trigger automático na primeira conexão bancária
   - Botão de detecção manual

### Fluxo de Dados

```
[Agendamento Diário - 9h]
        ↓
runDailySubscriptionAnalysis()
        ↓
Busca Transações Bancárias
        ↓
detectSubscriptions()
        ↓
Filtra Novas (não existentes)
        ↓
savePendingDetections()
        ↓
Notificação (se houver novas)
        ↓
[Usuário abre app]
        ↓
loadPendingDetections()
        ↓
DetectedSubscriptionsModal
        ↓
Validar → addRecurrence() + removePendingDetection()
Descartar → removePendingDetection()
```

### Persistência

- **Agendamento**: `AsyncStorage` - `daily_subscription_analysis_scheduled`
- **Última análise**: `AsyncStorage` - `last_subscription_analysis_date` (YYYY-MM-DD)
- **Detecções pendentes**: `AsyncStorage` - `pending_subscription_detections_{userId}`

Estrutura das detecções pendentes:
```json
{
  "detections": [DetectedSubscription[]],
  "date": "2024-02-18T09:00:00.000Z"
}
```

## Melhorias Futuras

1. **Machine Learning**: Usar ML para melhorar a detecção de padrões
2. **Edição antes de validar**: Permitir editar nome, valor e categoria antes de criar
3. **Histórico de desconsideradas**: Manter registro das assinaturas desconsideradas para não sugerir novamente
4. **Sugestões inteligentes**: Sugerir cancelamento de assinaturas não utilizadas
5. **Alertas de variação**: Notificar quando o valor de uma assinatura mudar
6. **Comparação de preços**: Sugerir alternativas mais baratas
7. **Análise em horários personalizados**: Permitir usuário escolher horário da análise
8. **Detecção de cancelamentos**: Identificar quando uma assinatura foi cancelada (sem transações recentes)

## Exemplos de Uso

### Cenário 1: Netflix Mensal

```
Transações detectadas:
- 15/01/2024: NETFLIX.COM - R$ 39,90
- 15/02/2024: NETFLIX.COM - R$ 39,90
- 15/03/2024: NETFLIX.COM - R$ 39,90

Resultado:
- Nome: NETFLIX.COM
- Valor: R$ 39,90
- Frequência: Mensal
- Confiança: Alta
- Categoria: Streaming
```

### Cenário 2: Academia com Variação

```
Transações detectadas:
- 05/01/2024: SMART FIT - R$ 89,90
- 05/02/2024: SMART FIT - R$ 89,90
- 05/03/2024: SMART FIT - R$ 94,90 (reajuste)

Resultado:
- Nome: SMART FIT
- Valor: R$ 91,57 (média)
- Frequência: Mensal
- Confiança: Média
- Categoria: Saúde
```

## Cálculo de Totais

### Regra de Validação

O sistema calcula os totais (mensal, anual, a pagar, etc.) considerando apenas:

- Assinaturas com `isValidated: true` (validadas pelo usuário)
- Assinaturas criadas manualmente (sempre `isValidated: true`)

**Excluídos dos totais**:
- Assinaturas detectadas mas não validadas (`isValidated: false` ou `undefined`)

### Exemplo

```typescript
// Assinatura detectada (NÃO soma)
{
  name: "Netflix",
  amount: 39.90,
  isValidated: false // ou undefined
}

// Assinatura validada (SOMA)
{
  name: "Netflix",
  amount: 39.90,
  isValidated: true
}

// Assinatura manual (SOMA)
{
  name: "Spotify",
  amount: 19.90,
  isValidated: true // sempre true para manuais
}
```

## Considerações de Performance

- Detecção executada de forma assíncrona
- Não bloqueia a interface do usuário
- Cache de resultados (executa apenas 1x por dia)
- Otimizado para grandes volumes de transações (1000+)
- Notificações silenciosas durante análise
- Detecções salvas localmente (não sobrecarrega Firebase)

## Notificações

### Tipos de Notificações

1. **Análise Diária** (9h, silenciosa):
   - Título: "🔍 Análise de Assinaturas"
   - Corpo: "Analisando suas transações bancárias..."
   - Som: Desativado

2. **Novas Detecções** (imediata, com som):
   - Título: "🎯 Novas Assinaturas Detectadas!"
   - Corpo: "Encontramos X possível(is) assinatura(s) nas suas transações."
   - Som: Ativado

### Gerenciamento

- Notificações podem ser desativadas nas configurações do sistema
- Análise continua executando mesmo com notificações desativadas
- Detecções ficam disponíveis ao abrir o app

## Privacidade e Segurança

- Processamento local no dispositivo
- Nenhum dado enviado para servidores externos
- Usuário tem controle total sobre o que é criado
- Possibilidade de desconsiderar qualquer sugestão
