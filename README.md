# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## 🚨 PROBLEMA COM RAILWAY + PLUGGY OAUTH?

### ⚡ Solução Rápida

**Leia:** [COMECE_AQUI.md](./COMECE_AQUI.md) - Solução completa em 5 minutos!

**Problema resolvido:**
- ✅ Backend no Railway não responde
- ✅ Erro "banco não enviou o link"
- ✅ OAuth do Pluggy não funciona

### 📚 Documentação Completa

| Arquivo | Descrição |
|---------|-----------|
| **[COMECE_AQUI.md](./COMECE_AQUI.md)** | 🎯 Ponto de entrada - Comece aqui! |
| [GUIA_RAPIDO_RAILWAY.md](./GUIA_RAPIDO_RAILWAY.md) | ⚡ Solução em 5 minutos |
| [INSTRUCOES_VISUAIS.md](./INSTRUCOES_VISUAIS.md) | 🎨 Guia visual passo a passo |
| [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) | 📖 Configuração detalhada |
| [PLUGGY_OAUTH_FIX.md](./PLUGGY_OAUTH_FIX.md) | 🔧 Detalhes técnicos do OAuth |
| [CHECKLIST_DEPLOY.md](./CHECKLIST_DEPLOY.md) | ✅ Checklist completo |
| [COMANDOS_UTEIS.md](./COMANDOS_UTEIS.md) | 🛠️ Comandos de debug |
| [RESUMO_SOLUCAO.md](./RESUMO_SOLUCAO.md) | 📋 Resumo executivo |

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Performance Tooling

- `npm run perf:collect`: collect Android raw metrics via ADB (CPU, meminfo, gfxinfo, batterystats).
- `npm run perf:scenario`: run guided benchmark scenarios.
- `npm run perf:parse-framestats -- <file>`: parse `gfxinfo ... framestats` output.
- `npm run perf:summarize -- <csv>`: summarize in-app runtime monitor CSV exports.
- `npm run perf:check-assets`: enforce asset size budgets and future 3D LOD budgets.

Detailed docs are in `docs/performance/`.
