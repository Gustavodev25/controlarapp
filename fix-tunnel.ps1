# Script para iniciar o tunnel alternativo (localtunnel)
# O ngrok v2 foi descontinuado, então usamos localtunnel como substituto
Write-Host "Limpando cache do Expo..." -ForegroundColor Cyan
Remove-Item -Path "$env:USERPROFILE\.expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.cache\expo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cache limpo!" -ForegroundColor Green
Write-Host "Iniciando dev com tunnel (localtunnel)..." -ForegroundColor Cyan

# Iniciar usando o novo script
npm run dev:tunnel
