## Diagnóstico
- Hoje “Assinaturas” e “Lembretes” (recorrências) usam a mesma tela ([RecurrenceView.tsx](file:///c:/Users/de/Desktop/controlarapp/components/RecurrenceView.tsx)) e o mesmo modal ([ReminderModal.tsx](file:///c:/Users/de/Desktop/controlarapp/components/ReminderModal.tsx)).
- O principal desalinhamento visível está no Dashboard → Calendário Financeiro ([FinancialCalendar.tsx](file:///c:/Users/de/Desktop/controlarapp/components/FinancialCalendar.tsx)): lembretes entram sem `category` (porque o listener de lembretes não repassa), e a UI cai no fallback “Lançamento”, além de usar paleta/ícone diferente das assinaturas.
- Também há um bug de UX no empty-state: o botão “Novo Lembrete/Nova Assinatura” não tem `onPress` e não abre o modal.

## Objetivo
- Fazer “Lembretes” ficarem com o mesmo padrão de “Assinaturas” (mesma estrutura, comportamento e visual onde faz sentido), principalmente no Calendário do Dashboard e no estado vazio.

## Mudanças Planejadas
### 1) Padronizar o shape de dados de Lembretes (igual Assinaturas)
- Ajustar o listener `onRecurrencesChange` para lembretes em [firebase.ts](file:///c:/Users/de/Desktop/controlarapp/services/firebase.ts) para retornar os mesmos campos que assinaturas já retornam:
  - Incluir `category: data.category || 'Lembretes'`.
  - Manter `frequency` compatível (ler também `data.recurrence`/`data.cycle` se existir, igual assinaturas).
  - (Opcional, se existir no doc) propagar `logo/icon` para o calendário, igual assinaturas.

### 2) Deixar o Calendário Financeiro com lembretes “igual assinaturas”
- Em [FinancialCalendar.tsx](file:///c:/Users/de/Desktop/controlarapp/components/FinancialCalendar.tsx):
  - Ajustar o texto de categoria/fallback para lembretes (ex.: “Lembrete” em vez de “Lançamento”).
  - Padronizar o estilo de recorrências para que lembretes usem o mesmo padrão visual das assinaturas (mesma cor base e mesma família de ícone para recorrência), mantendo apenas o título diferente.
  - Garantir que o status (Pago/Pendente) apareça igual para os dois.

### 3) Corrigir o botão do empty-state para Lembretes e Assinaturas
- Em [RecurrenceView.tsx](file:///c:/Users/de/Desktop/controlarapp/components/RecurrenceView.tsx):
  - Adicionar `onPress` no botão “Novo Lembrete/Nova Assinatura” para abrir o mesmo fluxo de criação que já existe (modal), deixando os dois tipos com a mesma UX quando a lista estiver vazia.

## Verificação
- Rodar TypeScript/Expo build (ou o comando de verificação já usado no projeto) para garantir que:
  - Não quebrou tipagem do `recurrences` no Dashboard.
  - O calendário exibe lembretes com o mesmo padrão de assinaturas.
  - O botão do empty-state abre o modal nos dois casos.

Se você confirmar, eu implemento essas 3 mudanças e já valido no app.