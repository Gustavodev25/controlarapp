#!/bin/bash

# Script de deploy para Railway
# Uso: ./deploy.sh "mensagem do commit"

echo "🚀 Preparando deploy para Railway..."

# Verifica se há mensagem de commit
if [ -z "$1" ]; then
    MESSAGE="Deploy: Atualização do backend"
else
    MESSAGE="$1"
fi

echo "📝 Commit: $MESSAGE"

# Add, commit e push
git add .
git commit -m "$MESSAGE"
git push origin main

echo "✅ Deploy enviado!"
echo "📊 Acompanhe em: https://railway.app/dashboard"
echo "🔍 Teste em: https://backendcontrolarapp-production.up.railway.app/health"
