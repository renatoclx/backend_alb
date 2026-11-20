# Sobe o LocObra inteiro (Postgres + API + Frontend) de forma silenciosa —
# pensado pra ser o alvo de um atalho na pasta Inicializar do Windows, pra
# o cliente nunca precisar rodar nada manualmente.
#
# É idempotente e "auto-suficiente": na primeira vez que rodar (clone
# recém-feito), instala dependências e compila os dois projetos; nas vezes
# seguintes, só garante que Postgres/API/Frontend estejam de pé (rápido).
#
# Layout esperado: esta pasta (backend) e a do frontend são pastas irmãs.
# Se não forem, ajuste $FrontendPath abaixo.
#
# Uso manual (pra testar): powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1
# Alvo do atalho de inicialização automática (ver docs/execucao-local-windows.md):
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\caminho\backend_alb\scripts\start-windows.ps1"

$ErrorActionPreference = "Stop"

$BackendPath = Split-Path -Parent $PSScriptRoot
$ParentPath  = Split-Path -Parent $BackendPath

# Aceita tanto "frontend_alb" (nome do clone do GitHub) quanto "frontend"
# (nome usado no ambiente de desenvolvimento) como pasta irmã.
$FrontendPath = Join-Path $ParentPath "frontend_alb"
if (-not (Test-Path $FrontendPath)) {
    $FrontendPath = Join-Path $ParentPath "frontend"
}

$LogDir = Join-Path $BackendPath "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"

function Write-Log($Message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "HH:mm:ss"), $Message
    Write-Host $line
    Add-Content -Path (Join-Path $LogDir "start_$Stamp.log") -Value $line
}

function Test-CommandExists($Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

# Mostra uma caixa de mensagem visível e encerra. Como o script roda
# escondido (via start-windows-hidden.vbs), sem isso uma falha não deixa
# nenhum rastro visível pro cliente — ele não tem como saber que algo deu
# errado nem o que te contar. Só é chamada em erro de verdade; no caminho
# de sucesso o script continua 100% silencioso.
function Exit-WithError($Message) {
    Write-Log $Message
    try {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            "$Message`n`nLogs em: $LogDir",
            "LocObra - erro ao iniciar",
            [System.Windows.MessageBoxButton]::OK,
            [System.Windows.MessageBoxImage]::Error
        ) | Out-Null
    } catch {}
    exit 1
}

# Balão de notificação no canto da tela (ícone na bandeja + mensagem que
# some sozinha) — avisa o cliente que o sistema está de pé sem abrir
# nenhuma janela. $script:NotifyIcon fica vivo até Close-Notification
# rodar, senão o balão pode nem chegar a aparecer.
function Show-Notification($Text) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        if (-not $script:NotifyIcon) {
            $script:NotifyIcon = New-Object System.Windows.Forms.NotifyIcon
            $script:NotifyIcon.Icon = [System.Drawing.SystemIcons]::Information
            $script:NotifyIcon.Visible = $true
        }
        $script:NotifyIcon.BalloonTipTitle = "LocObra"
        $script:NotifyIcon.BalloonTipText = $Text
        $script:NotifyIcon.ShowBalloonTip(8000)
    } catch {}
}

function Close-Notification {
    if ($script:NotifyIcon) {
        Start-Sleep -Seconds 3
        $script:NotifyIcon.Dispose()
    }
}

# Espera uma URL responder (qualquer status HTTP conta como "no ar" — só
# timeout de conexão significa "ainda não subiu").
function Wait-Http($Url, $TimeoutSec) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
            return $true
        } catch {
            if ($_.Exception.Response) { return $true }
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

# Roda um comando externo (npm, docker, npx) sem deixar o script morrer por
# causa de saída em stderr que não é erro de verdade (ex.: progresso do
# "docker compose" ou avisos do npm) — só falha quando o código de saída é
# diferente de 0.
function Invoke-Step($Description, $LogFile, [scriptblock]$Action) {
    Write-Log $Description
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $Action *>> $LogFile
    } finally {
        $ErrorActionPreference = $prevPref
    }
    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "ERRO: falha em '$Description' (codigo $LASTEXITCODE). Veja $LogFile"
    }
}

# ---- 0) pré-requisitos --------------------------------------------------

