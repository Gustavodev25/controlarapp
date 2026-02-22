# Configuração do Pluggy com Backend Railway

## Mudanças Realizadas

### 1. URL de Redirecionamento OAuth

A URL de redirecionamento do Pluggy foi configurada para usar o backend no Railway:

```
https://backendcontrolarapp-production.up.railway.app/api/pluggy/oauth-callback
```

### 2. Novo Endpoint no Backend

Foi adicionado um endpoint `/api/pluggy/oauth-callback` no servidor que:
- Recebe o callback do Pluggy após autenticação OAuth
- Extrai os parâmetros (itemId, status, error)
- Redireciona de volta para o app usando deep link: `controlarapp://open-finance/callback`

### 3. Fluxo de Autenticação

1. **App → Backend**: O app envia a requisição de conexão com `oauthRedirectUri` apontando para o Railway
2. **Backend → Pluggy**: O backend cria o item no Pluggy com a URL de callback
3. **Pluggy → Usuário**: O Pluggy redireciona o usuário para autenticação no banco
4. **Banco → Pluggy → Backend**: Após autenticação, o Pluggy chama o endpoint do Railway
5. **Backend → App**: O backend redireciona via deep link de volta para o app
6. **App**: O listener de deep link processa o callback e continua o fluxo

## Configuração no Dashboard do Pluggy

No dashboard do Pluggy (https://dashboard.pluggy.ai), você precisa adicionar a URL de callback nas configurações:

1. Acesse "Settings" → "Webhooks & Callbacks"
2. Adicione a URL: `https://backendcontrolarapp-production.up.railway.app/api/pluggy/oauth-callback`
3. Salve as configurações

## Variáveis de Ambiente

Certifique-se de que as seguintes variáveis estão configuradas no Railway:

```env
PLUGGY_CLIENT_ID=seu_client_id_aqui
PLUGGY_CLIENT_SECRET=seu_client_secret_aqui
PLUGGY_SANDBOX=false
PORT=3001
```

## Deep Link Configuration

O app já está configurado com o esquema `controlarapp://` no arquivo `app.json`:

```json
{
  "expo": {
    "scheme": "controlarapp"
  }
}
```

## Testando

1. Certifique-se de que o backend está rodando no Railway
2. No app, tente conectar uma conta bancária
3. Após a autenticação no banco, você deve ser redirecionado de volta para o app
4. Verifique os logs do console para acompanhar o fluxo

## Troubleshooting

Se o redirecionamento não funcionar:

1. Verifique se a URL está correta no dashboard do Pluggy
2. Confirme que o backend está acessível em `https://backendcontrolarapp-production.up.railway.app`
3. Verifique os logs do Railway para ver se o callback está sendo recebido
4. Teste o deep link manualmente: `controlarapp://open-finance/callback?itemId=test`
