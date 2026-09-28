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

# ---- 0) pré-requisitos --------------------------------------------------

if (-not (Test-CommandExists "node")) {
    Write-Log "ERRO: Node.js não encontrado no PATH. Instale o Node.js LTS e tente de novo."
    exit 1
}
if (-not (Test-CommandExists "docker")) {
    Write-Log "ERRO: Docker não encontrado no PATH. Instale o Docker Desktop e tente de novo."
    exit 1
}
if (-not (Test-Path $FrontendPath)) {
    Write-Log "ERRO: pasta do frontend não encontrada (procurei em $FrontendPath). Ajuste `$FrontendPath no script."
    exit 1
}

# ---- 1) Docker Desktop ---------------------------------------------------

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Log "Docker Desktop não está de pé — iniciando..."
    $DockerExe = Join-Path $Env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $DockerExe) {
        Start-Process $DockerExe
    }
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
        Start-Sleep -Seconds 3
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERRO: Docker Desktop não respondeu a tempo."
        exit 1
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
    Write-Log "Instalando dependências do backend (primeira vez, pode demorar)..."
    npm install *>> (Join-Path $LogDir "backend_$Stamp.log")
}

Write-Log "Subindo o Postgres..."
docker compose up -d *>> (Join-Path $LogDir "docker_$Stamp.log")

$deadline = (Get-Date).AddSeconds(60)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    $status = docker inspect -f "{{.State.Health.Status}}" alb_locacoes_postgres 2>$null
    if ($status -eq "healthy") { $healthy = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    Write-Log "ERRO: Postgres não ficou saudável a tempo. Veja logs\docker_$Stamp.log"
    exit 1
}
Write-Log "Postgres OK."

if (-not (Test-Path "dist\src\main.js")) {
    Write-Log "Compilando o backend (primeira vez)..."
    npm run build *>> (Join-Path $LogDir "backend_$Stamp.log")
}

Write-Log "Aplicando migrations e seeds..."
npx prisma migrate deploy *>> (Join-Path $LogDir "backend_$Stamp.log")
npm run db:seed *>> (Join-Path $LogDir "backend_$Stamp.log")

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
    Write-Log "Instalando dependências do frontend (primeira vez, pode demorar)..."
    npm install *>> (Join-Path $LogDir "frontend_$Stamp.log")
}

# NEXT_PUBLIC_API_URL é embutido no build — o .env.local precisa existir
# ANTES do build, não só antes do start.
if (-not (Test-Path ".next")) {
    Write-Log "Compilando o frontend (primeira vez)..."
    npm run build *>> (Join-Path $LogDir "frontend_$Stamp.log")
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