$IsFirstRun = -not (Test-Path (Join-Path $BackendPath "node_modules")) -or `
              -not (Test-Path (Join-Path $FrontendPath "node_modules"))
if ($IsFirstRun) {
    Show-Notification "Iniciando o sistema pela primeira vez... isso pode levar alguns minutos."
} else {
    Show-Notification "Iniciando o sistema..."
}

if (-not (Test-CommandExists "node")) {
    Exit-WithError "ERRO: Node.js não encontrado no PATH. Instale o Node.js LTS e tente de novo."
}
if (-not (Test-CommandExists "docker")) {
    Exit-WithError "ERRO: Docker não encontrado no PATH. Instale o Docker Desktop e tente de novo."
}
if (-not (Test-Path $FrontendPath)) {
    Exit-WithError "ERRO: pasta do frontend não encontrada (procurei em $FrontendPath). Ajuste `$FrontendPath no script."
}

# ---- 1) Docker Desktop ---------------------------------------------------

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Log "Docker Desktop não está de pé — iniciando..."
    $DockerExe = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $DockerExe) {
        Start-Process $DockerExe
    }
    # Num boot recém-ligado da máquina (não só relogin), o Docker Desktop
    # precisa subir a VM do WSL2 inteira — isso pode passar bem de 90s,
    # principalmente com antivírus/atualizações concorrendo no boot.
    $deadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $deadline) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 3
    }
    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "ERRO: Docker Desktop não respondeu a tempo."
    }
}
Write-Log "Docker OK."

# ---- 2) Backend: env, Postgres, migrations, seeds, build ----------------

Set-Location $BackendPath

if (-not (Test-Path ".env")) {
    Write-Log "Criando .env a partir de .env.example"
    Copy-Item ".env.example" ".env"
}

if (-not (Test-Path "node_modules")) {
    Invoke-Step "Instalando dependências do backend (primeira vez, pode demorar)..." (Join-Path $LogDir "backend_$Stamp.log") { npm install }
}

Invoke-Step "Subindo o Postgres..." (Join-Path $LogDir "docker_$Stamp.log") { docker compose up -d }

$deadline = (Get-Date).AddSeconds(60)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $status = docker inspect -f "{{.State.Health.Status}}" alb_locacoes_postgres 2>$null
    if ($status -eq "healthy") { $healthy = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    Exit-WithError "ERRO: Postgres não ficou saudável a tempo. Veja logs\docker_$Stamp.log"
}
Write-Log "Postgres OK."

if (-not (Test-Path "dist\src\main.js")) {
    Invoke-Step "Compilando o backend (primeira vez)..." (Join-Path $LogDir "backend_$Stamp.log") { npm run build }
}

$BackendLog = Join-Path $LogDir "backend_$Stamp.log"
Invoke-Step "Aplicando migrations..." $BackendLog { npx prisma migrate deploy }
Invoke-Step "Aplicando seeds..." $BackendLog { npm run db:seed }

Write-Log "Iniciando a API..."
Start-Process -FilePath "node.exe" -ArgumentList "dist\src\main" `
    -WorkingDirectory $BackendPath -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir "backend_$Stamp.out.log") `
    -RedirectStandardError  (Join-Path $LogDir "backend_$Stamp.err.log")

if (-not (Wait-Http "http://localhost:3333" 60)) {
    Write-Log "AVISO: a API não respondeu em 60s. Veja logs\backend_$Stamp.err.log"
}
Write-Log "API OK."

# ---- 3) Frontend: env, build, start --------------------------------------

Set-Location $FrontendPath

if (-not (Test-Path ".env.local")) {
    Write-Log "Criando .env.local a partir de .env.example"
    Copy-Item ".env.example" ".env.local"
}

if (-not (Test-Path "node_modules")) {
    Invoke-Step "Instalando dependências do frontend (primeira vez, pode demorar)..." (Join-Path $LogDir "frontend_$Stamp.log") { npm install }
}

# NEXT_PUBLIC_API_URL é embutido no build — o .env.local precisa existir
# ANTES do build, não só antes do start.
if (-not (Test-Path ".next")) {
    Invoke-Step "Compilando o frontend (primeira vez)..." (Join-Path $LogDir "frontend_$Stamp.log") { npm run build }
}

Write-Log "Iniciando o frontend..."
Start-Process -FilePath "npm.cmd" -ArgumentList "run","start" `
    -WorkingDirectory $FrontendPath -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $LogDir "frontend_$Stamp.out.log") `
    -RedirectStandardError  (Join-Path $LogDir "frontend_$Stamp.err.log")

if (-not (Wait-Http "http://localhost:3000" 60)) {
    Write-Log "AVISO: o frontend não respondeu em 60s. Veja logs\frontend_$Stamp.err.log"
}
Write-Log "Frontend OK."

# ---- 4) Abre o navegador --------------------------------------------------

Start-Process "http://localhost:3000"
Write-Log "LocObra no ar."
Show-Notification "Sistema pronto!"
Close-Notification
