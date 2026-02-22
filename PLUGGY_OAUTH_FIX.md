# 🔧 Correção do Problema OAuth do Pluggy

## 🐛 Problema Identificado

O erro "banco não enviou o link" ocorre porque:

1. **Backend não está respondendo no Railway** - O servidor não está sendo executado corretamente
2. **Variáveis de ambiente não configuradas** - Credenciais do Pluggy e Firebase não estão definidas
3. **OAuth URL não está sendo retornada** - A API do Pluggy precisa do `clientUrl` configurado corretamente

## ✅ Soluções Implementadas

### 1. Configuração do Railway

Foram criados os arquivos:
- `railway.json` - Configuração de build e deploy
- `Procfile` - Comando de inicialização
- `RAILWAY_SETUP.md` - Guia completo de configuração

### 2. Melhorias no Código

#### a) Logs Detalhados
O servidor agora mostra logs completos sobre:
- Status da configuração (Pluggy, Firebase)
- Detalhes da criação de items
- URLs OAuth retornadas
- Erros detalhados

#### b) Endpoint de Diagnóstico
Novo endpoint: `GET /api/diagnostics`

Retorna informações sobre:
- Status do servidor
- Configurações (sem expor secrets)
- Endpoints disponíveis

#### c) Tratamento de OAuth Melhorado
O endpoint `/api/pluggy/create-item` agora:
- Configura corretamente o `clientUrl` para OAuth
- Busca a URL OAuth em múltiplas localizações da resposta
- Retorna informações de debug
- Loga toda a resposta quando não encontra URL

### 3. Script de Teste de Configuração

Execute para verificar se tudo está configurado:
```bash
cd server
npm run test:config
```

## 🚀 Passos para Resolver

### Passo 1: Configurar Variáveis no Railway

Acesse: https://railway.app/dashboard → Seu Projeto → Variables

Adicione:

```env
# Pluggy (obtenha em https://dashboard.pluggy.ai)
PLUGGY_CLIENT_ID=seu_client_id
PLUGGY_CLIENT_SECRET=seu_client_secret
PLUGGY_SANDBOX=false

# Firebase - Opção A (RECOMENDADO)
FIREBASE_SERVICE_ACCOUNT=<base64_do_json>

# OU Firebase - Opção B
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@....iam.gserviceaccount.com

# Porta (Railway define automaticamente, mas pode definir)
PORT=3001
```

#### Como gerar FIREBASE_SERVICE_ACCOUNT:

**Windows PowerShell:**
```powershell
$content = Get-Content serviceAccountKey.json -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
```

**Linux/Mac:**
```bash
base64 -w 0 serviceAccountKey.json
```

### Passo 2: Fazer Deploy

```bash
git add .
git commit -m "Fix: Configurar Railway e melhorar OAuth do Pluggy"
git push origin main
```

O Railway fará o deploy automaticamente.

### Passo 3: Testar

```bash
# 1. Health check
curl https://backendcontrolarapp-production.up.railway.app/health

# 2. Diagnóstico
curl https://backendcontrolarapp-production.up.railway.app/api/diagnostics

# 3. Listar bancos (requer autenticação)
curl -H "Authorization: Bearer SEU_TOKEN" \
  https://backendcontrolarapp-production.up.railway.app/api/pluggy/connectors
```

### Passo 4: Atualizar o App

No arquivo `.env.local` do app:
```env
EXPO_PUBLIC_API_URL=https://backendcontrolarapp-production.up.railway.app
```

## 🔍 Verificando os Logs no Railway

1. Acesse o Railway Dashboard
2. Clique no seu projeto
3. Vá em "Deployments"
4. Clique no deploy mais recente
5. Veja os logs

Procure por:
```
✅ PLUGGY_CLIENT_ID
✅ PLUGGY_CLIENT_SECRET
✅ Firebase Config
```

Se algum mostrar ❌, a variável não está configurada.

## 🐛 Problemas Comuns

### "Application failed to respond"
- **Causa**: Servidor não está iniciando
- **Solução**: Verifique os logs no Railway, confirme que as variáveis estão definidas

### "Firebase Admin not configured"
- **Causa**: Variáveis do Firebase incorretas ou mal formatadas
- **Solução**: 
  - Verifique o base64 do JSON
  - Ou use variáveis individuais
  - Teste localmente primeiro

### "Pluggy API error: 401"
- **Causa**: Credenciais do Pluggy incorretas
- **Solução**: Verifique CLIENT_ID e CLIENT_SECRET no dashboard da Pluggy

### "Banco não enviou o link"
- **Causa**: OAuth URL não está sendo retornada pela API
- **Solução**: 
  - Verifique os logs do servidor (deve mostrar a resposta completa)
  - Confirme que `PLUGGY_SANDBOX=false` para produção
  - Alguns bancos podem não retornar URL imediatamente (use polling)

## 📱 Fluxo OAuth Correto

1. App chama `/api/pluggy/create-item` com:
   ```json
   {
     "userId": "...",
     "connectorId": 201,
     "oauthRedirectUri": "controlarapp://oauth-callback"
   }
   ```

2. Backend configura `clientUrl` no payload para Pluggy

3. Pluggy retorna:
   ```json
   {
     "id": "...",
     "status": "WAITING_USER_INPUT",
     "clientUrl": "https://pluggy.ai/oauth/..."
   }
   ```

4. Backend extrai `clientUrl` e retorna para o app

5. App abre o link no navegador

6. Usuário faz login no banco

7. Banco redireciona para `controlarapp://oauth-callback?itemId=...`

8. App faz polling em `/api/pluggy/items/:id` até status = "UPDATED"

## 🆘 Ainda com Problemas?

1. Execute o teste de configuração:
   ```bash
   cd server && npm run test:config
   ```

2. Teste localmente:
   ```bash
   cd server
   npm install
   npm start
   ```

3. Verifique os logs no Railway Dashboard

4. Confirme que todas as variáveis estão definidas corretamente

5. Teste o endpoint de diagnóstico para ver o status das configurações
