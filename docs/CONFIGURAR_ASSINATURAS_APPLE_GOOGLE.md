# Configurar assinaturas nativas com 7 dias gratis

O app usa compra nativa nas duas lojas:

- iOS: App Store In-App Purchase.
- Android: Google Play Billing.

Google Pay e Apple Pay sao carteiras digitais. Para assinatura de recursos digitais dentro
do app, os produtos corretos sao Google Play Billing e App Store In-App Purchase.

## Identificadores usados no codigo

Nao altere estes IDs nos paineis:

| Loja | Campo | Valor |
| --- | --- | --- |
| Apple | Bundle ID | `com.gustavodev25.controlarapp` |
| Apple | Product ID | `com.gustavodev25.controlarapp.pro.monthly` |
| Google | Package name | `com.gustavodev25.controlarapp` |
| Google | Subscription product ID | `controlarapp_pro_monthly` |
| Google | Base plan ID | `pro-monthly` |
| Google | Offer ID | `trial-7d` |

O preco exibido como fallback no app e `R$ 34,90` por mes. Cadastre o mesmo preco nas lojas.

## Apple App Store Connect

1. Entre no App Store Connect e abra o app Controlar+.
2. Acesse `Monetization > Subscriptions`.
3. Crie um grupo de assinaturas, por exemplo `Controlar+ Pro`.
4. Crie uma assinatura auto-renovavel com o Product ID
   `com.gustavodev25.controlarapp.pro.monthly`.
5. Escolha duracao mensal e configure o preco de `R$ 34,90`.
6. Na assinatura, crie uma oferta introdutoria:
   - tipo: `Free Trial`;
   - duracao: `1 Week`;
   - elegibilidade: novos assinantes do grupo.
7. Preencha os textos e a captura de tela exigidos para revisao.
8. Crie um usuario Sandbox em `Users and Access > Sandbox` para testar.

### Variaveis Apple no backend

Configure estas variaveis no Railway:

```env
APPLE_SHARED_SECRET=
APPLE_BUNDLE_ID=com.gustavodev25.controlarapp
APPLE_IAP_KEY_ID=
APPLE_IAP_ISSUER_ID=
APPLE_IAP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_SERVER_API_ENVIRONMENT=production
```

O `APPLE_SHARED_SECRET` fica nas configuracoes de assinatura do App Store Connect.
Para a App Store Server API, gere uma chave em `Users and Access > Integrations`.

### App Store Server Notifications

No App Store Connect, configure a URL de notificacoes da assinatura para:

```text
https://SEU_BACKEND/api/apple/notifications
```

Use a URL de producao em Production e, se estiver testando Sandbox com outro
backend, configure a URL Sandbox tambem. O endpoint recebe `signedPayload` da
Apple, valida o JWS e atualiza o Firestore para renovacoes, expiracoes,
cancelamentos e refunds.

## Firebase Admin no backend

