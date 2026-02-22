# 🛠️ Comandos Úteis

## 🧪 Testar Localmente

```bash
# Instalar dependências do servidor
cd server
npm install

# Testar configuração
npm run test:config

# Iniciar servidor
npm start

# Iniciar com hot-reload
npm run dev
```

## 🔍 Testar Endpoints

### Health Check
```bash
# Local
curl http://localhost:3001/health

# Produção
curl https://backendcontrolarapp-production.up.railway.app/health
```

### Diagnóstico
```bash
# Local
curl http://localhost:3001/api/diagnostics

# Produção
curl https://backendcontrolarapp-production.up.railway.app/api/diagnostics
```

### Listar Bancos (requer autenticação)
```bash
# Substitua SEU_TOKEN pelo token do Firebase
curl -H "Authorization: Bearer SEU_TOKEN" \
  http://localhost:3001/api/pluggy/connectors
```

## 🚀 Deploy

### Opção 1: Script Automático (Windows)
```powershell
.\deploy.ps1 "Mensagem do commit"
```

### Opção 2: Script Automático (Linux/Mac)
```bash
chmod +x deploy.sh
./deploy.sh "Mensagem do commit"
```

### Opção 3: Manual
```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

## 🔐 Gerar Base64 do Firebase

### Windows (PowerShell)
```powershell
$content = Get-Content serviceAccountKey.json -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
```

### Linux/Mac
```bash
base64 -w 0 serviceAccountKey.json
```

### Decodificar Base64 (para testar)
```powershell
# Windows
$base64 = "seu_base64_aqui"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64))
```

```bash
# Linux/Mac
echo "seu_base64_aqui" | base64 -d
```

## 📊 Monitorar Logs

### Railway
1. Acesse https://railway.app/dashboard
2. Clique no seu projeto
3. Vá em "Deployments"
4. Clique no deploy mais recente
5. Veja os logs em tempo real

### Local
```bash
cd server
npm start
# Os logs aparecerão no terminal
```

## 🧹 Limpar e Reinstalar

```bash
# Limpar node_modules
cd server
rm -rf node_modules
rm package-lock.json

# Reinstalar
npm install

# Ou no Windows PowerShell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

## 🔄 Atualizar Dependências

```bash
cd server

# Ver dependências desatualizadas
npm outdated

# Atualizar todas
npm update

# Atualizar uma específica
npm install axios@latest
```

## 🐛 Debug

### Verificar Variáveis de Ambiente
```bash
# Local (Linux/Mac)
cd server
cat .env

# Local (Windows)
cd server
type .env

# Railway
# Acesse Dashboard → Variables
```

### Testar Conexão com Pluggy
```bash
# Obter token de acesso
curl -X POST https://api.pluggy.ai/auth \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "seu_client_id",
    "clientSecret": "seu_client_secret"
  }'

# Listar conectores
curl https://api.pluggy.ai/connectors?sandbox=false \
  -H "X-API-KEY: seu_token_aqui"
```

### Testar Firebase
```bash
# No servidor, adicione este código temporário em index.js:
const admin = require('firebase-admin');
console.log('Firebase initialized:', admin.apps.length > 0);
```

## 📦 Comandos do Projeto Completo

```bash
# Instalar tudo (app + servidor)
npm install
npm run server:install

# Iniciar tudo junto
npm run dev

# Iniciar apenas o servidor
npm run server

# Iniciar apenas o app
npm start
```

## 🔧 Railway CLI (Opcional)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Ver logs em tempo real
railway logs

# Executar comandos no servidor
railway run npm run test:config

# Ver variáveis
railway variables
```

## 📱 Comandos do App

```bash
# Limpar cache do Expo
npx expo start -c

# Build para Android (desenvolvimento)
npm run build:dev:android

# Build APK
npm run build:dev:apk

# Executar no Android
npm run android

# Executar no iOS
npm run ios
```

## 🧪 Testar OAuth Completo

```bash
# 1. Obter token do Firebase (no app)
# 2. Criar item
curl -X POST http://localhost:3001/api/pluggy/create-item \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "seu_user_id",
    "connectorId": 201,
    "oauthRedirectUri": "controlarapp://oauth-callback"
  }'

# 3. Verificar status
curl -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3001/api/pluggy/items/ITEM_ID?userId=seu_user_id"

# 4. Sincronizar dados
curl -X POST http://localhost:3001/api/pluggy/sync \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "seu_user_id",
    "itemId": "ITEM_ID"
  }'
```

## 💡 Dicas

### Encontrar seu IP local
```bash
# Windows
ipconfig

# Linux/Mac
ifconfig
# ou
ip addr show
```

### Testar se porta está em uso
```bash
# Windows
netstat -ano | findstr :3001

# Linux/Mac
lsof -i :3001
```

### Matar processo na porta 3001
```bash
# Windows (PowerShell como Admin)
$process = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($process) { Stop-Process -Id $process.OwningProcess -Force }

# Linux/Mac
kill -9 $(lsof -t -i:3001)
```
