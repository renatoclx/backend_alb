# Encerra a API (:3333) e o Frontend (:3000) iniciados por start-windows.ps1.
# O Postgres (Docker) continua de pé — os dados não somem entre reinícios;
# passe -StopDatabase se quiser derrubar o container também.
#
# Uso: powershell -ExecutionPolicy Bypass -File scripts\stop-windows.ps1 [-StopDatabase]

param(
    [switch]$StopDatabase
)

function Stop-Port($Port, $Label) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host "$Label (porta $Port): não está rodando."
        return
    }
    $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        Write-Host "$Label (porta $Port): encerrando processo $_"
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
}

Stop-Port 3000 "Frontend"
Stop-Port 3333 "API"

if ($StopDatabase) {
    $BackendPath = Split-Path -Parent $PSScriptRoot
    Set-Location $BackendPath
    Write-Host "Derrubando o Postgres..."
    docker compose down
}
