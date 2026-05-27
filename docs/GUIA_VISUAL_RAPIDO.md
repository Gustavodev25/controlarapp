# 📱 Guia Visual Rápido - Sincronização de Fatura

## 🎯 Como Usar (Usuário Final)

### 1️⃣ Localizar o Botão de Fatura

```
┌─────────────────────────────────────────────┐
│  🛒  Compra no Mercado          -R$ 150,00  │
│      Supermercado  [Fev/26 ▼]              │ ← CLIQUE AQUI
└─────────────────────────────────────────────┘
```

O botão aparece logo abaixo da descrição, ao lado da categoria.

### 2️⃣ Selecionar Nova Fatura

```
┌─────────────────────────────────────────────┐
│  Mover para fatura                    [X]   │
├─────────────────────────────────────────────┤
│                                             │
│  📅 Janeiro 2026 (Fechada)                  │
│  📅 Fevereiro 2026 (Atual)          ✓       │
│  📅 Março 2026 (Futura)             ← CLIQUE│
│  📅 Abril 2026 (Futura)                     │
│  📅 Maio 2026 (Futura)                      │
│                                             │
└─────────────────────────────────────────────┘
```

Escolha a fatura de destino na lista.

### 3️⃣ Confirmar Mudança

```
┌─────────────────────────────────────────────┐
│  🛒  Compra no Mercado          -R$ 150,00  │
│      Supermercado  [Mar/26 ▼] 🟣           │ ← MUDOU!
└─────────────────────────────────────────────┘
```

O botão agora mostra a nova fatura e um ícone roxo indicando ajuste manual.

### 4️⃣ Voltar ao Automático (Opcional)

```
┌─────────────────────────────────────────────┐
│  Mover para fatura                    [X]   │
├─────────────────────────────────────────────┤
│  ℹ️  Esta transação foi movida manualmente  │
├─────────────────────────────────────────────┤
│  📅 Janeiro 2026 (Fechada)                  │
│  📅 Fevereiro 2026 (Atual)                  │
│  📅 Março 2026 (Futura)             ✓       │
│  📅 Abril 2026 (Futura)                     │
├─────────────────────────────────────────────┤
│  🔄 Voltar ao cálculo automático    ← CLIQUE│
└─────────────────────────────────────────────┘
```

Clique para remover o ajuste manual e deixar o sistema calcular automaticamente.

## 🎨 Estados Visuais

### Estado Normal (Sem Ajuste)
```
[Fev/26 ▼]
```
- Fundo: Cinza claro
- Texto: Cinza
- Sem ícone especial

### Estado com Ajuste Manual
```
🟣 [Mar/26 ▼]
```
- Fundo: Roxo claro
- Texto: Roxo
- Ícone: Lápis/Edição

### Estado Desabilitado (Pagamentos/Estornos)
```
(Botão não aparece)
```
- Pagamentos de fatura: Sem botão
- Estornos: Sem botão

## 🔄 Sincronização

### App Mobile → Web

```
📱 APP MOBILE                    💻 WEB
┌──────────────┐                ┌──────────────┐
│ Mover para   │                │              │
│ Março 2026   │                │              │
└──────┬───────┘                └──────────────┘
       │                               │
       │ 1. Salvar no Firestore        │
       ├──────────────────────────────>│
       │                               │
       │ 2. Listener notifica          │
       │<──────────────────────────────┤
       │                               │
       │                        ┌──────┴───────┐
       │                        │ Atualiza UI  │
       │                        │ Fev → Mar    │
       │                        └──────────────┘
```

### Web → App Mobile

```
💻 WEB                          📱 APP MOBILE
┌──────────────┐                ┌──────────────┐
│ Mover para   │                │              │
│ Abril 2026   │                │              │
└──────┬───────┘                └──────────────┘
       │                               │
       │ 1. Salvar no Firestore        │
       ├──────────────────────────────>│
       │                               │
       │ 2. Listener notifica          │
       │<──────────────────────────────┤
       │                               │
       │                        ┌──────┴───────┐
       │                        │ Atualiza UI  │
       │                        │ Fev → Abr    │
       │                        └──────────────┘
```

