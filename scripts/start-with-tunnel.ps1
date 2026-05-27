param(
    [string]$TunnelUrl
)

if (-not $TunnelUrl) {
    Write-Host "Erro: Voce deve fornecer um URL de tunnel." -ForegroundColor Red
    Write-Host "Exemplo: .\start-with-tunnel.ps1 -TunnelUrl https://meu-tunnel.loca.lt"
    exit
}

$previousProxyUrl = $env:EXPO_PACKAGER_PROXY_URL
$previousKeepProxy = $env:CONTROLAR_KEEP_PACKAGER_PROXY
$exitCode = 0

try {
    $env:EXPO_PACKAGER_PROXY_URL = $TunnelUrl
    $env:CONTROLAR_KEEP_PACKAGER_PROXY = "1"
    Write-Host "Iniciando Expo com Proxy: $TunnelUrl" -ForegroundColor Cyan
    npx expo start --lan
    $exitCode = $LASTEXITCODE
}
finally {
    if ($null -eq $previousProxyUrl) {
        Remove-Item Env:EXPO_PACKAGER_PROXY_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:EXPO_PACKAGER_PROXY_URL = $previousProxyUrl
    }

    if ($null -eq $previousKeepProxy) {
        Remove-Item Env:CONTROLAR_KEEP_PACKAGER_PROXY -ErrorAction SilentlyContinue
    }
    else {
        $env:CONTROLAR_KEEP_PACKAGER_PROXY = $previousKeepProxy
    }
}

exit $exitCode
