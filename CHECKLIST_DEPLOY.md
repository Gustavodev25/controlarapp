# ✅ Checklist de Deploy - Railway

Use este checklist para garantir que tudo está configurado corretamente.

## 📋 Antes do Deploy

### 1. Credenciais do Pluggy
- [ ] Tenho CLIENT_ID da Pluggy
- [ ] Tenho CLIENT_SECRET da Pluggy
- [ ] Sei se vou usar SANDBOX (true) ou PRODUÇÃO (false)

**Onde obter:** https://dashboard.pluggy.ai

### 2. Credenciais do Firebase
- [ ] Tenho o arquivo `serviceAccountKey.json` OU
- [ ] Tenho PROJECT_ID, PRIVATE_KEY e CLIENT_EMAIL

**Onde obter:** Firebase Console → Project Settings → Service Accounts

### 3. Arquivos do Projeto
- [ ] `railway.json` existe na raiz
- [ ] `Procfile` existe na raiz
- [ ] `server/package.json` tem o script "start"

## 🚀 Durante o Deploy

### 4. Configurar Railway
- [ ] Acessei https://railway.app/dashboard
- [ ] Selecionei o projeto correto
- [ ] Fui em "Variables"
- [ ] Adicionei `PLUGGY_CLIENT_ID`
- [ ] Adicionei `PLUGGY_CLIENT_SECRET`
- [ ] Adicionei `PLUGGY_SANDBOX` (true ou false)
- [ ] Adicionei `PORT=3001`
- [ ] Adicionei configuração do Firebase (Base64 OU variáveis separadas)

### 5. Fazer Deploy
- [ ] Executei `git add .`
- [ ] Executei `git commit -m "Configurar Railway"`
- [ ] Executei `git push origin main`
- [ ] Aguardei o deploy no Railway Dashboard

## ✅ Após o Deploy

### 6. Testar o Backend
- [ ] Acessei `https://backendcontrolarapp-production.up.railway.app/health`
- [ ] Recebi resposta: `{"status":"ok","timestamp":"..."}`
- [ ] Acessei `https://backendcontrolarapp-production.up.railway.app/api/diagnostics`
- [ ] Todas as configurações mostram `true`

### 7. Verificar Logs
- [ ] Acessei Railway Dashboard → Deployments → Logs
- [ ] Vi a mensagem "🚀 ControlarApp Backend - ONLINE"
- [ ] Vi ✅ ao lado de PLUGGY_CLIENT_ID
- [ ] Vi ✅ ao lado de PLUGGY_CLIENT_SECRET
- [ ] Vi ✅ ao lado de Firebase Config

### 8. Configurar o App
- [ ] Criei arquivo `.env.local` na raiz do projeto
- [ ] Adicionei `EXPO_PUBLIC_API_URL=https://backendcontrolarapp-production.up.railway.app`
- [ ] Reiniciei o app Expo

### 9. Testar OAuth do Pluggy
- [ ] Abri o app
- [ ] Tentei conectar um banco
- [ ] O link OAuth foi gerado
- [ ] Consegui fazer login no banco
- [ ] Fui redirecionado de volta ao app
- [ ] Os dados foram sincronizados

## 🐛 Troubleshooting

### ❌ Health check não responde
**Problema:** `https://backendcontrolarapp-production.up.railway.app/health` não abre

**Soluções:**
1. Verifique os logs no Railway Dashboard
2. Confirme que `railway.json` e `Procfile` estão na raiz
3. Verifique se o deploy foi concluído com sucesso

### ❌ Diagnostics mostra configurações false
**Problema:** `/api/diagnostics` mostra `pluggyClientId: false` ou `firebaseConfigured: false`

**Soluções:**
1. Verifique se as variáveis estão definidas no Railway
2. Confirme que não há espaços extras nos valores
3. Para Firebase Base64, teste decodificar localmente primeiro

### ❌ "Firebase Admin not configured"
**Problema:** Erro ao tentar usar endpoints autenticados

**Soluções:**
1. Verifique o formato do Base64 (sem quebras de linha)
2. Ou use variáveis separadas (PROJECT_ID, PRIVATE_KEY, CLIENT_EMAIL)
3. Na PRIVATE_KEY, mantenha os `\n` literais

### ❌ "Banco não enviou o link"
**Problema:** OAuth URL não é retornada

**Soluções:**
1. Verifique os logs do servidor (deve mostrar a resposta completa da Pluggy)
2. Confirme que `PLUGGY_SANDBOX=false` para produção
3. Alguns bancos podem não retornar URL imediatamente (implemente polling)
4. Verifique se o `oauthRedirectUri` está sendo enviado corretamente

## 📞 Precisa de Ajuda?

1. **Logs do Railway:** Railway Dashboard → Deployments → Logs
2. **Teste local:** `cd server && npm run test:config`
3. **Documentação:**
   - [GUIA_RAPIDO_RAILWAY.md](./GUIA_RAPIDO_RAILWAY.md)
   - [RAILWAY_SETUP.md](./RAILWAY_SETUP.md)
   - [PLUGGY_OAUTH_FIX.md](./PLUGGY_OAUTH_FIX.md)

## 🎉 Tudo Funcionando?

Se todos os itens estão marcados, parabéns! Seu backend está rodando corretamente no Railway e o OAuth do Pluggy deve funcionar perfeitamente.

**Próximos passos:**
- Teste com diferentes bancos
- Configure webhooks (se necessário)
- Monitore os logs para identificar problemas
- Configure alertas no Railway para downtime
