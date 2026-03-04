param(
    [string]$TunnelUrl
)

if (-not $TunnelUrl) {
    Write-Host "Erro: Voce deve fornecer um URL de tunnel." -ForegroundColor Red
    Write-Host "Exemplo: .\start-with-tunnel.ps1 -TunnelUrl https://meu-tunnel.loca.lt"
    exit
}

$env:EXPO_PACKAGER_PROXY_URL = $TunnelUrl
Write-Host "Iniciando Expo com Proxy: $TunnelUrl" -ForegroundColor Cyan
npx expo start --lan
