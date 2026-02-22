# 🎨 Instruções Visuais - Passo a Passo

## 📍 Onde Estou?

```
Seu Projeto
├── 📁 backendcontrolarapp/          ← Você está aqui!
│   ├── 📁 server/                   ← Backend (Node.js + Express)
│   │   ├── 📁 api/
│   │   │   └── pluggy.js           ← Rotas do Pluggy
│   │   ├── index.js                ← Servidor principal
│   │   ├── package.json
│   │   └── .env                    ← Configure suas credenciais aqui
│   │
│   ├── 📄 railway.json             ← ✨ NOVO - Config do Railway
│   ├── 📄 Procfile                 ← ✨ NOVO - Comando de start
│   ├── 📄 GUIA_RAPIDO_RAILWAY.md   ← ✨ NOVO - Comece aqui!
│   └── 📄 package.json             ← App React Native
│
└── 🌐 Railway                       ← Onde vai rodar em produção
```

## 🎯 Fluxo da Solução

```
┌─────────────────────────────────────────────────────────────┐
│  1️⃣  CONFIGURAR RAILWAY                                      │
│                                                              │
│  Railway Dashboard → Variables                              │
│  ├─ PLUGGY_CLIENT_ID                                        │
│  ├─ PLUGGY_CLIENT_SECRET                                    │
│  ├─ PLUGGY_SANDBOX=false                                    │
│  ├─ PORT=3001                                               │
│  └─ FIREBASE_SERVICE_ACCOUNT                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  2️⃣  FAZER DEPLOY                                            │
│                                                              │
│  Terminal:                                                  │
│  $ git add .                                                │
│  $ git commit -m "Configurar Railway"                       │
│  $ git push origin main                                     │
│                                                              │
│  Railway detecta mudanças e faz deploy automaticamente      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  3️⃣  TESTAR                                                  │
│                                                              │
│  Navegador:                                                 │
│  https://backendcontrolarapp-production.up.railway.app/health│
│                                                              │
│  Deve mostrar:                                              │
│  {"status":"ok","timestamp":"..."}                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  4️⃣  CONFIGURAR APP                                          │
│                                                              │
│  Criar arquivo: .env.local                                  │
│  EXPO_PUBLIC_API_URL=https://backendcontrolarapp-production.up.railway.app│
│                                                              │
│  Reiniciar app: Ctrl+C → npm start                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  ✅  PRONTO! OAuth funcionando                               │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Fluxo do OAuth (Como Funciona)

```
┌──────────┐                                    ┌──────────┐
│   APP    │                                    │  BACKEND │
│ (Mobile) │                                    │ (Railway)│
└────┬─────┘                                    └────┬─────┘
     │                                               │
     │  1. Usuário clica "Conectar Banco"           │
     │ ──────────────────────────────────────────>  │
     │                                               │
     │                                               │  2. Backend chama
     │                                               │     Pluggy API
     │                                               │ ─────────────────>
     │                                               │                   ┌──────────┐
     │                                               │  3. Pluggy retorna│  PLUGGY  │
     │                                               │     OAuth URL     │   API    │
     │                                               │ <─────────────────└──────────┘
     │  4. Backend retorna URL para app             │
     │ <──────────────────────────────────────────  │
     │                                               │
     │  5. App abre navegador                       │
     │     com OAuth URL                            │
     │ ──────────────────────────>                  │
     │                            ┌──────────────┐  │
     │  6. Usuário faz login      │  NAVEGADOR   │  │
     │     no banco               │  (OAuth)     │  │
     │                            └──────┬───────┘  │
     │                                   │          │
     │  7. Banco redireciona             │          │
     │     para o app                    │          │
     │ <─────────────────────────────────┘          │
     │                                               │
     │  8. App sincroniza dados                     │
     │ ──────────────────────────────────────────>  │
     │                                               │
     │  9. Backend busca contas/transações          │
     │ <──────────────────────────────────────────  │
     │                                               │
     │  ✅ Dados exibidos no app                     │
     │                                               │
```

## 🎨 Interface do Railway

```
┌─────────────────────────────────────────────────────────────┐
│  Railway Dashboard                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📦 backendcontrolarapp-production                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Deployments │  │   Variables  │  │   Settings   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  Variables:                                                 │
│  ┌────────────────────────────────────────────────────┐    │
│  │ PLUGGY_CLIENT_ID          = abc123...              │    │
│  │ PLUGGY_CLIENT_SECRET      = xyz789...              │    │
│  │ PLUGGY_SANDBOX            = false                  │    │
│  │ PORT                      = 3001                   │    │
│  │ FIREBASE_SERVICE_ACCOUNT  = eyJ0eXBlIjo...         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  [+ Add Variable]                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Status Esperado

### ❌ ANTES (Não Funciona)

```
┌─────────────────────────────────────────┐
│  https://backendcontrolarapp-           │
│  production.up.railway.app              │
├─────────────────────────────────────────┤
│                                          │
│  ❌ Application failed to respond        │
│                                          │
│  This error appears to be caused        │
│  by the application.                    │
│                                          │
└─────────────────────────────────────────┘
```

### ✅ DEPOIS (Funcionando)

