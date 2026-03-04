# Script para corrigir o tunnel ngrok do Expo no Windows
Write-Host "Limpando cache do Expo..." -ForegroundColor Cyan
Remove-Item -Path "$env:USERPROFILE\.expo" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:USERPROFILE\.cache\expo" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Cache limpo!" -ForegroundColor Green
Write-Host "Iniciando Expo com tunnel ngrok..." -ForegroundColor Cyan

# Aumentar timeouts do sistema
$env:EXPO_TUNNELS_NETWORK_TIMEOUT = "120000"
$env:EXPO_TUNNEL_CONNECT_TIMEOUT = "120000"
$env:NGROK_TIMEOUT = "120000"
$env:EXPO_OFFLINE_MODE = "false"

# Iniciar o Expo
npx expo start --tunnel
