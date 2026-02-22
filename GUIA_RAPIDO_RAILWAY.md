# 🚀 Guia Rápido - Deploy no Railway

## ⚡ Solução Rápida (5 minutos)

### 1️⃣ Configure as Variáveis no Railway

Acesse: https://railway.app → Seu Projeto → Variables

Cole estas variáveis (substitua os valores):

```env
PLUGGY_CLIENT_ID=seu_client_id_da_pluggy
PLUGGY_CLIENT_SECRET=seu_client_secret_da_pluggy
PLUGGY_SANDBOX=false
PORT=3001
```

**Para o Firebase, escolha UMA opção:**

**Opção A - Mais Fácil (Base64):**
```env
FIREBASE_SERVICE_ACCOUNT=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6...
```

**Opção B - Variáveis Separadas:**
```env
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
```

### 2️⃣ Faça o Deploy

```bash
git add .
git commit -m "Configurar Railway"
git push origin main
```

### 3️⃣ Teste se Funcionou

Abra no navegador:
```
https://backendcontrolarapp-production.up.railway.app/health
```

Deve mostrar:
```json
{"status":"ok","timestamp":"2024-..."}
```

### 4️⃣ Configure o App

Crie o arquivo `.env.local` na raiz do projeto:

```env
EXPO_PUBLIC_API_URL=https://backendcontrolarapp-production.up.railway.app
```

## ✅ Pronto!

Agora teste conectar um banco no app. O OAuth deve funcionar corretamente.

## 🔍 Como Gerar o Base64 do Firebase

### Windows (PowerShell):
```powershell
$content = Get-Content serviceAccountKey.json -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))
```

### Linux/Mac:
```bash
base64 -w 0 serviceAccountKey.json
```

Copie o resultado e cole na variável `FIREBASE_SERVICE_ACCOUNT` no Railway.

## 🆘 Problemas?

### Erro: "Application failed to respond"
1. Vá no Railway Dashboard → Deployments → Logs
2. Procure por erros
3. Verifique se todas as variáveis estão definidas

### Erro: "Firebase not configured"
- Verifique se o base64 está correto
- Ou use as variáveis separadas (Opção B)

### Erro: "Pluggy API error"
- Confirme CLIENT_ID e CLIENT_SECRET no https://dashboard.pluggy.ai
- Verifique se `PLUGGY_SANDBOX=false` para produção

## 📚 Documentação Completa

- `RAILWAY_SETUP.md` - Guia detalhado do Railway
- `PLUGGY_OAUTH_FIX.md` - Detalhes sobre o problema OAuth
- `server/README.md` - Documentação do servidor

## 🧪 Testar Localmente Primeiro

```bash
# 1. Configure o .env no servidor
cd server
cp .env.example .env
# Edite o .env com suas credenciais

# 2. Instale e inicie
npm install
npm run test:config  # Verifica configuração
npm start            # Inicia o servidor

# 3. Teste
curl http://localhost:3001/health
```

Se funcionar localmente, funcionará no Railway com as mesmas variáveis!