```
┌─────────────────────────────────────────┐
│  https://backendcontrolarapp-           │
│  production.up.railway.app/health       │
├─────────────────────────────────────────┤
│                                          │
│  {                                       │
│    "status": "ok",                       │
│    "timestamp": "2024-02-22T..."        │
│  }                                       │
│                                          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  /api/diagnostics                       │
├─────────────────────────────────────────┤
│                                          │
│  {                                       │
│    "status": "running",                  │
│    "config": {                           │
│      "pluggyClientId": ✅ true,          │
│      "pluggyClientSecret": ✅ true,      │
│      "firebaseConfigured": ✅ true       │
│    }                                     │
│  }                                       │
│                                          │
└─────────────────────────────────────────┘
```

## 🎯 Checklist Visual

```
┌─────────────────────────────────────────┐
│  ANTES DO DEPLOY                        │
├─────────────────────────────────────────┤
│  [ ] Tenho CLIENT_ID da Pluggy          │
│  [ ] Tenho CLIENT_SECRET da Pluggy      │
│  [ ] Tenho serviceAccountKey.json       │
│  [ ] Gerei o Base64 do Firebase         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  CONFIGURAR RAILWAY                     │
├─────────────────────────────────────────┤
│  [ ] Adicionei PLUGGY_CLIENT_ID         │
│  [ ] Adicionei PLUGGY_CLIENT_SECRET     │
│  [ ] Adicionei PLUGGY_SANDBOX           │
│  [ ] Adicionei PORT                     │
│  [ ] Adicionei FIREBASE_SERVICE_ACCOUNT │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  FAZER DEPLOY                           │
├─────────────────────────────────────────┤
│  [ ] git add .                          │
│  [ ] git commit -m "..."                │
│  [ ] git push origin main               │
│  [ ] Aguardei deploy no Railway         │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  TESTAR                                 │
├─────────────────────────────────────────┤
│  [ ] /health retorna OK                 │
│  [ ] /api/diagnostics mostra ✅         │
│  [ ] Logs mostram "ONLINE"              │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  CONFIGURAR APP                         │
├─────────────────────────────────────────┤
│  [ ] Criei .env.local                   │
│  [ ] Adicionei EXPO_PUBLIC_API_URL      │
│  [ ] Reiniciei o app                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  ✅ FUNCIONANDO!                         │
└─────────────────────────────────────────┘
```

## 🆘 Troubleshooting Visual

```
┌─────────────────────────────────────────────────────────────┐
│  PROBLEMA: Health check não responde                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Verifique os logs:                                      │
│     Railway → Deployments → Logs                            │
│                                                              │
│  2. Procure por erros:                                      │
│     ❌ "Cannot find module"                                  │
│     ❌ "EADDRINUSE"                                          │
│     ❌ "Firebase not configured"                            │
│                                                              │
│  3. Verifique arquivos:                                     │
│     ✅ railway.json existe na raiz                           │
│     ✅ Procfile existe na raiz                               │
│     ✅ server/package.json tem "start" script               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PROBLEMA: Diagnostics mostra false                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  {                                                           │
│    "config": {                                               │
│      "pluggyClientId": ❌ false  ← Variável não definida     │
│    }                                                         │
│  }                                                           │
│                                                              │
│  SOLUÇÃO:                                                    │
│  1. Railway → Variables                                     │
│  2. Adicione a variável faltante                            │
│  3. Aguarde redeploy automático                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PROBLEMA: "Banco não enviou o link"                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Verifique logs do servidor:                             │
│     Deve mostrar: "✅ Link OAuth encontrado"                 │
│                                                              │
│  2. Se mostrar "⚠️ Nenhum link OAuth":                       │
│     - Verifique PLUGGY_SANDBOX=false                        │
│     - Alguns bancos precisam de polling                     │
│     - Veja resposta completa nos logs                       │
│                                                              │
│  3. Teste com outro banco primeiro                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Documentação Rápida

```
┌──────────────────────────────────────────────────────────┐
│  📄 GUIA_RAPIDO_RAILWAY.md                               │
│  ↳ Solução em 5 minutos - COMECE AQUI!                  │
├──────────────────────────────────────────────────────────┤
│  📄 RAILWAY_SETUP.md                                     │
│  ↳ Guia detalhado de configuração                       │
├──────────────────────────────────────────────────────────┤
│  📄 PLUGGY_OAUTH_FIX.md                                  │
│  ↳ Detalhes técnicos do OAuth                           │
├──────────────────────────────────────────────────────────┤
│  📄 CHECKLIST_DEPLOY.md                                  │
│  ↳ Checklist completo passo a passo                     │
├──────────────────────────────────────────────────────────┤
│  📄 COMANDOS_UTEIS.md                                    │
│  ↳ Comandos para debug e deploy                         │
├──────────────────────────────────────────────────────────┤
│  📄 RESUMO_SOLUCAO.md                                    │
│  ↳ Resumo executivo da solução                          │
├──────────────────────────────────────────────────────────┤
│  📄 INSTRUCOES_VISUAIS.md                                │
│  ↳ Este arquivo - Guia visual                           │
└──────────────────────────────────────────────────────────┘
```

---

**💡 Dica:** Comece pelo `GUIA_RAPIDO_RAILWAY.md` e siga os passos. Em 5 minutos seu backend estará funcionando!
