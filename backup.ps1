# Полная копия проекта в один архив.
#
# Логика здесь, а не в BACKUP.cmd, намеренно: батник и так плохо переносит
# кавычки, а любая попытка уместить сюда фильтры и подсчёты превращает его в
# нечитаемую строку. Батник остаётся тем, чем должен быть, — ярлыком, по
# которому щёлкают.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$dest = Join-Path (Split-Path -Parent $root) 'parafraz-архивы'
$staging = Join-Path $env:TEMP "parafraz-$stamp"
$archive = Join-Path $dest "parafraz-$stamp.zip"

if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }

# Что не кладём.
#
# node_modules и .next — это 2.1 ГБ, которые целиком восстанавливаются из
# package-lock.json одной командой. Класть их в архив значит возить с собой
# полтора гигабайта ради экономии одной минуты на новом месте.
#
# .env — секреты. Они не в git по той же причине, по которой не должны быть в
# архиве: архив копируют, пересылают и забывают на чужих флешках, а ключ
# service_role обходит все правила доступа к базе. Что с ними делать — сказано
# в SETUP.md.
$skipDirs = @('node_modules', '.next', 'dist', '.expo', '.turbo')
$skipFiles = @('.env', '.env.local', '.env.production')

Write-Host ''
Write-Host '  Собираю копию. Полминуты.'
Write-Host ''

# robocopy, а не Copy-Item: у него есть исключения по именам папок, и на
# нескольких тысячах файлов он в разы быстрее.
$args = @($root, $staging, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:1', '/W:1')
$args += '/XD'
$args += $skipDirs
$args += '/XF'
$args += $skipFiles

& robocopy @args | Out-Null

# robocopy отдаёт 0-7 при успехе (0 — нечего копировать, 1 — скопировано,
# и так далее). Восьмёрка и выше — настоящая ошибка. Это его давняя
# особенность, и без этой проверки любой успешный запуск выглядел бы падением.
if ($LASTEXITCODE -ge 8) {
    Write-Host "  Не удалось собрать копию (robocopy $LASTEXITCODE)." -ForegroundColor Red
    exit 1
}

# .git кладём целиком: четыре мегабайта, зато архив самодостаточен. На новом
# месте это не набор файлов, а репозиторий со всей историей, из которого можно
# сразу продолжать и пушить.
#
# CreateFromDirectory, а не Compress-Archive. У второго путь задаётся маской
# «папка со звёздочкой», а маска в PowerShell не видит скрытого — то есть .git
# молча не попадал в архив, и вместо самодостаточной копии получалась россыпь
# файлов без истории. Поймано счётом: 237 записей вместо 1031.
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $staging,
    $archive,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
)
Remove-Item $staging -Recurse -Force

$size = [math]::Round((Get-Item $archive).Length / 1MB, 1)

Write-Host ''
Write-Host "  Готово: $archive"
Write-Host "  Размер: $size МБ"
Write-Host ''
Write-Host '  Внутри — исходники, миграции, скрипты и вся история git.'
Write-Host '  Ключей внутри нет: их берут заново в панели Supabase.'
Write-Host '  Подробности — в SETUP.md.'
Write-Host ''

# Заодно говорим, всё ли уехало в облако. Архив на диске и коммит на сервере —
# две разные страховки, и знать, что одна из них отстала, лучше сейчас.
Push-Location $root
$ahead = (& git log --oneline '@{u}..HEAD' 2>$null | Measure-Object -Line).Lines
$dirty = (& git status --porcelain 2>$null | Measure-Object -Line).Lines
Pop-Location

if ($ahead -gt 0) { Write-Host "  ВНИМАНИЕ: $ahead коммитов ещё не отправлено на GitHub." -ForegroundColor Yellow }
if ($dirty -gt 0) { Write-Host "  ВНИМАНИЕ: $dirty файлов изменено и не зафиксировано." -ForegroundColor Yellow }
if ($ahead -eq 0 -and $dirty -eq 0) { Write-Host '  GitHub в согласии с папкой: всё отправлено.' -ForegroundColor Green }
Write-Host ''
