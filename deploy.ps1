# Script de deploy para Railway (Windows PowerShell)
# Uso: .\deploy.ps1 "mensagem do commit"

param(
    [string]$Message = "Deploy: Atualização do backend"
)

Write-Host "🚀 Preparando deploy para Railway..." -ForegroundColor Green

Write-Host "📝 Commit: $Message" -ForegroundColor Cyan

# Add, commit e push
git add .
git commit -m $Message
git push origin main

Write-Host "✅ Deploy enviado!" -ForegroundColor Green
Write-Host "📊 Acompanhe em: https://railway.app/dashboard" -ForegroundColor Yellow
Write-Host "🔍 Teste em: https://backendcontrolarapp-production.up.railway.app/health" -ForegroundColor Yellow