## 📊 Fluxo Completo

```
┌─────────────────────────────────────────────────────────┐
│                    INÍCIO                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Usuário clica no      │
         │ botão de fatura       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Modal abre com        │
         │ lista de faturas      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Usuário seleciona     │
         │ nova fatura           │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Sistema salva no      │
         │ Firestore             │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Firestore notifica    │
         │ todos os listeners    │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ UI atualiza em        │
         │ todas as plataformas  │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Botão mostra nova     │
         │ fatura + ícone roxo   │
         └───────────┬───────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                     FIM                                 │
└─────────────────────────────────────────────────────────┘
```

## 🎯 Casos de Uso Comuns

### Caso 1: Compra Parcelada
```
Situação: Comprou algo parcelado em 12x no dia 25
Problema: Primeira parcela vai para fatura atual (fecha dia 10)
Solução: Mover primeira parcela para próxima fatura

┌─────────────────────────────────────────────┐
│  🛒  Notebook 12x              -R$ 500,00   │
│      Eletrônicos  [Fev/26 ▼]               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  🛒  Notebook 12x              -R$ 500,00   │
│      Eletrônicos  [Mar/26 ▼] 🟣            │
└─────────────────────────────────────────────┘
```

### Caso 2: Erro de Classificação
```
Situação: Banco classificou compra na fatura errada
Problema: Transação aparece na fatura atual mas deveria estar na anterior
Solução: Mover para fatura correta

┌─────────────────────────────────────────────┐
│  🍔  Restaurante               -R$ 80,00    │
│      Alimentação  [Fev/26 ▼]               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  🍔  Restaurante               -R$ 80,00    │
│      Alimentação  [Jan/26 ▼] 🟣            │
└─────────────────────────────────────────────┘
```

### Caso 3: Planejamento Financeiro
```
Situação: Quer adiar pagamento para próximo mês
Problema: Compra vai para fatura atual que já está alta
Solução: Mover para próxima fatura

┌─────────────────────────────────────────────┐
│  👕  Roupas                    -R$ 300,00   │
│      Vestuário  [Fev/26 ▼]                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  👕  Roupas                    -R$ 300,00   │
│      Vestuário  [Mar/26 ▼] 🟣              │
└─────────────────────────────────────────────┘
```

## ⚠️ Avisos Importantes

### ✅ Pode Mover
- ✅ Compras normais
- ✅ Compras parceladas
- ✅ Transações projetadas
- ✅ Qualquer transação de débito

### ❌ Não Pode Mover
- ❌ Pagamentos de fatura
- ❌ Estornos
- ❌ (Botão não aparece nestes casos)

## 🔍 Identificar Ajuste Manual

### Visual no Botão
```
Normal:    [Fev/26 ▼]           (cinza)
Manual:    🟣 [Mar/26 ▼]        (roxo + ícone)
```

### Visual no Modal
```
┌─────────────────────────────────────────────┐
│  ℹ️  Esta transação foi movida manualmente  │ ← Info box
└─────────────────────────────────────────────┘
```

### Visual na Lista
```
Sem ajuste:
┌─────────────────────────────────────────────┐
│  🛒  Compra                    -R$ 150,00   │
│      Supermercado  [Fev/26 ▼]              │
└─────────────────────────────────────────────┘

Com ajuste:
┌─────────────────────────────────────────────┐
│  🛒  Compra                    -R$ 150,00   │
│      Supermercado  [Mar/26 ▼] 🟣           │ ← Roxo!
└─────────────────────────────────────────────┘
```

## 🎉 Pronto!

Agora você sabe como usar a funcionalidade de mudança de fatura. É simples, rápido e sincroniza automaticamente entre todas as plataformas!

---

**Dica:** Se tiver dúvidas, consulte a documentação completa em `docs/SINCRONIZACAO_FATURA_README.md`
