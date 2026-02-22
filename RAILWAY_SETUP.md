# 🚂 Guia de Deploy no Railway - ControlarApp Backend

## ⚠️ Problema Atual
O erro "Application failed to respond" ocorre porque:
1. O Railway não sabe que precisa executar o servidor da pasta `server/`
2. As variáveis de ambiente não estão configuradas
3. O Firebase Admin SDK não está inicializado

## 🔧 Solução Completa

### Passo 1: Configurar Variáveis de Ambiente no Railway

Acesse o painel do Railway e adicione as seguintes variáveis:

#### Variáveis Obrigatórias do Pluggy:
```env
PLUGGY_CLIENT_ID=seu_client_id_aqui
PLUGGY_CLIENT_SECRET=seu_client_secret_aqui
PLUGGY_SANDBOX=false
PORT=3001
```

#### Variáveis do Firebase (escolha UMA das opções):

**Opção A - Variável única (RECOMENDADO):**
```env
FIREBASE_SERVICE_ACCOUNT=<base64_do_json>
```

Para gerar o base64 do seu arquivo JSON do Firebase:
```bash
# Windows PowerShell
$content = Get-Content serviceAccountKey.json -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))

# Linux/Mac
base64 -w 0 serviceAccountKey.json
```

**Opção B - Variáveis separadas:**
```env
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...sua_chave_aqui...\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-project.iam.gserviceaccount.com
```

⚠️ **IMPORTANTE**: Na `FIREBASE_PRIVATE_KEY`, mantenha os `\n` literais (não quebre em linhas).

### Passo 2: Verificar Arquivos de Configuração

Os seguintes arquivos já foram criados na raiz do projeto:

1. **railway.json** - Configuração do Railway
2. **Procfile** - Comando de inicialização

### Passo 3: Fazer Deploy

1. Commit e push das alterações:
```bash
git add .
git commit -m "Configurar Railway para executar servidor corretamente"
git push origin main
```

2. O Railway detectará automaticamente as mudanças e fará o redeploy

### Passo 4: Verificar se Funcionou

Após o deploy, teste os endpoints:

```bash
# Health check
curl https://backendcontrolarapp-production.up.railway.app/health

# Deve retornar:
# {"status":"ok","timestamp":"2024-XX-XXTXX:XX:XX.XXXZ"}
```

## 🔍 Troubleshooting

### Erro: "Firebase Admin not configured"
- Verifique se as variáveis do Firebase estão corretas
- Teste o base64 decodificando localmente para verificar se é um JSON válido

### Erro: "Pluggy API error"
- Verifique se `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET` estão corretos
- Confirme se `PLUGGY_SANDBOX=false` para produção

### Erro: "Application failed to respond"
- Verifique os logs no Railway Dashboard
- Confirme que a variável `PORT` está definida (Railway usa porta dinâmica)
- Verifique se o `railway.json` e `Procfile` estão na raiz do repositório

### Como ver os logs no Railway:
1. Acesse o dashboard do Railway
2. Clique no seu projeto
3. Vá em "Deployments"
4. Clique no deploy mais recente
5. Veja os logs em tempo real

## 📱 Configurar o App para usar o Railway

No seu app React Native, atualize a URL da API:

1. Crie/edite o arquivo `.env.local` na raiz do projeto:
```env
EXPO_PUBLIC_API_URL=https://backendcontrolarapp-production.up.railway.app
```

2. Ou configure diretamente no código em `services/apiBaseUrl.ts`:
```typescript
const DEFAULT_PRODUCTION_URL = 'https://backendcontrolarapp-production.up.railway.app';
```

## ✅ Checklist Final

- [ ] Variáveis do Pluggy configuradas no Railway
- [ ] Variáveis do Firebase configuradas no Railway
- [ ] Arquivos `railway.json` e `Procfile` commitados
- [ ] Deploy realizado com sucesso
- [ ] Endpoint `/health` respondendo
- [ ] App configurado com a URL do Railway
- [ ] Teste de conexão com banco funcionando

## 🆘 Precisa de Ajuda?

Se ainda estiver com problemas:
1. Verifique os logs no Railway Dashboard
2. Teste localmente: `cd server && npm start`
3. Verifique se todas as variáveis de ambiente estão definidas
4. Confirme que o Firebase Service Account tem as permissões corretas
