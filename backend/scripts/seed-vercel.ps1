# Seed no banco Vercel Postgres (rode na pasta backend)
# Pré-requisito: arquivo .env.vercel com DATABASE_URL e DIRECT_URL (copiados do painel Vercel)

$envFile = Join-Path $PSScriptRoot "..\.env.vercel"
if (-not (Test-Path $envFile)) {
  Write-Host "Arquivo nao encontrado: $envFile" -ForegroundColor Red
  Write-Host ""
  Write-Host "1. Vercel -> projeto constock -> Storage -> Postgres"
  Write-Host "2. Aba .env.local / Connect -> copie as URLs"
  Write-Host "3. Copie backend\.env.vercel.example para backend\.env.vercel e preencha"
  exit 1
}

Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#') { return }
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $name = $matches[1]
    $value = $matches[2].Trim().Trim('"')
    if ($value) { Set-Item -Path "env:$name" -Value $value }
  }
}

if (-not $env:DATABASE_URL -or $env:DATABASE_URL -match '\.\.\.|^postgres(ql)?://\s*$') {
  Write-Host "DATABASE_URL invalido em .env.vercel" -ForegroundColor Red
  Write-Host "Cole a URL completa do painel (Prisma Postgres -> .env.local -> PRISMA_DATABASE_URL)"
  exit 1
}
if (-not $env:DIRECT_URL) {
  $env:DIRECT_URL = $env:POSTGRES_URL
  if (-not $env:DIRECT_URL) { $env:DIRECT_URL = $env:DATABASE_URL }
}

Set-Location (Join-Path $PSScriptRoot "..")
Write-Host "Aplicando migrations..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Rodando seed (usuarios padrao)..." -ForegroundColor Cyan
npx prisma db seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Pronto! Login:" -ForegroundColor Green
Write-Host "  Admin:        admin@hospital.com / Admin@123"
Write-Host "  Operacional:  operacional@hospital.com / Oper@123"
