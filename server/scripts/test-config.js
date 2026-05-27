#!/usr/bin/env node
/**
 * Script de teste de configuração
 * Verifica se todas as variáveis de ambiente necessárias estão configuradas
 */

require('dotenv').config();

console.log('🔍 Verificando configuração do servidor...\n');

const checks = {
    pluggy: {
        clientId: !!process.env.PLUGGY_CLIENT_ID,
        clientSecret: !!process.env.PLUGGY_CLIENT_SECRET,
        sandbox: process.env.PLUGGY_SANDBOX
    },
    firebase: {
        serviceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        projectId: !!process.env.FIREBASE_PROJECT_ID,
        privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
    },
    server: {
        port: process.env.PORT || '3001'
    }
};

// Verificar Pluggy
console.log('📦 Pluggy Configuration:');
console.log(`  Client ID: ${checks.pluggy.clientId ? '✅' : '❌'}`);
console.log(`  Client Secret: ${checks.pluggy.clientSecret ? '✅' : '❌'}`);
console.log(`  Sandbox Mode: ${checks.pluggy.sandbox || 'não definido (padrão: false)'}`);

// Verificar Firebase
console.log('\n🔥 Firebase Configuration:');
const firebaseConfigured = checks.firebase.serviceAccount || 
    (checks.firebase.projectId && checks.firebase.privateKey && checks.firebase.clientEmail);

if (checks.firebase.serviceAccount) {
    console.log('  Service Account (Base64): ✅');
    
    // Tentar decodificar para verificar se é válido
    try {
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('ascii');
        const parsed = JSON.parse(decoded);
        console.log(`  ├─ Project ID: ${parsed.project_id || 'não encontrado'}`);
        console.log(`  ├─ Client Email: ${parsed.client_email || 'não encontrado'}`);
        console.log(`  └─ Private Key: ${parsed.private_key ? '✅' : '❌'}`);
    } catch (e) {
        console.log('  └─ ⚠️  Erro ao decodificar: ' + e.message);
    }
} else if (checks.firebase.projectId && checks.firebase.privateKey && checks.firebase.clientEmail) {
    console.log('  Individual Variables:');
    console.log(`  ├─ Project ID: ✅`);
    console.log(`  ├─ Private Key: ✅`);
    console.log(`  └─ Client Email: ✅`);
} else {
    console.log('  ❌ Firebase não configurado');
    console.log('  Configure FIREBASE_SERVICE_ACCOUNT ou as variáveis individuais');
}

// Verificar Server
console.log('\n🖥️  Server Configuration:');
console.log(`  Port: ${checks.server.port}`);

// Resumo
console.log('\n' + '='.repeat(50));
const allPluggyOk = checks.pluggy.clientId && checks.pluggy.clientSecret;
const allFirebaseOk = firebaseConfigured;

if (allPluggyOk && allFirebaseOk) {
    console.log('✅ Todas as configurações estão OK!');
    console.log('Você pode iniciar o servidor com: npm start');
    process.exit(0);
} else {
    console.log('❌ Algumas configurações estão faltando:');
    if (!allPluggyOk) {
        console.log('  - Configure PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET');
    }
    if (!allFirebaseOk) {
        console.log('  - Configure as variáveis do Firebase');
    }
    console.log('\nConsulte o arquivo RAILWAY_SETUP.md para mais informações.');
    process.exit(1);
}