As rotas de IAP usam Firebase Admin para validar o ID token do usuario e gravar o
status da assinatura no Firestore. Configure uma destas opcoes no Railway antes de
testar Apple ou Google:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", "...":"..."}
```

ou:

```env
FIREBASE_PROJECT_ID=seu_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@seu-projeto.iam.gserviceaccount.com
```

`FIREBASE_SERVICE_ACCOUNT` aceita JSON completo ou JSON convertido para base64. Essa
credencial e diferente de `GOOGLE_PLAY_SERVICE_ACCOUNT`: a primeira acessa Firebase
Auth/Firestore; a segunda acessa a Android Publisher API.

Nao reutilize a credencial `firebase-adminsdk-...` em `GOOGLE_PLAY_SERVICE_ACCOUNT`.
No Railway, mantenha duas variaveis separadas: `FIREBASE_SERVICE_ACCOUNT` para Firebase
Admin e `GOOGLE_PLAY_SERVICE_ACCOUNT` para a conta adicionada em `Users and permissions`
do Play Console.

## Google Play Console

1. Entre no Google Play Console e abra o app Controlar+.
2. Confirme que o app usa o package name `com.gustavodev25.controlarapp`.
3. Acesse `Monetize with Play > Products > Subscriptions`.
4. Crie uma assinatura com o ID `controlarapp_pro_monthly`.
5. Crie um plano basico:
   - ID: `pro-monthly`;
   - tipo: auto-renovavel;
   - periodo de cobranca: mensal;
   - preco no Brasil: `R$ 34,90`.
6. Dentro do plano, crie uma oferta:
   - ID: `trial-7d`;
   - elegibilidade: novos clientes;
   - fase: teste gratis por `7 dias`.
7. Ative a assinatura, o plano basico e a oferta.

### Conta de servico Google

1. No Google Cloud do projeto, ative a `Google Play Android Developer API`.
2. Crie uma conta de servico e baixe a chave JSON.
3. No Play Console, adicione essa conta em `Users and permissions`.
4. Libere acesso ao app Controlar+ e permissao para gerenciar pedidos e assinaturas.
5. Configure no Railway:

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account", "...":"..."}
GOOGLE_PLAY_SERVICE_ACCOUNT={"type":"service_account", "...":"..."}
GOOGLE_PLAY_PACKAGE_NAME=com.gustavodev25.controlarapp
GOOGLE_PLAY_PRO_PRODUCT_ID=controlarapp_pro_monthly
GOOGLE_PLAY_TRIAL_OFFER_ID=trial-7d
GOOGLE_PLAY_RTDN_TOKEN=gere_um_token_secreto_longo
```

`GOOGLE_PLAY_SERVICE_ACCOUNT` aceita JSON completo ou JSON convertido para base64.
Ela nao deve ter o mesmo `client_email` usado em `FIREBASE_SERVICE_ACCOUNT`.

Antes de retestar no app, valide o ambiente do backend:

```bash
cd server
npm run test:config
```

O script deve mostrar `Trial Offer ID: trial-7d`, duas credenciais com `client_email`
diferentes, e nao pode apontar a credencial Google Play como `firebase-adminsdk-...`.

### Notificacoes Google em tempo real

As notificacoes mantem cancelamentos, renovacoes e falhas sincronizados mesmo quando o usuario
nao abre o app.

1. Crie um topico no Google Cloud Pub/Sub.
2. Conceda permissao de publicacao no topico para
   `google-play-developer-notifications@system.gserviceaccount.com`.
3. No Play Console, abra as configuracoes de monetizacao e informe o topico Pub/Sub.
4. Crie uma assinatura Pub/Sub do tipo push apontando para:

```text
https://SEU_BACKEND/api/google/rtdn?token=O_MESMO_GOOGLE_PLAY_RTDN_TOKEN
```

5. Envie uma notificacao de teste pelo Play Console e confirme resposta HTTP `204`.

## Publicar as regras e gerar builds

As regras do Firestore foram atualizadas para impedir que o celular altere o proprio plano.
Publique as regras:

```bash
firebase deploy --only firestore:rules
```

Depois de configurar as lojas e as variaveis do Railway, gere novos builds nativos:

```bash
npm run deploy:ios
npm run deploy:android
```

No Android, instale o app pela faixa de teste interno da Play Store. A cobranca nao deve ser
testada por APK instalado manualmente. Adicione os e-mails de teste na lista de testadores.

No iOS, teste com usuario Sandbox ou TestFlight. Compras nativas nao funcionam no Expo Go.

## Checklist de validacao

- Novo usuario consegue criar conta dentro do Android e do iOS.
- A tela mostra `Comecar 7 dias gratis`.
- A loja exibe teste gratis e o preco mensal antes da confirmacao.
- Depois da confirmacao, o app libera o Pro.
- Restaurar compras encontra uma assinatura existente.
- Gerenciar assinatura abre a loja correta.
- Cancelar mantem acesso ate o fim do periodo e bloqueia depois do vencimento.
- Uma falha de cobranca remove o acesso quando a loja coloca a assinatura em espera.

## Documentacao oficial

- Apple: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions
- Apple: https://developer.apple.com/help/app-store-connect/manage-subscriptions/offer-auto-renewable-subscriptions
- Google: https://support.google.com/googleplay/android-developer/answer/140504
- Google: https://developer.android.com/google/play/billing/integrate
- Google: https://developer.android.com/google/play/billing/rtdn-reference
- Google API: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2/get
