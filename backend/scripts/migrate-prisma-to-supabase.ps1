# Migracao Prisma Postgres -> Supabase (dump completo + restore).
# Preencha backend/.env.supabase (ver .env.supabase.example) e rode:
#   .\scripts\migrate-prisma-to-supabase.ps1
#
# Requer Docker (imagem postgres:17) para pg_dump/pg_restore.

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
$EnvFile = Join-Path $BackendRoot ".env.supabase"
$DumpFile = Join-Path $BackendRoot "scripts\data\easycon-prod.dump"
$CountsBefore = Join-Path $BackendRoot "scripts\data\counts-source.txt"
$CountsAfter = Join-Path $BackendRoot "scripts\data\counts-target.txt"

function Read-DotEnv([string]$Path) {
  $map = @{}
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $key = $line.Substring(0, $i).Trim()
    $val = $line.Substring($i + 1).Trim()
    if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

if (-not (Test-Path $EnvFile)) {
  Write-Error "Crie $EnvFile a partir de .env.supabase.example com SOURCE_URL, DATABASE_URL e DIRECT_URL."
}

$envMap = Read-DotEnv $EnvFile
$SourceUrl = $envMap["SOURCE_URL"]
$DirectUrl = $envMap["DIRECT_URL"]
$DatabaseUrl = $envMap["DATABASE_URL"]

if (-not $SourceUrl) { Write-Error "SOURCE_URL ausente em .env.supabase" }
if (-not $DirectUrl) { Write-Error "DIRECT_URL (Supabase direto :5432) ausente em .env.supabase" }
if (-not $DatabaseUrl) { Write-Error "DATABASE_URL (Supabase pooler :6543) ausente em .env.supabase" }

New-Item -ItemType Directory -Force -Path (Split-Path $DumpFile) | Out-Null

Write-Host "==> Contagens na origem..."
$env:DATABASE_URL = $SourceUrl
$env:DIRECT_URL = $SourceUrl
Push-Location $BackendRoot
npx tsx scripts/count-db-rows.ts | Tee-Object -FilePath $CountsBefore
Pop-Location

Write-Host "==> pg_dump (schema + dados) da origem..."
docker run --rm -v "${BackendRoot}/scripts/data:/out" postgres:17 `
  pg_dump "$SourceUrl" --format=custom --no-owner --no-acl -f /out/easycon-prod.dump

if (-not (Test-Path $DumpFile)) {
  Write-Error "Dump nao gerado: $DumpFile"
}

Write-Host "==> Schema no destino (prisma db push — sem baseline migration)..."
$env:DATABASE_URL = $DatabaseUrl
$env:DIRECT_URL = $DirectUrl
Push-Location $BackendRoot
npx prisma db push --skip-generate --accept-data-loss=false
Pop-Location

Write-Host "==> Limpando tabelas public no destino (mantem schema)..."
$cleanSql = @"
DO `$`$ `$`$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END `$`$;
"@
$cleanSql | docker run --rm -i postgres:17 psql "$DirectUrl" -v ON_ERROR_STOP=1

Write-Host "==> pg_restore --data-only no Supabase..."
docker run --rm -v "${BackendRoot}/scripts/data:/out" postgres:17 `
  pg_restore --data-only --no-owner --no-acl --disable-triggers `
  --dbname="$DirectUrl" /out/easycon-prod.dump

Write-Host "==> Alinhando historico _prisma_migrations..."
Push-Location $BackendRoot
$env:DATABASE_URL = $DatabaseUrl
$env:DIRECT_URL = $DirectUrl
# Marca migrations do repo como aplicadas se a tabela veio vazia/incompleta do dump parcial
$migrations = Get-ChildItem (Join-Path $BackendRoot "prisma\migrations") -Directory | Sort-Object Name
foreach ($m in $migrations) {
  npx prisma migrate resolve --applied $m.Name 2>$null
}
Pop-Location

Write-Host "==> Contagens no destino..."
$env:DATABASE_URL = $DatabaseUrl
$env:DIRECT_URL = $DirectUrl
Push-Location $BackendRoot
npx tsx scripts/count-db-rows.ts | Tee-Object -FilePath $CountsAfter
Pop-Location

Write-Host ""
Write-Host "Compare $CountsBefore vs $CountsAfter"
Write-Host "Cutover Vercel: DATABASE_URL=pooler, DIRECT_URL=direto (somente Supabase)."
Write-Host "Done."
