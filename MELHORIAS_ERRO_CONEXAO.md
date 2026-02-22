# Melhorias no Tratamento de Erros de Conexão Bancária

## Problema Original

O aplicativo mostrava uma mensagem genérica "O banco recusou a conexão ou exige dupla validação (MFA) que ainda não é suportada" para todos os tipos de erro de conexão, dificultando o diagnóstico do problema real.

## Melhorias Implementadas

### 1. Mensagens de Erro Específicas por Status

Agora o sistema diferencia os erros baseado no status retornado pelo Pluggy:

- **LOGIN_ERROR**: "Credenciais inválidas ou banco temporariamente indisponível. Verifique seus dados e tente novamente."
- **WAITING_USER_INPUT**: "O banco está aguardando uma ação sua. Verifique se há notificações no app do banco ou tente novamente."
- **OUTDATED**: "A conexão expirou. Por favor, reconecte sua conta bancária."
- **ERROR**: Verifica se é erro de MFA especificamente, caso contrário mostra mensagem genérica

### 2. Detecção Inteligente de MFA

O sistema agora verifica se o erro realmente é relacionado a MFA analisando a mensagem de erro retornada pela API do Pluggy, procurando por palavras-chave como "mfa", "autenticação" ou "token".

### 3. Logging Aprimorado

- Backend agora registra detalhes completos do erro quando a criação do item falha
- Endpoint de status do item registra informações quando o status não é "UPDATED"
- Frontend registra detalhes do erro no console para facilitar debug

### 4. Tratamento de Códigos de Erro Específicos

O frontend agora reconhece códigos de erro específicos:

- `INVALID_CREDENTIALS`: Credenciais inválidas
- `INSTITUTION_UNAVAILABLE`: Banco temporariamente indisponível
- `MFA_REQUIRED`: MFA não suportado

## Como Testar

### Teste 1: Credenciais Inválidas
1. Tente conectar com um banco usando credenciais erradas
2. Verifique se a mensagem é específica sobre credenciais inválidas

### Teste 2: Banco Indisponível
1. Tente conectar durante manutenção do banco
2. Verifique se a mensagem indica indisponibilidade temporária

### Teste 3: MFA Real
1. Tente conectar com um banco que requer MFA
2. Verifique se a mensagem menciona especificamente MFA

### Teste 4: Logs no Console
1. Abra o console do navegador (frontend) e terminal do servidor (backend)
2. Tente fazer uma conexão que falhe
3. Verifique se os logs mostram detalhes úteis para debug

## Arquivos Modificados

- `app/(tabs)/open-finance.tsx`: Tratamento de erros no frontend
- `server/api/pluggy.js`: Logging e detalhes de erro no backend

## Próximos Passos Recomendados

1. **Implementar Suporte a MFA**: Adicionar fluxo para capturar código MFA do usuário
2. **Retry Automático**: Para erros temporários, tentar reconectar automaticamente
3. **Notificações Push**: Alertar usuário quando ação é necessária no app do banco
4. **Dashboard de Status**: Mostrar status de todas as conexões bancárias em um só lugar
